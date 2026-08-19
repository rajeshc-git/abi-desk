import { DateTime } from 'luxon';

export interface BusinessDayWindow {
  weekday: number; // 0 = Sunday, 6 = Saturday (matching JS Date/Luxon)
  startMinute: number; // minutes from midnight (0..1439)
  endMinute: number; // minutes from midnight (0..1439)
}

export interface HolidayDefinition {
  date: Date | string;
  recursAnnually: boolean;
}

export interface BusinessHoursDefinition {
  timezone: string;
  isAlwaysOpen: boolean;
  days: BusinessDayWindow[];
  holidays?: HolidayDefinition[];
}

export class SlaCalculator {
  /**
   * Calculates the deadline (`dueAt`) and warning threshold (`warnAt`) for an SLA target.
   *
   * @param startedAt Starting timestamp
   * @param targetMinutes Target duration in business minutes (or calendar minutes if 24x7)
   * @param warningThreshold Fraction (e.g. 0.75 = 75% elapsed)
   * @param businessHours Working hours definition (or null/alwaysOpen for 24x7 calendar time)
   */
  static calculateDeadlines(
    startedAt: Date,
    targetMinutes: number,
    warningThreshold = 0.75,
    businessHours?: BusinessHoursDefinition | null,
  ): { dueAt: Date; warnAt: Date } {
    if (
      !businessHours ||
      businessHours.isAlwaysOpen ||
      !businessHours.days ||
      businessHours.days.length === 0
    ) {
      // 24x7 Calendar time
      const startMs = startedAt.getTime();
      const dueMs = startMs + targetMinutes * 60 * 1000;
      const warnOffsetMs = targetMinutes * (1 - warningThreshold) * 60 * 1000;
      const warnMs = dueMs - warnOffsetMs;

      return {
        dueAt: new Date(dueMs),
        warnAt: new Date(warnMs),
      };
    }

    const zone = businessHours.timezone || 'UTC';
    const dueAt = this.addBusinessMinutes(startedAt, targetMinutes, businessHours, zone);

    const warnMinutes = Math.max(1, Math.round(targetMinutes * warningThreshold));
    const warnAt = this.addBusinessMinutes(startedAt, warnMinutes, businessHours, zone);

    return { dueAt, warnAt };
  }

  /**
   * Advances a starting date by N business minutes according to weekly shifts & holidays.
   */
  static addBusinessMinutes(
    startDate: Date,
    minutesToAdd: number,
    businessHours: BusinessHoursDefinition,
    timezone: string,
  ): Date {
    if (minutesToAdd <= 0) return startDate;

    let remainingMinutes = minutesToAdd;
    let current = DateTime.fromJSDate(startDate, { zone: timezone });

    // Ensure sorted shifts by weekday and startMinute
    const shiftsByDay = new Map<number, BusinessDayWindow[]>();
    for (const shift of businessHours.days) {
      const list = shiftsByDay.get(shift.weekday) ?? [];
      list.push(shift);
      list.sort((a, b) => a.startMinute - b.startMinute);
      shiftsByDay.set(shift.weekday, list);
    }

    // Safety limit of 365 days forward to avoid infinite loops
    let daysIterated = 0;
    while (remainingMinutes > 0 && daysIterated < 365) {
      const weekday = current.weekday % 7; // Luxon: 1=Mon..7=Sun -> 0=Sun..6=Sat
      const isHoliday = this.isHolidayDate(current, businessHours.holidays);

      if (!isHoliday && shiftsByDay.has(weekday)) {
        const shifts = shiftsByDay.get(weekday)!;
        const currentMinuteOfDay = current.hour * 60 + current.minute + current.second / 60;

        for (const shift of shifts) {
          if (currentMinuteOfDay < shift.endMinute) {
            const shiftStartMinute = Math.max(shift.startMinute, currentMinuteOfDay);
            const availableMinutesInShift = shift.endMinute - shiftStartMinute;

            if (remainingMinutes <= availableMinutesInShift) {
              const finalMinute = shiftStartMinute + remainingMinutes;
              const hour = Math.floor(finalMinute / 60);
              const minute = Math.floor(finalMinute % 60);
              const second = Math.round((finalMinute % 1) * 60);

              return current.set({ hour, minute, second, millisecond: 0 }).toJSDate();
            } else {
              remainingMinutes -= availableMinutesInShift;
              // Advance to end of this shift
              current = current.set({
                hour: Math.floor(shift.endMinute / 60),
                minute: shift.endMinute % 60,
                second: 0,
                millisecond: 0,
              });
            }
          }
        }
      }

      // Advance to start of next day (midnight)
      current = current.plus({ days: 1 }).startOf('day');
      daysIterated++;
    }

    // Fallback if loop finishes
    return current.toJSDate();
  }

  /**
   * Checks if the current day matches a holiday in the business hours definition.
   */
  private static isHolidayDate(date: DateTime, holidays?: HolidayDefinition[]): boolean {
    if (!holidays || holidays.length === 0) return false;

    for (const h of holidays) {
      const hDate =
        typeof h.date === 'string' ? DateTime.fromISO(h.date) : DateTime.fromJSDate(h.date);
      if (h.recursAnnually) {
        if (hDate.month === date.month && hDate.day === date.day) {
          return true;
        }
      } else {
        if (hDate.hasSame(date, 'day')) {
          return true;
        }
      }
    }

    return false;
  }
}

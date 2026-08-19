import { describe, expect, it } from 'vitest';
import { type BusinessHoursDefinition, SlaCalculator } from './sla-calculator';

describe('SlaCalculator', () => {
  const fridayEveningUtc = new Date('2026-08-07T17:00:00.000Z'); // Friday 5:00 PM UTC

  it('calculates 24x7 calendar time accurately', () => {
    const { dueAt, warnAt } = SlaCalculator.calculateDeadlines(
      fridayEveningUtc,
      240, // 4 hours
      0.75,
      { timezone: 'UTC', isAlwaysOpen: true, days: [] },
    );

    // 17:00 + 4 hours = 21:00 UTC
    expect(dueAt.toISOString()).toBe('2026-08-07T21:00:00.000Z');
    // 75% elapsed warning = 17:00 + 3 hours = 20:00 UTC
    expect(warnAt.toISOString()).toBe('2026-08-07T20:00:00.000Z');
  });

  it('calculates business hours skipping weekend to Monday morning', () => {
    // Business hours: Monday to Friday (1..5), 09:00 (540m) to 17:00 (1020m) UTC
    const businessHours: BusinessHoursDefinition = {
      timezone: 'UTC',
      isAlwaysOpen: false,
      days: [
        { weekday: 1, startMinute: 540, endMinute: 1020 }, // Monday
        { weekday: 2, startMinute: 540, endMinute: 1020 }, // Tuesday
        { weekday: 3, startMinute: 540, endMinute: 1020 }, // Wednesday
        { weekday: 4, startMinute: 540, endMinute: 1020 }, // Thursday
        { weekday: 5, startMinute: 540, endMinute: 1020 }, // Friday
      ],
    };

    // Opened Friday at 16:30 (990m): only 30m remaining on Friday
    const fridayLate = new Date('2026-08-07T16:30:00.000Z');

    // 4 hours (240 business minutes): 30m Friday, remaining 210m (3h 30m) on Monday
    // Monday starts at 09:00 + 3h 30m = 12:30 UTC
    const { dueAt } = SlaCalculator.calculateDeadlines(fridayLate, 240, 0.75, businessHours);

    expect(dueAt.toISOString()).toBe('2026-08-10T12:30:00.000Z'); // Monday Aug 10, 12:30 UTC
  });

  it('skips declared annual holidays', () => {
    const businessHours: BusinessHoursDefinition = {
      timezone: 'UTC',
      isAlwaysOpen: false,
      days: [
        { weekday: 1, startMinute: 540, endMinute: 1020 }, // Monday
        { weekday: 2, startMinute: 540, endMinute: 1020 }, // Tuesday
        { weekday: 5, startMinute: 540, endMinute: 1020 }, // Friday
      ],
      holidays: [
        {
          date: '2026-08-10', // Monday is a holiday!
          recursAnnually: false,
        },
      ],
    };

    const fridayLate = new Date('2026-08-07T16:30:00.000Z');
    // 240 business minutes: 30m Friday, skips Monday (holiday), 210m on Tuesday 09:00 -> 12:30 UTC
    const { dueAt } = SlaCalculator.calculateDeadlines(fridayLate, 240, 0.75, businessHours);

    expect(dueAt.toISOString()).toBe('2026-08-11T12:30:00.000Z'); // Tuesday Aug 11, 12:30 UTC
  });
});

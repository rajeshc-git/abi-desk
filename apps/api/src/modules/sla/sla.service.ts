import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, type SlaTargetType } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import {
  type TenantTransaction,
  TenantPrismaService,
} from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { ConditionEvaluator } from '../automation/evaluator/condition-evaluator';
import {
  type CreateBusinessHoursDto,
  type CreateHolidayDto,
  type CreateSlaPolicyDto,
  type UpdateBusinessHoursDto,
  type UpdateSlaPolicyDto,
} from './sla.dto';
import { type BusinessHoursDefinition, SlaCalculator } from './sla-calculator';

@Injectable()
export class SlaService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'SlaService' });
  }

  // ---------------------------------------------------------------------------
  // Business Hours & Holidays
  // ---------------------------------------------------------------------------

  async createBusinessHours(_principal: AuthenticatedPrincipal, dto: CreateBusinessHoursDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      if (dto.isDefault) {
        await tx.businessHours.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      const created = await tx.businessHours.create({
        data: {
          tenantId,
          name: dto.name,
          timezone: dto.timezone,
          isAlwaysOpen: dto.isAlwaysOpen,
          isDefault: dto.isDefault,
          brandId: dto.brandId ?? null,
          days: {
            create: dto.days.map((d) => ({
              tenantId,
              weekday: d.weekday,
              startMinute: d.startMinute,
              endMinute: d.endMinute,
            })),
          },
        },
        include: { days: true, holidays: true },
      });

      return created;
    });
  }

  async listBusinessHours(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.businessHours.findMany({
      where: { tenantId },
      include: { days: true, holidays: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async createHoliday(_principal: AuthenticatedPrincipal, dto: CreateHolidayDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.holiday.create({
      data: {
        tenantId,
        name: dto.name,
        date: new Date(dto.date),
        recursAnnually: dto.recursAnnually,
        businessHoursId: dto.businessHoursId ?? null,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // SLA Policies & Targets
  // ---------------------------------------------------------------------------

  async createPolicy(_principal: AuthenticatedPrincipal, dto: CreateSlaPolicyDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      if (dto.isDefault) {
        await tx.slaPolicy.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      const policy = await tx.slaPolicy.create({
        data: {
          tenantId,
          name: dto.name,
          description: dto.description ?? null,
          brandId: dto.brandId ?? null,
          conditions: dto.conditions as Prisma.InputJsonValue,
          priority: dto.priority,
          businessHoursId: dto.businessHoursId ?? null,
          warningThreshold: dto.warningThreshold,
          escalateOnBreach: dto.escalateOnBreach,
          notifyRoleKeys: dto.notifyRoleKeys,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
          targets: {
            create: dto.targets.map((t) => ({
              tenantId,
              type: t.type,
              minutes: t.minutes,
              priorityOverrides: t.priorityOverrides as Prisma.InputJsonValue,
            })),
          },
        },
        include: { targets: true, businessHours: { include: { days: true, holidays: true } } },
      });

      this.logger.info({ policyId: policy.id, tenantId, name: policy.name }, 'SLA policy created');
      return policy;
    });
  }

  async listPolicies(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.slaPolicy.findMany({
      where: { tenantId },
      include: { targets: true, businessHours: { include: { days: true, holidays: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async getPolicy(_principal: AuthenticatedPrincipal, policyId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const policy = await this.db.client.slaPolicy.findFirst({
      where: { id: policyId, tenantId },
      include: { targets: true, businessHours: { include: { days: true, holidays: true } } },
    });

    if (!policy) {
      throw AppException.notFound(`SLA Policy '${policyId}' not found.`);
    }

    return policy;
  }

  async updatePolicy(
    _principal: AuthenticatedPrincipal,
    policyId: string,
    dto: UpdateSlaPolicyDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      const existing = await tx.slaPolicy.findFirst({
        where: { id: policyId, tenantId },
      });

      if (!existing) {
        throw AppException.notFound(`SLA Policy '${policyId}' not found.`);
      }

      if (dto.isDefault) {
        await tx.slaPolicy.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      const data: Prisma.SlaPolicyUpdateInput = {};
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.description !== undefined) data.description = dto.description ?? null;
      if (dto.brandId !== undefined)
        data.brand = dto.brandId ? { connect: { id: dto.brandId } } : { disconnect: true };
      if (dto.conditions !== undefined) data.conditions = dto.conditions as Prisma.InputJsonValue;
      if (dto.priority !== undefined) data.priority = dto.priority;
      if (dto.businessHoursId !== undefined) {
        data.businessHours = dto.businessHoursId
          ? { connect: { id: dto.businessHoursId } }
          : { disconnect: true };
      }
      if (dto.warningThreshold !== undefined) data.warningThreshold = dto.warningThreshold;
      if (dto.escalateOnBreach !== undefined) data.escalateOnBreach = dto.escalateOnBreach;
      if (dto.notifyRoleKeys !== undefined) data.notifyRoleKeys = dto.notifyRoleKeys;
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;

      if (dto.targets && dto.targets.length > 0) {
        await tx.slaTarget.deleteMany({ where: { policyId } });
        await tx.slaTarget.createMany({
          data: dto.targets.map((t) => ({
            tenantId,
            policyId,
            type: t.type,
            minutes: t.minutes,
            priorityOverrides: t.priorityOverrides as Prisma.InputJsonValue,
          })),
        });
      }

      return tx.slaPolicy.update({
        where: { id: policyId },
        data,
        include: { targets: true, businessHours: { include: { days: true, holidays: true } } },
      });
    });
  }

  async deletePolicy(_principal: AuthenticatedPrincipal, policyId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.slaPolicy.findFirst({
      where: { id: policyId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`SLA Policy '${policyId}' not found.`);
    }

    await this.db.client.slaPolicy.delete({
      where: { id: policyId },
    });

    return { success: true, deletedPolicyId: policyId };
  }

  // ---------------------------------------------------------------------------
  // Ticket SLA Clocks Lifecycle Engine
  // ---------------------------------------------------------------------------

  /**
   * Initializes SLA target clocks for a newly created or updated ticket.
   */
  async initializeClocksForTicket(
    tx: TenantTransaction,
    tenantId: string,
    ticket: {
      id: string;
      number: string;
      priority: string;
      brandId: string;
      category?: string | null;
      channel?: string | null;
      tier?: string;
      status?: string;
      createdAt?: Date;
    },
  ) {
    const now = ticket.createdAt ?? new Date();

    // Fetch active policies for tenant
    const policies = await tx.slaPolicy.findMany({
      where: { tenantId, isActive: true },
      include: {
        targets: true,
        businessHours: {
          include: { days: true, holidays: true },
        },
      },
      orderBy: [{ priority: 'asc' }],
    });

    if (policies.length === 0) {
      this.logger.debug({ tenantId, ticketId: ticket.id }, 'No SLA policies found for tenant');
      return;
    }

    // Match policy using condition evaluator
    let matchedPolicy = policies.find((p) => {
      if (!p.conditions || Object.keys(p.conditions as object).length === 0) {
        return p.isDefault;
      }
      const evalResult = ConditionEvaluator.evaluate(
        ticket as unknown as Record<string, unknown>,
        p.conditions as Record<string, unknown>,
      );
      return evalResult.matched;
    });

    // Fallback to default policy
    if (!matchedPolicy) {
      matchedPolicy = policies.find((p) => p.isDefault) ?? policies[0];
    }

    if (!matchedPolicy) return;

    // Convert business hours if present
    let bhDef: BusinessHoursDefinition | null = null;
    if (matchedPolicy.businessHours) {
      bhDef = {
        timezone: matchedPolicy.businessHours.timezone,
        isAlwaysOpen: matchedPolicy.businessHours.isAlwaysOpen,
        days: matchedPolicy.businessHours.days.map((d) => ({
          weekday: d.weekday,
          startMinute: d.startMinute,
          endMinute: d.endMinute,
        })),
        holidays: matchedPolicy.businessHours.holidays.map((h) => ({
          date: h.date,
          recursAnnually: h.recursAnnually,
        })),
      };
    }

    for (const target of matchedPolicy.targets) {
      // Check priority overrides
      let minutes = target.minutes;
      const overrides = (target.priorityOverrides as Record<string, number>) ?? {};
      if (overrides[ticket.priority] && overrides[ticket.priority]! > 0) {
        minutes = overrides[ticket.priority]!;
      }

      const { dueAt, warnAt } = SlaCalculator.calculateDeadlines(
        now,
        minutes,
        matchedPolicy.warningThreshold,
        bhDef,
      );

      const state = await tx.ticketSlaState.upsert({
        where: {
          ticketId_type: { ticketId: ticket.id, type: target.type },
        },
        create: {
          tenantId,
          ticketId: ticket.id,
          policyId: matchedPolicy.id,
          targetId: target.id,
          type: target.type,
          status: 'RUNNING',
          startedAt: now,
          dueAt,
          warnAt,
        },
        update: {
          policyId: matchedPolicy.id,
          targetId: target.id,
          dueAt,
          warnAt,
        },
      });

      await tx.slaEvent.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          stateId: state.id,
          type: 'STARTED',
          targetType: target.type,
          dueAt,
          reason: `SLA target started via policy '${matchedPolicy.name}' (${minutes}m)`,
        },
      });
    }

    this.logger.info(
      { ticketId: ticket.id, policyName: matchedPolicy.name },
      'SLA clocks initialized for ticket',
    );
  }

  /**
   * Records first response from an agent, resolving FIRST_RESPONSE clock.
   */
  async recordFirstResponse(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    respondedAt = new Date(),
  ) {
    const clock = await tx.ticketSlaState.findUnique({
      where: { ticketId_type: { ticketId, type: 'FIRST_RESPONSE' } },
    });

    if (!clock || clock.status === 'MET' || clock.status === 'CANCELLED') return;

    const isBreached = respondedAt.getTime() > clock.dueAt.getTime();
    const breachMs = respondedAt.getTime() - clock.dueAt.getTime();

    await tx.ticketSlaState.update({
      where: { id: clock.id },
      data: {
        status: isBreached ? 'BREACHED' : 'MET',
        metAt: respondedAt,
        breachedAt: isBreached ? respondedAt : null,
        breachMs: BigInt(breachMs),
      },
    });

    await tx.slaEvent.create({
      data: {
        tenantId,
        ticketId,
        stateId: clock.id,
        type: isBreached ? 'BREACHED' : 'MET',
        targetType: 'FIRST_RESPONSE',
        dueAt: clock.dueAt,
        reason: isBreached
          ? `First response breached by ${Math.round(breachMs / 60000)}m`
          : 'First response SLA target met successfully',
      },
    });
  }

  /**
   * Pauses running clocks when ticket is moved to PENDING_CUSTOMER.
   */
  async pauseClocksForTicket(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    reason = 'Waiting on customer response',
  ) {
    const runningClocks = await tx.ticketSlaState.findMany({
      where: { ticketId, tenantId, status: 'RUNNING' },
    });

    const now = new Date();

    for (const clock of runningClocks) {
      const elapsedSinceStart = now.getTime() - clock.startedAt.getTime();

      await tx.ticketSlaState.update({
        where: { id: clock.id },
        data: {
          status: 'PAUSED',
          pausedAt: now,
          pauseCount: { increment: 1 },
          elapsedMs: BigInt(elapsedSinceStart),
        },
      });

      await tx.slaEvent.create({
        data: {
          tenantId,
          ticketId,
          stateId: clock.id,
          type: 'PAUSED',
          targetType: clock.type,
          dueAt: clock.dueAt,
          reason,
        },
      });
    }
  }

  /**
   * Resumes paused clocks when ticket leaves customer-waiting state.
   */
  async resumeClocksForTicket(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    reason = 'Customer replied or status updated',
  ) {
    const pausedClocks = await tx.ticketSlaState.findMany({
      where: { ticketId, tenantId, status: 'PAUSED' },
      include: {
        target: true,
        policy: { include: { businessHours: { include: { days: true, holidays: true } } } },
      },
    });

    const now = new Date();

    for (const clock of pausedClocks) {
      const pausedDurationMs = clock.pausedAt ? now.getTime() - clock.pausedAt.getTime() : 0;
      const totalPausedMs = Number(clock.pausedMs) + pausedDurationMs;

      // Recalculate deadline based on remaining business minutes
      const totalTargetMinutes = clock.target.minutes;
      const elapsedMinutes = Math.floor(Number(clock.elapsedMs) / 60000);
      const remainingMinutes = Math.max(1, totalTargetMinutes - elapsedMinutes);

      let bhDef: BusinessHoursDefinition | null = null;
      if (clock.policy.businessHours) {
        bhDef = {
          timezone: clock.policy.businessHours.timezone,
          isAlwaysOpen: clock.policy.businessHours.isAlwaysOpen,
          days: clock.policy.businessHours.days.map((d) => ({
            weekday: d.weekday,
            startMinute: d.startMinute,
            endMinute: d.endMinute,
          })),
          holidays: clock.policy.businessHours.holidays.map((h) => ({
            date: h.date,
            recursAnnually: h.recursAnnually,
          })),
        };
      }

      const { dueAt, warnAt } = SlaCalculator.calculateDeadlines(
        now,
        remainingMinutes,
        clock.policy.warningThreshold,
        bhDef,
      );

      await tx.ticketSlaState.update({
        where: { id: clock.id },
        data: {
          status: 'RUNNING',
          pausedAt: null,
          pausedMs: BigInt(totalPausedMs),
          dueAt,
          warnAt,
        },
      });

      await tx.slaEvent.create({
        data: {
          tenantId,
          ticketId,
          stateId: clock.id,
          type: 'RESUMED',
          targetType: clock.type,
          dueAt,
          reason,
        },
      });
    }
  }

  /**
   * Records resolution of a ticket, completing the RESOLUTION clock.
   */
  async recordResolution(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    resolvedAt = new Date(),
  ) {
    const clock = await tx.ticketSlaState.findUnique({
      where: { ticketId_type: { ticketId, type: 'RESOLUTION' } },
    });

    if (!clock || clock.status === 'MET' || clock.status === 'CANCELLED') return;

    const isBreached = resolvedAt.getTime() > clock.dueAt.getTime();
    const breachMs = resolvedAt.getTime() - clock.dueAt.getTime();

    await tx.ticketSlaState.update({
      where: { id: clock.id },
      data: {
        status: isBreached ? 'BREACHED' : 'MET',
        metAt: resolvedAt,
        breachedAt: isBreached ? resolvedAt : null,
        breachMs: BigInt(breachMs),
      },
    });

    await tx.slaEvent.create({
      data: {
        tenantId,
        ticketId,
        stateId: clock.id,
        type: isBreached ? 'BREACHED' : 'MET',
        targetType: 'RESOLUTION',
        dueAt: clock.dueAt,
        reason: isBreached
          ? `Resolution deadline breached by ${Math.round(breachMs / 60000)}m`
          : 'Resolution SLA target met successfully',
      },
    });
  }

  /**
   * Retrieves all live SLA clock states and event trail for a ticket.
   */
  async getTicketSlaClocks(_principal: AuthenticatedPrincipal, ticketId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const [clocks, events] = await Promise.all([
      this.db.client.ticketSlaState.findMany({
        where: { ticketId, tenantId },
        include: { policy: { select: { id: true, name: true, warningThreshold: true } } },
      }),
      this.db.client.slaEvent.findMany({
        where: { ticketId, tenantId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    return {
      clocks: clocks.map((c) => ({
        ...c,
        elapsedMs: Number(c.elapsedMs),
        pausedMs: Number(c.pausedMs),
        breachMs: c.breachMs !== null ? Number(c.breachMs) : null,
      })),
      events,
    };
  }
}

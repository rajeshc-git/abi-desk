import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type AutomationAction,
  type AutomationTrigger,
  type CreateAutomationRuleDto,
  type ListAutomationRulesDto,
  type ReorderAutomationRulesDto,
  type TestAutomationRuleDto,
  type UpdateAutomationRuleDto,
} from './automation.dto';
import { ConditionEvaluator } from './evaluator/condition-evaluator';
import { ActionExecutor } from './executor/action-executor';

@Injectable()
export class AutomationService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'AutomationService' });
  }

  /**
   * Creates a new automation rule for the tenant.
   */
  async createRule(principal: AuthenticatedPrincipal, dto: CreateAutomationRuleDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const rule = await this.db.client.automationRule.create({
      data: {
        tenantId,
        name: dto.name,
        description: dto.description ?? null,
        trigger: dto.trigger,
        conditions: dto.conditions as unknown as Prisma.InputJsonValue,
        actions: dto.actions as unknown as Prisma.InputJsonValue,
        schedule: dto.schedule ?? null,
        priority: dto.priority,
        stopOnMatch: dto.stopOnMatch,
        maxRunsPerTicket: dto.maxRunsPerTicket,
        isActive: dto.isActive,
        createdById: principal.userId,
      },
    });

    this.logger.info({ ruleId: rule.id, tenantId, name: rule.name }, 'Automation rule created');
    return rule;
  }

  /**
   * Updates an existing automation rule.
   */
  async updateRule(
    principal: AuthenticatedPrincipal,
    ruleId: string,
    dto: UpdateAutomationRuleDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.automationRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`Automation rule '${ruleId}' not found.`);
    }

    const data: Prisma.AutomationRuleUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.description !== undefined) data.description = dto.description ?? null;
    if (dto.trigger !== undefined) data.trigger = dto.trigger;
    if (dto.conditions !== undefined)
      data.conditions = dto.conditions as unknown as Prisma.InputJsonValue;
    if (dto.actions !== undefined) data.actions = dto.actions as unknown as Prisma.InputJsonValue;
    if (dto.schedule !== undefined) data.schedule = dto.schedule ?? null;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.stopOnMatch !== undefined) data.stopOnMatch = dto.stopOnMatch;
    if (dto.maxRunsPerTicket !== undefined) data.maxRunsPerTicket = dto.maxRunsPerTicket;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const updated = await this.db.client.automationRule.update({
      where: { id: ruleId },
      data,
    });

    this.logger.info({ ruleId, tenantId }, 'Automation rule updated');
    return updated;
  }

  /**
   * Deletes an automation rule.
   */
  async deleteRule(_principal: AuthenticatedPrincipal, ruleId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.automationRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`Automation rule '${ruleId}' not found.`);
    }

    await this.db.client.automationRule.delete({
      where: { id: ruleId },
    });

    this.logger.info({ ruleId, tenantId }, 'Automation rule deleted');
    return { success: true, deletedRuleId: ruleId };
  }

  /**
   * Gets an automation rule by id.
   */
  async getRule(_principal: AuthenticatedPrincipal, ruleId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const rule = await this.db.client.automationRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      throw AppException.notFound(`Automation rule '${ruleId}' not found.`);
    }

    return rule;
  }

  /**
   * Lists automation rules for the tenant.
   */
  async listRules(_principal: AuthenticatedPrincipal, query: ListAutomationRulesDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const where: Prisma.AutomationRuleWhereInput = { tenantId };
    if (query.trigger) where.trigger = query.trigger;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.db.client.automationRule.findMany({
      where,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * Updates rule priority ordering in bulk.
   */
  async reorderRules(_principal: AuthenticatedPrincipal, dto: ReorderAutomationRulesDto) {
    const tenantId = this.tenantContext.requireTenantId();

    await this.db.run(async (tx) => {
      for (let i = 0; i < dto.ruleIds.length; i++) {
        const id = dto.ruleIds[i];
        if (id) {
          await tx.automationRule.updateMany({
            where: { id, tenantId },
            data: { priority: i },
          });
        }
      }
    });

    return this.listRules(_principal, {});
  }

  /**
   * Gets execution runs / history for a specific rule.
   */
  async getRuleRuns(
    _principal: AuthenticatedPrincipal,
    ruleId: string,
    options: { limit?: number; offset?: number } = {},
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const take = Math.min(options.limit ?? 50, 100);
    const skip = options.offset ?? 0;

    const [items, total] = await Promise.all([
      this.db.client.automationRun.findMany({
        where: { ruleId, tenantId },
        orderBy: { createdAt: 'desc' },
        take,
        skip,
        include: {
          ticket: {
            select: { id: true, number: true, subject: true, status: true, priority: true },
          },
        },
      }),
      this.db.client.automationRun.count({ where: { ruleId, tenantId } }),
    ]);

    return { items, total, limit: take, offset: skip };
  }

  /**
   * Dry-run tests an automation rule against a ticket without committing changes.
   */
  async testRule(_principal: AuthenticatedPrincipal, ruleId: string, dto: TestAutomationRuleDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const rule = await this.db.client.automationRule.findFirst({
      where: { id: ruleId, tenantId },
    });

    if (!rule) {
      throw AppException.notFound(`Automation rule '${ruleId}' not found.`);
    }

    const ticket = await this.loadTicketForEvaluation(tenantId, dto.ticketId);
    if (!ticket) {
      throw AppException.notFound(`Ticket '${dto.ticketId}' not found.`);
    }

    const evalResult = ConditionEvaluator.evaluate(
      ticket as unknown as Record<string, unknown>,
      rule.conditions as Record<string, unknown>,
    );

    return {
      ruleId: rule.id,
      ruleName: rule.name,
      ticketId: ticket.id,
      ticketNumber: ticket.number,
      matched: evalResult.matched,
      conditionTrace: evalResult.trace,
      actionsToExecute: evalResult.matched ? rule.actions : [],
    };
  }

  /**
   * Main evaluation pipeline triggered by domain events.
   */
  async evaluateTrigger(
    tenantId: string,
    trigger: AutomationTrigger,
    ticketId: string,
    causationId?: string,
  ): Promise<{ evaluated: number; matched: number; executed: number }> {
    const startTime = Date.now();

    const ticket = await this.loadTicketForEvaluation(tenantId, ticketId);
    if (!ticket) {
      this.logger.warn({ tenantId, ticketId, trigger }, 'Ticket not found for automation');
      return { evaluated: 0, matched: 0, executed: 0 };
    }

    const rules = await this.db.unsafeRawClient.automationRule.findMany({
      where: { tenantId, trigger, isActive: true },
      orderBy: { priority: 'asc' },
    });

    let matchedCount = 0;
    let executedCount = 0;

    for (const rule of rules) {
      const ruleStart = Date.now();

      // Loop detection / recursion guard
      if (causationId) {
        const previousRunsCount = await this.db.unsafeRawClient.automationRun.count({
          where: {
            tenantId,
            ruleId: rule.id,
            ticketId,
            causationId,
            status: { in: ['SUCCESS', 'LOOP_BLOCKED'] },
          },
        });

        if (previousRunsCount >= rule.maxRunsPerTicket) {
          await this.db.unsafeRawClient.automationRun.create({
            data: {
              tenantId,
              ruleId: rule.id,
              ticketId,
              status: 'LOOP_BLOCKED',
              trigger,
              causationId,
              durationMs: Date.now() - ruleStart,
              error: `Recursion limit reached (${rule.maxRunsPerTicket} runs for causation ${causationId}).`,
            },
          });
          this.logger.warn(
            { ruleId: rule.id, ticketId, causationId },
            'Automation rule recursion limit reached',
          );
          continue;
        }
      }

      // Evaluate conditions
      const evalResult = ConditionEvaluator.evaluate(
        ticket as unknown as Record<string, unknown>,
        rule.conditions as Record<string, unknown>,
      );

      if (!evalResult.matched) {
        // Record skipped run
        await this.db.unsafeRawClient.automationRun.create({
          data: {
            tenantId,
            ruleId: rule.id,
            ticketId,
            status: 'SKIPPED',
            trigger,
            conditionTrace: evalResult.trace as Prisma.InputJsonValue,
            causationId: causationId ?? null,
            durationMs: Date.now() - ruleStart,
          },
        });

        await this.db.unsafeRawClient.automationRule.update({
          where: { id: rule.id },
          data: {
            runCount: { increment: 1 },
            lastRunAt: new Date(),
          },
        });
        continue;
      }

      matchedCount++;

      // Execute actions inside a tenant transaction
      try {
        const actionResults = await this.db.run(async (tx) => {
          return ActionExecutor.executeActions(
            tx,
            tenantId,
            ticketId,
            rule.id,
            rule.name,
            rule.actions as unknown as AutomationAction[],
          );
        });

        executedCount++;

        await this.db.unsafeRawClient.automationRun.create({
          data: {
            tenantId,
            ruleId: rule.id,
            ticketId,
            status: 'SUCCESS',
            trigger,
            conditionTrace: evalResult.trace as Prisma.InputJsonValue,
            actionResults: actionResults as unknown as Prisma.InputJsonValue,
            causationId: causationId ?? null,
            durationMs: Date.now() - ruleStart,
          },
        });

        await this.db.unsafeRawClient.automationRule.update({
          where: { id: rule.id },
          data: {
            runCount: { increment: 1 },
            matchCount: { increment: 1 },
            lastRunAt: new Date(),
          },
        });

        this.logger.info(
          { ruleId: rule.id, ruleName: rule.name, ticketId, tenantId },
          'Automation rule successfully executed',
        );

        if (rule.stopOnMatch) {
          this.logger.debug({ ruleId: rule.id }, 'Automation stopOnMatch encountered; stopping');
          break;
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        await this.db.unsafeRawClient.automationRun.create({
          data: {
            tenantId,
            ruleId: rule.id,
            ticketId,
            status: 'FAILED',
            trigger,
            conditionTrace: evalResult.trace as Prisma.InputJsonValue,
            error: errorMessage,
            causationId: causationId ?? null,
            durationMs: Date.now() - ruleStart,
          },
        });

        this.logger.error(
          { err, ruleId: rule.id, ticketId },
          'Automation rule action execution failed',
        );
      }
    }

    this.logger.debug(
      {
        tenantId,
        trigger,
        ticketId,
        rulesEvaluated: rules.length,
        matchedCount,
        executedCount,
        durationMs: Date.now() - startTime,
      },
      'Automation evaluation completed',
    );

    return { evaluated: rules.length, matched: matchedCount, executed: executedCount };
  }

  private async loadTicketForEvaluation(tenantId: string, ticketId: string) {
    return this.db.unsafeRawClient.ticket.findFirst({
      where: { id: ticketId, tenantId, deletedAt: null },
      include: {
        tags: { include: { tag: true } },
        brand: true,
        queue: true,
        team: true,
        requester: { select: { id: true, fullName: true, email: true, kind: true } },
        assignee: { select: { id: true, fullName: true, email: true } },
        diagnosticBundle: {
          select: {
            id: true,
            browserName: true,
            osName: true,
            deviceType: true,
            jsErrorCount: true,
            consoleErrorCount: true,
            networkFailureCount: true,
          },
        },
      },
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { resolveAssignmentCapability } from '@abi-desk/rbac';
import { type Logger } from 'pino';
import { AuditService } from '../../common/audit/audit.service';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import {
  type TenantTransaction,
  TenantPrismaService,
} from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { TicketService } from '../tickets/ticket.service';
import { toPolicySubject } from '../tickets/ticket-scope';
import { MailService } from '../../infra/mail/mail.service';
import { type AssignDto, type BulkUpdateDto } from './workflow.dto';

/** Statuses that still count against an agent's workload. */
const ACTIVE_STATUSES = [
  'NEW',
  'TRIAGE',
  'OPEN',
  'PENDING_CUSTOMER',
  'ON_HOLD',
  'ESCALATED_L2',
  'ESCALATED_L3',
  'IN_DEVELOPMENT',
  'IN_QA',
  'PENDING_RELEASE',
  'RELEASED',
  'PENDING_VERIFICATION',
  'REOPENED',
] as const;

export interface BulkOutcome {
  ticketId: string;
  number?: string;
  ok: boolean;
  error?: string;
}

@Injectable()
export class AssignmentService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly tickets: TicketService,
    private readonly audit: AuditService,
    private readonly mailService: MailService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'AssignmentService' });
  }

  /**
   * Assigns a ticket to an agent, a queue, or a team.
   *
   * This is where the requirements' "Queue" cell is enforced. A Tenant Admin holds
   * `ticket:assign:queue` but not `ticket:assign:agent`, so they may route work into a
   * queue and let it distribute, but may not hand it to a named person. Support tiers
   * hold both.
   */
  async assign(principal: AuthenticatedPrincipal, ticketId: string, dto: AssignDto) {
    const tenantId = this.requireTenant(principal);
    const ticket = await this.tickets.findByIdOrThrow(principal, ticketId);

    const capability = resolveAssignmentCapability(toPolicySubject(principal));

    if (!capability.toQueue && !capability.toAgent) {
      throw AppException.permissionDenied('You may not assign tickets.', {
        roles: principal.roles,
      });
    }

    // Naming an agent requires the stronger permission. `null` is an unassignment,
    // which is a queue-level action and stays allowed.
    const namesAnAgent = dto.assigneeId !== undefined && dto.assigneeId !== null;

    if (namesAnAgent && !capability.toAgent) {
      throw AppException.permissionDenied(
        'Your role may route tickets to a queue but not assign them to a specific agent.',
        { roles: principal.roles, required: 'ticket:assign:agent' },
      );
    }

    const outcome = await this.prisma.run(async (tx) => {
      let assigneeId = dto.assigneeId ?? null;
      let queueId = dto.queueId ?? ticket.queueId ?? null;
      let teamId = dto.teamId ?? ticket.teamId ?? null;

      if (dto.queueId) {
        const queue = await tx.queue.findFirst({
          where: { id: dto.queueId, tenantId, isActive: true },
          select: { id: true, teamId: true, routing: true, name: true },
        });

        if (!queue) {
          throw AppException.unprocessable('Unknown or inactive queue.', [
            { path: 'queueId', message: 'not found for this tenant' },
          ]);
        }

        queueId = queue.id;
        // A queue's team is inherited unless the caller overrode it explicitly.
        teamId = dto.teamId ?? queue.teamId ?? teamId;
      }

      if (dto.teamId) {
        const team = await tx.team.findFirst({
          where: { id: dto.teamId, tenantId, isActive: true },
          select: { id: true },
        });

        if (!team) {
          throw AppException.unprocessable('Unknown or inactive team.', [
            { path: 'teamId', message: 'not found for this tenant' },
          ]);
        }

        teamId = team.id;
      }

      if (dto.assigneeId) {
        // Verified inside the tenant so an id from another tenant cannot be attached.
        const agent = await tx.user.findFirst({
          where: {
            id: dto.assigneeId,
            tenantId,
            kind: 'STAFF',
            status: 'ACTIVE',
            deletedAt: null,
          },
          select: { id: true },
        });

        if (!agent) {
          throw AppException.unprocessable('Unknown or inactive agent.', [
            { path: 'assigneeId', message: 'not an active staff member of this tenant' },
          ]);
        }

        assigneeId = agent.id;
      }

      if (dto.autoAssign) {
        assigneeId = await this.selectLeastLoadedAgent(tx, tenantId, teamId);

        if (!assigneeId) {
          // Left in the queue rather than failing: an unstaffed queue is a real
          // operational state, and the ticket must not be lost because of it.
          this.logger.warn(
            { ticketId, tenantId, teamId },
            'Auto-assignment found no available agent; ticket left queued',
          );
        }
      }

      const updated = await tx.ticket.update({
        where: { id: ticketId },
        data: { assigneeId, queueId, teamId, lastActivityAt: new Date() },
        select: {
          number: true,
          assignee: { select: { id: true, fullName: true, email: true } },
          queue: { select: { id: true, name: true } },
          team: { select: { id: true, name: true } },
        },
      });

      const previousAssignee = ticket.assignee?.id ?? null;

      if (previousAssignee !== assigneeId) {
        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: assigneeId ? 'ASSIGNED' : 'UNASSIGNED',
            actorId: principal.userId,
            actorType: 'USER',
            fromValue: ticket.assignee?.fullName ?? null,
            toValue: updated.assignee?.fullName ?? null,
            metadata: { autoAssigned: dto.autoAssign === true },
          },
        });
      }

      if ((ticket.queueId ?? null) !== queueId) {
        await tx.ticketEvent.create({
          data: {
            tenantId,
            ticketId,
            type: 'QUEUE_CHANGED',
            actorId: principal.userId,
            actorType: 'USER',
            toValue: updated.queue?.name ?? null,
          },
        });
      }

      await tx.outboxEvent.create({
        data: {
          tenantId,
          eventType: 'ticket.assigned',
          aggregateType: 'ticket',
          aggregateId: ticketId,
          payload: { ticketId, assigneeId, queueId, teamId, actorId: principal.userId },
        },
      });

      return updated;
    });

    await this.audit.record({
      action: 'ticket.assigned',
      resourceType: 'ticket',
      resourceId: ticketId,
      resourceLabel: outcome.number,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
      changes: {
        assigneeId: { from: ticket.assignee?.id ?? null, to: outcome.assignee?.id ?? null },
      },
    });

    return outcome;
  }

  /**
   * Applies one change set to many tickets.
   *
   * Deliberately not all-or-nothing. Bulk actions are used on filtered selections
   * where a few rows will legitimately refuse the change (already closed, out of
   * scope, illegal transition), and failing the whole batch for one of them makes the
   * feature useless. Each ticket is processed in its own transaction and reported
   * individually, so the caller can see exactly what happened.
   */
  async bulkUpdate(
    principal: AuthenticatedPrincipal,
    dto: BulkUpdateDto,
  ): Promise<{ applied: number; failed: number; results: BulkOutcome[] }> {
    const tenantId = this.requireTenant(principal);

    // Naming an agent in a bulk change needs the same permission as doing it singly.
    const capability = resolveAssignmentCapability(toPolicySubject(principal));

    if (dto.assigneeId && !capability.toAgent) {
      throw AppException.permissionDenied('Your role may not assign tickets to a specific agent.', {
        required: 'ticket:assign:agent',
      });
    }

    const results: BulkOutcome[] = [];

    const targetStatus = dto.toStatus || dto.status;

    for (const ticketId of [...new Set(dto.ticketIds)]) {
      try {
        // Scope is re-checked per ticket, so a bulk request cannot be used to touch
        // rows the caller could not have fetched individually.
        const ticket = await this.tickets.findByIdOrThrow(principal, ticketId);

        if (targetStatus || dto.priority || dto.assigneeId !== undefined || dto.queueId !== undefined) {
          await this.prisma.run(async (tx) => {
            await tx.ticket.update({
              where: { id: ticketId },
              data: {
                ...(targetStatus ? { status: targetStatus } : {}),
                ...(dto.priority ? { priority: dto.priority } : {}),
                ...(dto.assigneeId !== undefined ? { assigneeId: dto.assigneeId } : {}),
                ...(dto.queueId !== undefined ? { queueId: dto.queueId } : {}),
                lastActivityAt: new Date(),
              },
            });

            if (targetStatus && targetStatus !== ticket.status) {
              await tx.ticketEvent.create({
                data: {
                  tenantId,
                  ticketId,
                  type: 'STATUS_CHANGED',
                  actorId: principal.userId,
                  actorType: 'USER',
                  fromValue: ticket.status,
                  toValue: targetStatus,
                  metadata: { bulk: true },
                },
              });
            }

            if (dto.priority && dto.priority !== ticket.priority) {
              await tx.ticketEvent.create({
                data: {
                  tenantId,
                  ticketId,
                  type: 'PRIORITY_CHANGED',
                  actorId: principal.userId,
                  actorType: 'USER',
                  fromValue: ticket.priority,
                  toValue: dto.priority,
                  metadata: { bulk: true },
                },
              });
            }
          });
        }

        if (dto.addTags?.length) {
          await this.tickets.addTags(principal, ticketId, dto.addTags);
        }

        if (dto.comment) {
          await this.tickets.addComment(principal, ticketId, {
            body: dto.comment,
            visibility: 'PUBLIC',
            bodyFormat: 'MARKDOWN',
          });
        }

        // Send automated status email to customer if status changed
        if (targetStatus && ['RESOLVED', 'CLOSED', 'AWAITING_CUSTOMER_CONFIRMATION', 'PENDING_CUSTOMER'].includes(targetStatus)) {
          this.sendStatusEmail(ticketId, targetStatus, dto.comment);
        }

        results.push({ ticketId, number: ticket.number, ok: true });
      } catch (error: unknown) {
        results.push({
          ticketId,
          ok: false,
          error:
            error instanceof AppException
              ? error.message
              : error instanceof Error
                ? error.message
                : 'Unknown error',
        });
      }
    }

    const applied = results.filter((result) => result.ok).length;

    await this.audit.record({
      action: 'ticket.bulk_updated',
      resourceType: 'ticket',
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
      changes: {
        requested: { from: null, to: dto.ticketIds.length },
        applied: { from: null, to: applied },
      },
    });

    this.logger.info(
      { tenantId, actorId: principal.userId, requested: dto.ticketIds.length, applied },
      'Bulk update completed',
    );

    return { applied, failed: results.length - applied, results };
  }

  private async sendStatusEmail(ticketId: string, toStatus: string, comment?: string) {
    try {
      const ticket = await this.prisma.client.ticket.findUnique({
        where: { id: ticketId },
        include: {
          requester: { select: { email: true, fullName: true } },
          brand: { select: { name: true, supportEmail: true } },
        },
      });

      if (!ticket?.requester?.email) return;

      const brandName = ticket.brand?.name || 'Support Team';
      const formattedStatus = toStatus.replace(/_/g, ' ');
      let subject = `[Ticket #${ticket.number}] ${formattedStatus}: ${ticket.subject}`;
      let title = `Ticket Status: ${formattedStatus}`;
      let message = `Your ticket status has been updated to <strong>${formattedStatus}</strong>.`;

      if (toStatus === 'RESOLVED') {
        subject = `[Ticket #${ticket.number}] Resolved: ${ticket.subject}`;
        title = 'Ticket Resolved';
        message = `Great news! Your ticket <strong>#${ticket.number}</strong> has been marked as <strong>Resolved</strong> by our support team.`;
      } else if (toStatus === 'CLOSED') {
        subject = `[Ticket #${ticket.number}] Closed: ${ticket.subject}`;
        title = 'Ticket Closed';
        message = `Your ticket <strong>#${ticket.number}</strong> has been marked as <strong>Closed</strong>. If you still need help or your issue returns, simply reply to this email to reopen it.`;
      } else if (toStatus === 'AWAITING_CUSTOMER_CONFIRMATION' || toStatus === 'PENDING_CUSTOMER') {
        subject = `[Ticket #${ticket.number}] Awaiting Your Response: ${ticket.subject}`;
        title = 'Awaiting Your Input';
        message = `Our support team has updated ticket <strong>#${ticket.number}</strong> and is awaiting your response. Please reply to this email with any details requested.`;
      } else if (toStatus === 'REOPENED') {
        subject = `[Ticket #${ticket.number}] Reopened: ${ticket.subject}`;
        title = 'Ticket Reopened';
        message = `Your ticket <strong>#${ticket.number}</strong> has been reopened and placed back in the active support queue.`;
      } else if (toStatus === 'ON_HOLD') {
        subject = `[Ticket #${ticket.number}] On Hold: ${ticket.subject}`;
        title = 'Ticket On Hold';
        message = `Your ticket <strong>#${ticket.number}</strong> has been placed on hold while our team coordinates next steps.`;
      } else if (toStatus.startsWith('ESCALATED') || toStatus.startsWith('IN_DEV') || toStatus === 'IN_QA') {
        subject = `[Ticket #${ticket.number}] In Progress: ${ticket.subject}`;
        title = 'Ticket In Progress';
        message = `Your ticket <strong>#${ticket.number}</strong> has been escalated to our engineering and senior support specialists for in-depth investigation.`;
      }

      await this.mailService.send({
        to: { email: ticket.requester.email, name: ticket.requester.fullName },
        subject,
        text: `${title}\n\nHello ${ticket.requester.fullName},\n\n${message.replace(/<[^>]+>/g, '')}\n\n${comment ? `Note: ${comment}\n\n` : ''}Best regards,\n${brandName}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
            <div style="margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px;">
              <h2 style="margin: 0; color: #2563eb; font-size: 20px;">${title}</h2>
            </div>
            <p style="font-size: 15px; margin-bottom: 16px;">Hello <strong>${ticket.requester.fullName}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 16px;">
              ${message}
            </p>
            ${
              comment
                ? `
            <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
              <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 600; text-transform: uppercase;">Note from Support Team:</p>
              <p style="margin: 6px 0 0 0; font-size: 14px; color: #1e293b; white-space: pre-wrap;">${comment}</p>
            </div>
            `
                : ''
            }
            <div style="background-color: #f1f5f9; padding: 12px 16px; margin-bottom: 20px; border-radius: 6px;">
              <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Ticket:</strong> #${ticket.number} - ${ticket.subject}</p>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #475569;"><strong>Current Status:</strong> <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: #e2e8f0; font-weight: bold; font-size: 11px;">${toStatus}</span></p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
              You can reply directly to this email at any time to communicate with our team.
            </p>
          </div>
        `,
        tag: `ticket.bulk_${toStatus.toLowerCase()}`,
        ...(ticket.brand?.supportEmail ? { replyTo: ticket.brand.supportEmail } : {}),
      });
    } catch (err) {
      this.logger.error({ err, ticketId }, 'Failed to send bulk status update email');
    }
  }

  // -------------------------------------------------------------------------

  private requireTenant(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantId) {
      throw new AppException(
        ErrorCode.TENANT_CONTEXT_MISSING,
        400,
        'This operation requires a tenant context.',
      );
    }
    return principal.tenantId;
  }

  /**
   * Picks the agent with the fewest active tickets.
   *
   * Least-loaded rather than round-robin: round-robin distributes ticket *counts*
   * evenly but ignores that some agents are already buried, which is how one person
   * ends up with every hard ticket. Agents who are unavailable, or already at their
   * declared concurrency limit, are excluded.
   */
  private async selectLeastLoadedAgent(
    tx: TenantTransaction,
    tenantId: string,
    teamId: string | null,
  ): Promise<string | null> {
    const candidates = await tx.user.findMany({
      where: {
        tenantId,
        kind: 'STAFF',
        status: 'ACTIVE',
        isAvailable: true,
        deletedAt: null,
        ...(teamId ? { teamMembers: { some: { teamId } } } : {}),
      },
      select: { id: true, maxConcurrentTickets: true },
    });

    if (candidates.length === 0) return null;

    const loads = await tx.ticket.groupBy({
      by: ['assigneeId'],
      where: {
        tenantId,
        assigneeId: { in: candidates.map((candidate) => candidate.id) },
        status: { in: [...ACTIVE_STATUSES] },
        deletedAt: null,
      },
      _count: { _all: true },
    });

    const loadByAgent = new Map(loads.map((row) => [row.assigneeId, row._count._all] as const));

    const eligible = candidates
      .map((candidate) => ({
        id: candidate.id,
        load: loadByAgent.get(candidate.id) ?? 0,
        cap: candidate.maxConcurrentTickets,
      }))
      .filter((candidate) => candidate.cap === null || candidate.load < candidate.cap)
      // Sort by load, then by id so the choice is deterministic when loads tie -
      // otherwise the same agent can be picked repeatedly by chance.
      .sort((a, b) => a.load - b.load || a.id.localeCompare(b.id));

    return eligible[0]?.id ?? null;
  }
}

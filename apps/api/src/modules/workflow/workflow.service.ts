import { Inject, Injectable } from '@nestjs/common';
import {
  type Prisma,
  type SupportTier,
  type TicketEventType,
  type TicketStatus,
  type WorkflowTransition,
} from '@abi-desk/db';
import { nextTier, TIER_ORDER } from '@abi-desk/rbac';
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
import { SlaService } from '../sla/sla.service';
import { TicketService } from '../tickets/ticket.service';
import { MailService } from '../../infra/mail/mail.service';
import { type ConfirmResolutionDto, type EscalateDto, type TransitionDto } from './workflow.dto';

/** A move the caller is actually allowed to make right now. */
export interface AvailableTransition {
  toStatus: TicketStatus;
  label: string;
  targetTier: SupportTier | null;
  requiresComment: boolean;
  requiresApproval: boolean;
  isTerminal: boolean;
}

export type TransitionResult =
  | { kind: 'applied'; status: TicketStatus; tier: SupportTier; number: string }
  | { kind: 'pending_approval'; approvalRequestId: string; number: string };

/**
 * Fields whose value depends on the status being entered.
 *
 * Kept as one table rather than scattered `if` statements because these timestamps
 * feed SLA clocks and every analytic in the product - a status change that forgets to
 * stamp `resolvedAt` silently corrupts resolution-time reporting, and that is very
 * hard to notice after the fact.
 */
// Typed as the *unchecked* update input because the caller also sets scalar foreign
// keys (`assigneeId`, `queueId`) in the same object. Prisma models checked and
// unchecked updates as an XOR, so mixing a relation-style input with a raw scalar id
// is rejected - keeping both halves unchecked is what makes them composable.
function statusSideEffects(status: TicketStatus, now: Date): Prisma.TicketUncheckedUpdateInput {
  switch (status) {
    case 'RESOLVED':
      return { resolvedAt: now };
    case 'CLOSED':
      return { closedAt: now };
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      // Starts the auto-close countdown (TenantSetting.autoCloseAfterDays).
      return { confirmationRequestedAt: now };
    case 'REOPENED':
      return {
        reopenedAt: now,
        reopenCount: { increment: 1 },
        // Cleared so a reopened ticket is not reported as resolved.
        resolvedAt: null,
        closedAt: null,
        confirmedAt: null,
        confirmationRequestedAt: null,
      };
    case 'CANCELLED':
      return { closedAt: now };
    default:
      return {};
  }
}

/** Timeline event type for a given move, so the trail reads meaningfully. */
function eventTypeFor(to: TicketStatus, tierChanged: boolean): TicketEventType {
  switch (to) {
    case 'RESOLVED':
      return 'RESOLVED';
    case 'CLOSED':
      return 'CLOSED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'REOPENED':
      return 'REOPENED';
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'CONFIRMATION_REQUESTED';
    case 'ESCALATED_L2':
    case 'ESCALATED_L3':
    case 'IN_DEVELOPMENT':
      return 'ESCALATED';
    default:
      return tierChanged ? 'TIER_CHANGED' : 'STATUS_CHANGED';
  }
}

@Injectable()
export class WorkflowService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly tickets: TicketService,
    private readonly audit: AuditService,
    private readonly sla: SlaService,
    private readonly mailService: MailService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'WorkflowService' });
  }

  // =========================================================================
  // Discovery
  // =========================================================================

  /**
   * Moves the caller may make from the ticket's current status.
   *
   * The console renders its action buttons from this, which is what keeps the UI and
   * the server in agreement - a button that appears and then 403s is a bug this
   * endpoint exists to prevent.
   */
  async availableTransitions(
    principal: AuthenticatedPrincipal,
    ticketId: string,
  ): Promise<{ status: TicketStatus; tier: SupportTier; transitions: AvailableTransition[] }> {
    const ticket = await this.tickets.findByIdOrThrow(principal, ticketId);
    const tenantId = this.requireTenant(principal);

    const candidates = await this.loadTransitions(this.prisma.client, tenantId, ticket.status);

    const transitions = candidates
      .filter((transition) => this.isPermitted(principal, ticket.tier, transition))
      .map((transition) => ({
        toStatus: transition.toStatus,
        label: transition.label,
        targetTier: transition.targetTier,
        requiresComment: transition.requiresComment,
        requiresApproval: transition.requiresApproval,
        isTerminal: transition.isTerminal,
      }));

    return { status: ticket.status, tier: ticket.tier, transitions };
  }

  // =========================================================================
  // Transition
  // =========================================================================

  /**
   * Applies a status transition.
   *
   * Legality is data, not code: the move must exist as a `workflow_transition` row,
   * and that row carries the permission, the tier restriction and whether sign-off is
   * needed. The documented pipeline has thirteen stages and tenants will want to gate
   * them differently - encoding it in a switch statement would make every variation a
   * deploy.
   */
  async transition(
    principal: AuthenticatedPrincipal,
    ticketId: string,
    dto: TransitionDto,
  ): Promise<TransitionResult> {
    const tenantId = this.requireTenant(principal);
    const ticket = await this.tickets.findByIdOrThrow(principal, ticketId);

    if (ticket.status === dto.toStatus) {
      throw AppException.conflict(`Ticket ${ticket.number} is already ${dto.toStatus}.`, {
        ticketId,
        status: ticket.status,
      });
    }

    const result = await this.prisma.run(async (tx) => {
      const transition = await this.findTransition(tx, tenantId, ticket.status, dto.toStatus);

      if (!transition) {
        // An illegal move, not a missing permission. Naming both states makes this
        // debuggable from the response alone.
        throw AppException.unprocessable(
          `Cannot move ticket from ${ticket.status} to ${dto.toStatus}.`,
          [{ path: 'toStatus', message: 'not a legal transition from the current status' }],
          ErrorCode.CONFLICT,
        );
      }

      if (!this.hasPermission(principal, transition)) {
        throw AppException.permissionDenied(
          `Moving a ticket to ${dto.toStatus} requires ${transition.requiredPermission}.`,
          { ticketId, required: transition.requiredPermission, roles: principal.roles },
        );
      }

      if (transition.requiredTier && transition.requiredTier !== ticket.tier) {
        throw AppException.unprocessable(
          `This move is only available to a ticket at tier ${transition.requiredTier}; ` +
            `ticket ${ticket.number} is at ${ticket.tier}.`,
          [{ path: 'toStatus', message: `requires tier ${transition.requiredTier}` }],
        );
      }

      if (transition.requiresComment && !dto.comment) {
        throw AppException.unprocessable(
          `Moving to ${dto.toStatus} requires a comment explaining why.`,
          [{ path: 'comment', message: 'required for this transition' }],
        );
      }

      // -- Approval gate ---------------------------------------------------
      if (transition.requiresApproval) {
        const approval = await this.findUsableApproval(tx, ticketId, transition);

        if (!approval) {
          const request = await this.openApprovalRequest(tx, {
            tenantId,
            ticketId,
            transition,
            requestedById: principal.userId,
            reason: dto.comment,
          });

          return {
            kind: 'pending_approval' as const,
            approvalRequestId: request.id,
            number: ticket.number,
          };
        }

        // Consumed by recording its id on the resulting timeline event, so the same
        // sign-off cannot authorise a second move.
        return this.applyTransition(tx, {
          principal,
          tenantId,
          ticket,
          transition,
          comment: dto.comment,
          assigneeId: dto.assigneeId,
          queueId: dto.queueId,
          approvalRequestId: approval.id,
        });
      }

      return this.applyTransition(tx, {
        principal,
        tenantId,
        ticket,
        transition,
        comment: dto.comment,
        assigneeId: dto.assigneeId,
        queueId: dto.queueId,
      });
    });

    await this.audit.record({
      action:
        result.kind === 'pending_approval'
          ? 'ticket.transition_pending_approval'
          : 'ticket.status_changed',
      resourceType: 'ticket',
      resourceId: ticketId,
      resourceLabel: ticket.number,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
      changes: { status: { from: ticket.status, to: dto.toStatus } },
    });

    if (result.kind !== 'pending_approval') {
      this.sendStatusNotificationEmail(tenantId, ticketId, dto.toStatus, dto.comment);
    }

    return result;
  }

  /**
   * Escalates to the next tier.
   *
   * A convenience over `transition` that resolves the correct target status from the
   * ticket's current tier, so a client does not have to know that L1 escalates to
   * `ESCALATED_L2` while L3 hands off to `IN_DEVELOPMENT`.
   */
  async escalate(
    principal: AuthenticatedPrincipal,
    ticketId: string,
    dto: EscalateDto,
  ): Promise<TransitionResult> {
    const tenantId = this.requireTenant(principal);
    const ticket = await this.tickets.findByIdOrThrow(principal, ticketId);

    const targetTier = dto.toTier ?? nextTier(ticket.tier);

    if (!targetTier) {
      throw AppException.unprocessable(
        `Ticket ${ticket.number} is already at the highest tier (${ticket.tier}).`,
        [{ path: 'toTier', message: 'no higher tier exists' }],
      );
    }

    if (TIER_ORDER.indexOf(targetTier) <= TIER_ORDER.indexOf(ticket.tier)) {
      throw AppException.unprocessable(
        `${targetTier} is not above the ticket's current tier (${ticket.tier}).`,
        [{ path: 'toTier', message: 'must be a higher tier' }],
      );
    }

    // Find the legal move out of the current status that lands on the target tier.
    const candidates = await this.loadTransitions(this.prisma.client, tenantId, ticket.status);
    const match = candidates.find((transition) => transition.targetTier === targetTier);

    if (!match) {
      throw AppException.unprocessable(
        `No escalation path from ${ticket.status} to tier ${targetTier}.`,
        [{ path: 'toTier', message: 'no transition configured' }],
      );
    }

    return this.transition(principal, ticketId, {
      toStatus: match.toStatus,
      comment: dto.reason,
    });
  }

  /**
   * The customer's confirm-or-reject step.
   *
   * Uses `ticket:confirm_resolution`, never `ticket:close`. The requirements give
   * Guest ✗ on Close while the workflow still ends in Customer Confirmation, so this
   * is a separate capability rather than a back door into closing.
   */
  async confirmResolution(
    principal: AuthenticatedPrincipal,
    ticketId: string,
    dto: ConfirmResolutionDto,
  ): Promise<TransitionResult> {
    const ticket = await this.tickets.findByIdOrThrow(principal, ticketId);

    if (ticket.status !== 'AWAITING_CUSTOMER_CONFIRMATION') {
      throw AppException.conflict(
        `Ticket ${ticket.number} is not awaiting confirmation (it is ${ticket.status}).`,
        { ticketId, status: ticket.status },
      );
    }

    // Only the person who reported it may confirm. Staff holding the permission must
    // not be able to confirm on the customer's behalf - that would make the
    // confirmation step meaningless.
    if (ticket.requester.id !== principal.userId) {
      throw AppException.permissionDenied(
        'Only the requester may confirm or reject a resolution.',
        { ticketId, requesterId: ticket.requester.id },
      );
    }

    const result = await this.transition(principal, ticketId, {
      toStatus: dto.confirmed ? 'RESOLVED' : 'REOPENED',
      ...(dto.comment ? { comment: dto.comment } : {}),
    });

    if (dto.confirmed) {
      await this.prisma.client.ticket.update({
        where: { id: ticketId },
        data: { confirmedAt: new Date() },
      });
    }

    return result;
  }

  // =========================================================================
  // Internals
  // =========================================================================

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
   * Loads legal moves out of a status.
   *
   * A tenant-specific row overrides the product default for the same status pair, so
   * a tenant can gate or relabel a stage without the product being patched.
   */
  private async loadTransitions(
    client: Pick<TenantTransaction, 'workflowTransition'>,
    tenantId: string,
    fromStatus: TicketStatus,
  ): Promise<WorkflowTransition[]> {
    const rows = await client.workflowTransition.findMany({
      where: {
        fromStatus,
        enabled: true,
        OR: [{ tenantId }, { tenantId: null }],
      },
      orderBy: [{ sortOrder: 'asc' }, { toStatus: 'asc' }],
    });

    // Tenant rows win. Collapsing here rather than in SQL keeps the precedence rule
    // in one readable place.
    const byTarget = new Map<TicketStatus, WorkflowTransition>();

    for (const row of rows) {
      const existing = byTarget.get(row.toStatus);
      if (!existing || (row.tenantId !== null && existing.tenantId === null)) {
        byTarget.set(row.toStatus, row);
      }
    }

    return [...byTarget.values()].sort((a, b) => a.sortOrder - b.sortOrder);
  }

  private async findTransition(
    tx: TenantTransaction,
    tenantId: string,
    fromStatus: TicketStatus,
    toStatus: TicketStatus,
  ): Promise<WorkflowTransition | undefined> {
    const rows = await this.loadTransitions(tx, tenantId, fromStatus);
    return rows.find((row) => row.toStatus === toStatus);
  }

  private hasPermission(
    principal: AuthenticatedPrincipal,
    transition: WorkflowTransition,
  ): boolean {
    return principal.permissions.has(transition.requiredPermission);
  }

  private isPermitted(
    principal: AuthenticatedPrincipal,
    ticketTier: SupportTier,
    transition: WorkflowTransition,
  ): boolean {
    if (!this.hasPermission(principal, transition)) return false;
    if (transition.requiredTier && transition.requiredTier !== ticketTier) return false;
    return true;
  }

  /**
   * An approval that authorises this move and has not already been spent.
   *
   * "Spent" is determined by whether a timeline event already references it. Reusing a
   * single sign-off for repeated moves would defeat the gate the first time a ticket
   * bounced back into the same status.
   */
  private async findUsableApproval(
    tx: TenantTransaction,
    ticketId: string,
    transition: WorkflowTransition,
  ): Promise<{ id: string } | null> {
    const approved = await tx.approvalRequest.findFirst({
      where: {
        ticketId,
        fromStatus: transition.fromStatus,
        toStatus: transition.toStatus,
        status: 'APPROVED',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (!approved) return null;

    // Only an *applied transition* consumes an approval. The approval lifecycle events
    // (requested, granted, rejected) also carry the id, so they must be excluded -
    // otherwise the APPROVAL_REQUESTED event written when the request was opened makes
    // every approval look spent the instant it is created, and the gate never releases.
    const alreadyUsed = await tx.ticketEvent.findFirst({
      where: {
        ticketId,
        type: { notIn: ['APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED'] },
        metadata: { path: ['approvalRequestId'], equals: approved.id },
      },
      select: { id: true },
    });

    return alreadyUsed ? null : approved;
  }

  /** Opens a sign-off request and records it on the timeline. */
  private async openApprovalRequest(
    tx: TenantTransaction,
    input: {
      tenantId: string;
      ticketId: string;
      transition: WorkflowTransition;
      requestedById: string;
      reason?: string;
    },
  ): Promise<{ id: string }> {
    const existing = await tx.approvalRequest.findFirst({
      where: {
        ticketId: input.ticketId,
        fromStatus: input.transition.fromStatus,
        toStatus: input.transition.toStatus,
        status: 'PENDING',
      },
      select: { id: true },
    });

    // Idempotent: asking twice must not stack up duplicate requests for approvers to
    // wade through. A partial unique index enforces this at the database level too.
    if (existing) return existing;

    const request = await tx.approvalRequest.create({
      data: {
        tenantId: input.tenantId,
        ticketId: input.ticketId,
        fromStatus: input.transition.fromStatus,
        toStatus: input.transition.toStatus,
        mode: input.transition.approvalMode,
        approverRoleKey: input.transition.approverRoleKey,
        requestedById: input.requestedById,
        reason: input.reason ?? null,
      },
      select: { id: true },
    });

    await tx.ticketEvent.create({
      data: {
        tenantId: input.tenantId,
        ticketId: input.ticketId,
        type: 'APPROVAL_REQUESTED',
        actorId: input.requestedById,
        actorType: 'USER',
        toValue: input.transition.toStatus,
        metadata: {
          approvalRequestId: request.id,
          approverRoleKey: input.transition.approverRoleKey,
        },
      },
    });

    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ticket.approval_requested',
        aggregateType: 'ticket',
        aggregateId: input.ticketId,
        payload: {
          ticketId: input.ticketId,
          approvalRequestId: request.id,
          toStatus: input.transition.toStatus,
        },
      },
    });

    this.logger.info(
      { ticketId: input.ticketId, approvalRequestId: request.id },
      'Transition blocked pending approval',
    );

    return request;
  }

  /** Writes the status change, its side effects, the timeline entry and the event. */
  private async applyTransition(
    tx: TenantTransaction,
    input: {
      principal: AuthenticatedPrincipal;
      tenantId: string;
      ticket: { id: string; number: string; status: TicketStatus; tier: SupportTier };
      transition: WorkflowTransition;
      comment?: string;
      assigneeId?: string | null;
      queueId?: string | null;
      approvalRequestId?: string;
    },
  ): Promise<TransitionResult> {
    const now = new Date();
    const { transition, ticket, principal } = input;

    const newTier = transition.targetTier ?? ticket.tier;
    const tierChanged = newTier !== ticket.tier;
    const isEscalation =
      tierChanged && TIER_ORDER.indexOf(newTier) > TIER_ORDER.indexOf(ticket.tier);

    const updated = await tx.ticket.update({
      where: { id: ticket.id },
      data: {
        status: transition.toStatus,
        tier: newTier,
        lastActivityAt: now,
        ...(isEscalation ? { escalationCount: { increment: 1 } } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
        ...(input.queueId !== undefined ? { queueId: input.queueId } : {}),
        ...statusSideEffects(transition.toStatus, now),
      },
      select: { number: true, status: true, tier: true },
    });

    if (transition.toStatus === 'PENDING_CUSTOMER') {
      await this.sla.pauseClocksForTicket(tx, input.tenantId, ticket.id);
    } else if (ticket.status === 'PENDING_CUSTOMER') {
      await this.sla.resumeClocksForTicket(tx, input.tenantId, ticket.id);
    }

    if (transition.toStatus === 'RESOLVED') {
      await this.sla.recordResolution(tx, input.tenantId, ticket.id, now);
    }

    if (input.comment) {
      // Recorded as a public comment so the customer can see why their ticket moved;
      // internal-only rationale belongs in an internal note instead.
      await tx.ticketComment.create({
        data: {
          tenantId: input.tenantId,
          ticketId: ticket.id,
          authorId: principal.userId,
          visibility: 'PUBLIC',
          body: input.comment,
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: { publicCommentCount: { increment: 1 } },
      });
    }

    await tx.ticketEvent.create({
      data: {
        tenantId: input.tenantId,
        ticketId: ticket.id,
        type: eventTypeFor(transition.toStatus, tierChanged),
        actorId: principal.userId,
        actorType: 'USER',
        fromValue: ticket.status,
        toValue: transition.toStatus,
        metadata: {
          label: transition.label,
          ...(tierChanged ? { fromTier: ticket.tier, toTier: newTier } : {}),
          ...(input.approvalRequestId ? { approvalRequestId: input.approvalRequestId } : {}),
        },
      },
    });

    await tx.outboxEvent.create({
      data: {
        tenantId: input.tenantId,
        eventType: 'ticket.status_changed',
        aggregateType: 'ticket',
        aggregateId: ticket.id,
        payload: {
          ticketId: ticket.id,
          number: updated.number,
          fromStatus: ticket.status,
          toStatus: transition.toStatus,
          fromTier: ticket.tier,
          toTier: newTier,
          isEscalation,
          actorId: principal.userId,
        },
      },
    });

    return {
      kind: 'applied',
      status: updated.status,
      tier: updated.tier,
      number: updated.number,
    };
  }

  /** Sends an automated branded status notification email to the customer. */
  async sendStatusNotificationEmail(
    tenantId: string,
    ticketId: string,
    toStatus: TicketStatus,
    comment?: string,
  ) {
    // Send email for all customer-facing status changes
    if (!['RESOLVED', 'CLOSED', 'AWAITING_CUSTOMER_CONFIRMATION', 'PENDING_CUSTOMER', 'REOPENED', 'ON_HOLD', 'ESCALATED_L2', 'ESCALATED_L3', 'IN_DEVELOPMENT', 'IN_QA'].includes(toStatus)) {
      return;
    }

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
        tag: `ticket.status_${toStatus.toLowerCase()}`,
        ...(ticket.brand?.supportEmail ? { replyTo: ticket.brand.supportEmail } : {}),
      });
    } catch (err) {
      this.logger.error({ err, ticketId }, 'Failed to send status update email');
    }
  }
}

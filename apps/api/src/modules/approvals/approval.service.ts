import { Inject, Injectable } from '@nestjs/common';
import { type ApprovalMode, type ApprovalRequest, type Prisma, type RoleKey } from '@abi-desk/db';
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
import { type DecideApprovalDto, type ListApprovalsDto } from './approval.dto';

/** Shape returned to the approvals inbox. */
const APPROVAL_SELECT = {
  id: true,
  status: true,
  mode: true,
  fromStatus: true,
  toStatus: true,
  approverRoleKey: true,
  approverUserIds: true,
  requestedById: true,
  reason: true,
  requiredCount: true,
  approvedCount: true,
  expiresAt: true,
  remindedAt: true,
  resolvedAt: true,
  createdAt: true,
  ticket: {
    select: {
      id: true,
      number: true,
      subject: true,
      status: true,
      tier: true,
      priority: true,
    },
  },
  decisions: {
    select: {
      id: true,
      decision: true,
      comment: true,
      sequence: true,
      createdAt: true,
      approver: { select: { id: true, fullName: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} satisfies Prisma.ApprovalRequestSelect;

@Injectable()
export class ApprovalService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'ApprovalService' });
  }

  // =========================================================================
  // Reading
  // =========================================================================

  /**
   * The approvals inbox.
   *
   * `mine` (the default) narrows to requests this caller is actually eligible to
   * decide. An inbox showing requests you cannot act on is noise, and it also leaks
   * which tickets are moving through parts of the pipeline you have no part in.
   */
  async list(principal: AuthenticatedPrincipal, query: ListApprovalsDto) {
    const tenantId = this.requireTenant(principal);

    const where: Prisma.ApprovalRequestWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.ticketId ? { ticketId: query.ticketId } : {}),
    };

    if (query.mine) {
      // Eligible when the request names this user, or names a role they hold, or names
      // nobody at all (in which case any approval-capable user in the tenant may act).
      where.AND = [
        {
          OR: [
            { approverUserIds: { has: principal.userId } },
            ...(principal.roles.length > 0
              ? [{ approverRoleKey: { in: principal.roles as RoleKey[] } }]
              : []),
            { AND: [{ approverRoleKey: null }, { approverUserIds: { isEmpty: true } }] },
          ],
        },
        // Never show a user their own request in "mine": they cannot decide it.
        { requestedById: { not: principal.userId } },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;

    const [requests, total] = await Promise.all([
      this.prisma.client.approvalRequest.findMany({
        where,
        select: APPROVAL_SELECT,
        orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        skip,
        take: query.pageSize,
      }),
      this.prisma.client.approvalRequest.count({ where }),
    ]);

    return {
      approvals: requests,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
    };
  }

  async findByIdOrThrow(principal: AuthenticatedPrincipal, id: string) {
    const tenantId = this.requireTenant(principal);

    const request = await this.prisma.client.approvalRequest.findFirst({
      where: { id, tenantId },
      select: APPROVAL_SELECT,
    });

    if (!request) {
      throw AppException.notFound('Approval request', id);
    }

    return request;
  }

  // =========================================================================
  // Deciding
  // =========================================================================

  /**
   * Records an approve or reject decision.
   *
   * The whole operation is one transaction: the decision row, the recomputed counters,
   * the request's terminal status, the ticket timeline entry and the outbox event. A
   * decision that landed without flipping the request's status would leave a
   * transition permanently gated with no way to tell why.
   */
  async decide(
    principal: AuthenticatedPrincipal,
    id: string,
    dto: DecideApprovalDto,
  ): Promise<{
    status: ApprovalRequest['status'];
    approvedCount: number;
    requiredCount: number;
    satisfied: boolean;
    ticketNumber: string;
  }> {
    const tenantId = this.requireTenant(principal);

    if (dto.decision === 'REJECTED' && !dto.comment) {
      // A rejection without a reason gives the requester nothing to act on, and the
      // audit trail nothing to explain.
      throw AppException.unprocessable('A comment is required when rejecting.', [
        { path: 'comment', message: 'required when rejecting' },
      ]);
    }

    const outcome = await this.prisma.run(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { id, tenantId },
        select: {
          id: true,
          ticketId: true,
          status: true,
          mode: true,
          fromStatus: true,
          toStatus: true,
          approverRoleKey: true,
          approverUserIds: true,
          requestedById: true,
          requiredCount: true,
          approvedCount: true,
          expiresAt: true,
          ticket: { select: { number: true } },
        },
      });

      if (!request) {
        throw AppException.notFound('Approval request', id);
      }

      if (request.status !== 'PENDING') {
        throw AppException.conflict(`This request is already ${request.status.toLowerCase()}.`, {
          approvalRequestId: id,
          status: request.status,
        });
      }

      if (request.expiresAt && request.expiresAt.getTime() <= Date.now()) {
        await tx.approvalRequest.update({
          where: { id },
          data: { status: 'EXPIRED', resolvedAt: new Date() },
        });

        throw new AppException(
          ErrorCode.CONFLICT,
          409,
          'This approval request has expired and must be raised again.',
        );
      }

      this.assertEligible(principal, request);

      // Separation of duties. Without this, the L3 who requests a handover to
      // engineering could approve it themselves and the gate would be decorative.
      if (request.requestedById === principal.userId) {
        throw AppException.permissionDenied(
          'You cannot decide an approval you requested yourself.',
          { approvalRequestId: id },
        );
      }

      const alreadyDecided = await tx.approvalDecision.findFirst({
        where: { requestId: id, approverId: principal.userId },
        select: { id: true },
      });

      if (alreadyDecided) {
        throw AppException.conflict('You have already recorded a decision on this request.', {
          approvalRequestId: id,
        });
      }

      const required = this.effectiveRequiredCount(request.mode, {
        approverUserIds: request.approverUserIds,
        requiredCount: request.requiredCount,
      });

      if (request.mode === 'SEQUENTIAL') {
        this.assertSequentialTurn(principal.userId, request.approverUserIds, request.approvedCount);
      }

      await tx.approvalDecision.create({
        data: {
          tenantId,
          requestId: id,
          approverId: principal.userId,
          decision: dto.decision,
          comment: dto.comment ?? null,
          sequence: request.approvedCount,
        },
      });

      // A single rejection is terminal in every mode: there is no sense in collecting
      // further approvals for something that has already been refused.
      if (dto.decision === 'REJECTED') {
        await tx.approvalRequest.update({
          where: { id },
          data: { status: 'REJECTED', resolvedAt: new Date() },
        });

        await this.recordTicketEvent(tx, {
          tenantId,
          ticketId: request.ticketId,
          type: 'APPROVAL_REJECTED',
          actorId: principal.userId,
          toValue: request.toStatus,
          metadata: { approvalRequestId: id, comment: dto.comment ?? null },
        });

        await this.emit(tx, tenantId, 'ticket.approval_rejected', request.ticketId, {
          ticketId: request.ticketId,
          approvalRequestId: id,
          toStatus: request.toStatus,
          decidedBy: principal.userId,
        });

        return {
          status: 'REJECTED' as const,
          approvedCount: request.approvedCount,
          requiredCount: required,
          satisfied: false,
          ticketNumber: request.ticket.number,
        };
      }

      const approvedCount = request.approvedCount + 1;
      const satisfied = approvedCount >= required;

      await tx.approvalRequest.update({
        where: { id },
        data: {
          approvedCount,
          requiredCount: required,
          ...(satisfied ? { status: 'APPROVED', resolvedAt: new Date() } : {}),
        },
      });

      await this.recordTicketEvent(tx, {
        tenantId,
        ticketId: request.ticketId,
        type: 'APPROVAL_GRANTED',
        actorId: principal.userId,
        toValue: request.toStatus,
        metadata: {
          approvalRequestId: id,
          approvedCount,
          requiredCount: required,
          satisfied,
        },
      });

      if (satisfied) {
        // The requester can now retry the transition. Deliberately not applied
        // automatically: the person who asked should choose the moment, and the
        // ticket may have moved on since.
        await this.emit(tx, tenantId, 'ticket.approval_granted', request.ticketId, {
          ticketId: request.ticketId,
          approvalRequestId: id,
          fromStatus: request.fromStatus,
          toStatus: request.toStatus,
          decidedBy: principal.userId,
        });
      }

      return {
        status: (satisfied ? 'APPROVED' : 'PENDING') as ApprovalRequest['status'],
        approvedCount,
        requiredCount: required,
        satisfied,
        ticketNumber: request.ticket.number,
      };
    });

    await this.audit.record({
      action: dto.decision === 'APPROVED' ? 'approval.granted' : 'approval.rejected',
      resourceType: 'approval_request',
      resourceId: id,
      resourceLabel: outcome.ticketNumber,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
      changes: {
        decision: { from: 'PENDING', to: dto.decision },
        approvedCount: { from: outcome.approvedCount - 1, to: outcome.approvedCount },
      },
    });

    this.logger.info(
      {
        approvalRequestId: id,
        decision: dto.decision,
        satisfied: outcome.satisfied,
        actorId: principal.userId,
      },
      'Approval decision recorded',
    );

    return outcome;
  }

  /** Cancels an outstanding request. Only the requester or an admin may. */
  async cancel(principal: AuthenticatedPrincipal, id: string): Promise<void> {
    const tenantId = this.requireTenant(principal);

    await this.prisma.run(async (tx) => {
      const request = await tx.approvalRequest.findFirst({
        where: { id, tenantId },
        select: { id: true, status: true, requestedById: true, ticketId: true, toStatus: true },
      });

      if (!request) throw AppException.notFound('Approval request', id);

      if (request.status !== 'PENDING') {
        throw AppException.conflict(`This request is already ${request.status.toLowerCase()}.`);
      }

      const isRequester = request.requestedById === principal.userId;
      const isAdmin = principal.permissions.has('admin:workflow:manage');

      if (!isRequester && !isAdmin) {
        throw AppException.permissionDenied(
          'Only the requester or a workflow administrator may cancel an approval request.',
        );
      }

      await tx.approvalRequest.update({
        where: { id },
        data: { status: 'CANCELLED', resolvedAt: new Date() },
      });

      await this.recordTicketEvent(tx, {
        tenantId,
        ticketId: request.ticketId,
        type: 'APPROVAL_REJECTED',
        actorId: principal.userId,
        actorLabel: 'cancelled by requester',
        toValue: request.toStatus,
        metadata: { approvalRequestId: id, cancelled: true },
      });
    });

    await this.audit.record({
      action: 'approval.cancelled',
      resourceType: 'approval_request',
      resourceId: id,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
    });
  }

  // =========================================================================
  // Maintenance (invoked by the worker)
  // =========================================================================

  /**
   * Expires overdue requests.
   *
   * Called on a schedule by the worker. Expiry is also checked lazily when a decision
   * is attempted, so a stalled scheduler cannot let an out-of-date approval be acted
   * on - the job exists to keep the inbox honest, not to enforce the rule.
   */
  async expireOverdue(now = new Date()): Promise<number> {
    const result = await this.prisma.client.approvalRequest.updateMany({
      where: { status: 'PENDING', expiresAt: { not: null, lte: now } },
      data: { status: 'EXPIRED', resolvedAt: now },
    });

    if (result.count > 0) {
      this.logger.info({ expired: result.count }, 'Expired overdue approval requests');
    }

    return result.count;
  }

  /**
   * Requests awaiting a decision for longer than `olderThanMinutes` and not yet
   * reminded. The worker turns these into notifications.
   */
  async findDueForReminder(olderThanMinutes: number, limit = 100) {
    const threshold = new Date(Date.now() - olderThanMinutes * 60_000);

    return this.prisma.client.approvalRequest.findMany({
      where: { status: 'PENDING', remindedAt: null, createdAt: { lte: threshold } },
      take: limit,
      select: {
        id: true,
        tenantId: true,
        ticketId: true,
        toStatus: true,
        approverRoleKey: true,
        approverUserIds: true,
        requestedById: true,
        createdAt: true,
        ticket: { select: { number: true, subject: true } },
      },
    });
  }

  async markReminded(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    await this.prisma.client.approvalRequest.updateMany({
      where: { id: { in: ids } },
      data: { remindedAt: new Date() },
    });
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
   * Whether this caller may decide this request.
   *
   * Holding `approval:decide` is necessary but not sufficient - the request also has
   * to name them, name a role they hold, or name nobody. Treating the permission alone
   * as sufficient would let any approver in the tenant sign off on any gate,
   * regardless of who the workflow said should.
   */
  private assertEligible(
    principal: AuthenticatedPrincipal,
    request: {
      approverRoleKey: RoleKey | null;
      approverUserIds: string[];
    },
  ): void {
    if (!principal.permissions.has('approval:decide')) {
      throw AppException.permissionDenied('Deciding approvals requires approval:decide.', {
        roles: principal.roles,
      });
    }

    const namedDirectly = request.approverUserIds.includes(principal.userId);
    const namedByRole =
      request.approverRoleKey !== null && principal.roles.includes(request.approverRoleKey);
    const openToAnyApprover =
      request.approverRoleKey === null && request.approverUserIds.length === 0;

    if (!namedDirectly && !namedByRole && !openToAnyApprover) {
      throw AppException.permissionDenied('You are not an approver for this request.', {
        required: request.approverRoleKey ?? request.approverUserIds,
        roles: principal.roles,
      });
    }
  }

  /**
   * How many approvals satisfy the request.
   *
   * ANY needs one. ALL and SEQUENTIAL need every named approver - but when no approvers
   * were named individually (the gate created the request from a role), there is nobody
   * to enumerate, so they collapse to one. Falling back to `requiredCount` keeps an
   * explicitly configured value authoritative.
   */
  private effectiveRequiredCount(
    mode: ApprovalMode,
    request: { approverUserIds: string[]; requiredCount: number },
  ): number {
    if (mode === 'ANY') return 1;

    const named = request.approverUserIds.length;
    return Math.max(named, request.requiredCount, 1);
  }

  /**
   * Enforces order in SEQUENTIAL mode.
   *
   * The point of a sequential chain is that a later approver sees the earlier ones'
   * decisions before making their own; letting anyone jump the queue discards that.
   */
  private assertSequentialTurn(
    userId: string,
    approverUserIds: string[],
    approvedCount: number,
  ): void {
    // No explicit chain means there is no order to enforce.
    if (approverUserIds.length === 0) return;

    const expected = approverUserIds[approvedCount];

    if (expected !== undefined && expected !== userId) {
      throw AppException.conflict('This approval is sequential and it is not your turn yet.', {
        position: approvedCount,
        expectedApprover: expected,
      });
    }
  }

  private async recordTicketEvent(
    tx: TenantTransaction,
    event: {
      tenantId: string;
      ticketId: string;
      type: 'APPROVAL_GRANTED' | 'APPROVAL_REJECTED';
      actorId: string;
      actorLabel?: string;
      toValue: string;
      metadata: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.ticketEvent.create({
      data: {
        tenantId: event.tenantId,
        ticketId: event.ticketId,
        type: event.type,
        actorId: event.actorId,
        actorType: 'USER',
        actorLabel: event.actorLabel ?? null,
        toValue: event.toValue,
        metadata: event.metadata,
      },
    });
  }

  private async emit(
    tx: TenantTransaction,
    tenantId: string,
    eventType: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: { tenantId, eventType, aggregateType: 'ticket', aggregateId, payload },
    });
  }
}

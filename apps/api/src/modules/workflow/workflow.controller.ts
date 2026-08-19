import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { type FastifyReply } from 'fastify';
import {
  Audited,
  CurrentUser,
  RequireAnyPermission,
  RequirePermission,
} from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { TicketIdParamDto } from '../tickets/ticket.dto';
import { AssignmentService } from './assignment.service';
import {
  AssignDto,
  BulkUpdateDto,
  ConfirmResolutionDto,
  EscalateDto,
  TransitionDto,
} from './workflow.dto';
import { WorkflowService } from './workflow.service';

/**
 * Workflow endpoints: the documented pipeline
 * L1 → L2 → L3 → Development → QA → Release → Verification → Customer Confirmation → Closed.
 *
 * Route permissions are intentionally broad where the *transition row* carries the
 * real requirement. `POST :id/transitions` is gated on holding any transition-capable
 * permission, and the engine then enforces the specific one the requested move
 * declares. Listing every possible permission on the route would duplicate the
 * workflow table in the controller and drift from it.
 */
@Controller({ path: 'tickets/:id', version: '1' })
export class WorkflowController {
  constructor(
    private readonly workflow: WorkflowService,
    private readonly assignment: AssignmentService,
  ) {}

  /**
   * Moves the caller may make right now.
   *
   * The console renders its buttons from this, so the UI cannot offer an action the
   * server will refuse.
   */
  @Get('transitions')
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  available(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: TicketIdParamDto) {
    return this.workflow.availableTransitions(principal, params.id);
  }

  /**
   * Applies a status transition.
   *
   * Returns 202 when the move needs sign-off: the request was valid and an approval
   * has been opened, but the ticket has not moved yet. A 200 would tell the client
   * something happened that did not.
   */
  @Post('transitions')
  @RequireAnyPermission(
    'ticket:update:tenant',
    'ticket:escalate',
    'ticket:close',
    'ticket:reopen',
    'ticket:confirm_resolution',
    'ticket:transition:development',
    'ticket:transition:qa',
    'ticket:transition:release',
    'ticket:delete',
  )
  @Audited({ action: 'ticket.status_changed', resourceType: 'ticket', idParam: 'id' })
  async transition(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: TransitionDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.workflow.transition(principal, params.id, dto);

    reply.status(result.kind === 'pending_approval' ? HttpStatus.ACCEPTED : HttpStatus.OK);

    return result;
  }

  /** Matrix row: Escalate Ticket. */
  @Post('escalate')
  @RequirePermission('ticket:escalate')
  @Audited({ action: 'ticket.escalated', resourceType: 'ticket', idParam: 'id' })
  async escalate(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: EscalateDto,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.workflow.escalate(principal, params.id, dto);

    reply.status(result.kind === 'pending_approval' ? HttpStatus.ACCEPTED : HttpStatus.OK);

    return result;
  }

  /**
   * The customer's confirm-or-reject step, closing the documented loop.
   *
   * Gated on `ticket:confirm_resolution`, not `ticket:close` — the requirements give
   * Guest ✗ on Close, so confirming has to be its own capability.
   */
  @Post('confirm')
  @RequirePermission('ticket:confirm_resolution')
  @Audited({ action: 'ticket.resolution_confirmed', resourceType: 'ticket', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  confirm(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: ConfirmResolutionDto,
  ) {
    return this.workflow.confirmResolution(principal, params.id, dto);
  }

  /** Matrix row: Assign Ticket — "Queue" for Tenant Admin, full for support tiers. */
  @Post('assign')
  @RequireAnyPermission('ticket:assign:agent', 'ticket:assign:queue')
  @Audited({ action: 'ticket.assigned', resourceType: 'ticket', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  assign(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: AssignDto,
  ) {
    return this.assignment.assign(principal, params.id, dto);
  }
}

/**
 * Bulk operations live on their own path because they act on a set rather than on one
 * ticket, so they do not belong under `/tickets/:id`.
 */
@Controller({ path: 'tickets', version: '1' })
export class BulkTicketController {
  constructor(private readonly assignment: AssignmentService) {}

  /**
   * Matrix row: Bulk Update — ✓ for L2/L3/Dev, "Optional" for L1 (off by default),
   * ✗ for Guest and Tenant Admin.
   *
   * Returns 207-style per-ticket outcomes in a 200 body rather than failing the batch:
   * some rows in a filtered selection will legitimately refuse the change.
   */
  @Post('bulk')
  @RequirePermission('ticket:bulk_update')
  @Audited({ action: 'ticket.bulk_updated', resourceType: 'ticket' })
  @HttpCode(HttpStatus.OK)
  bulk(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: BulkUpdateDto) {
    return this.assignment.bulkUpdate(principal, dto);
  }
}

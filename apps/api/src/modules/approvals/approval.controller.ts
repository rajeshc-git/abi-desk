import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { ApprovalIdParamDto, DecideApprovalDto, ListApprovalsDto } from './approval.dto';
import { ApprovalService } from './approval.service';

/**
 * Approval workflows.
 *
 * The gate itself lives in the workflow engine: a transition marked
 * `requiresApproval` opens a request and refuses to move the ticket. These endpoints
 * are the other half - the approver's inbox and their decision.
 *
 * A granted approval deliberately does not apply the transition automatically. The
 * person who requested it should choose the moment, and by the time sign-off arrives
 * the ticket may have moved on.
 */
@Controller({ path: 'approvals', version: '1' })
export class ApprovalController {
  constructor(private readonly approvals: ApprovalService) {}

  /**
   * The approver's inbox.
   *
   * Defaults to requests this caller can actually decide, excluding their own. Listing
   * requests you cannot act on is noise, and it also reveals work in parts of the
   * pipeline you have no role in.
   */
  @Get()
  @RequirePermission('approval:decide')
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListApprovalsDto) {
    return this.approvals.list(principal, query);
  }

  @Get(':id')
  @RequirePermission('approval:decide')
  findOne(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: ApprovalIdParamDto) {
    return this.approvals.findByIdOrThrow(principal, params.id);
  }

  /**
   * Records an approve or reject decision.
   *
   * Rejection is terminal in every mode - there is no point collecting further
   * approvals for something already refused. Approving is only terminal once the
   * mode's threshold is met (one for ANY, every named approver for ALL and SEQUENTIAL).
   */
  @Post(':id/decision')
  @RequirePermission('approval:decide')
  @Audited({ action: 'approval.decided', resourceType: 'approval_request', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  decide(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: ApprovalIdParamDto,
    @Body() dto: DecideApprovalDto,
  ) {
    return this.approvals.decide(principal, params.id, dto);
  }

  /**
   * Withdraws an outstanding request.
   *
   * Gated on `approval:request` rather than `approval:decide`: cancelling is the
   * requester's action, and the service additionally checks they are the requester
   * (or hold `admin:workflow:manage`).
   */
  @Delete(':id')
  @RequirePermission('approval:request')
  @Audited({ action: 'approval.cancelled', resourceType: 'approval_request', idParam: 'id' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: ApprovalIdParamDto,
  ): Promise<void> {
    await this.approvals.cancel(principal, params.id);
  }
}

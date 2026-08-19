import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { SubmitDiagnosticsDto } from './media.dto';
import { DiagnosticsService } from './diagnostics.service';

/**
 * Diagnostics for one ticket.
 *
 * Three routes with deliberately different gates:
 *
 *   PUT  /diagnostics          `capture:diagnostics`       - anyone whose widget captures
 *   GET  /diagnostics          `capture:diagnostics:read`  - staff only; console + network
 *   GET  /diagnostics/summary  `ticket:read:own`           - counts only, safe for the reporter
 *
 * Submitting and reading are split because the console and network traces can contain
 * data belonging to other users of the host application. A customer's widget must be able
 * to send them; that same customer must not be able to read them back.
 */
@Controller({ path: 'tickets/:ticketId/diagnostics', version: '1' })
export class DiagnosticsController {
  constructor(private readonly diagnostics: DiagnosticsService) {}

  /**
   * Attaches or replaces the bundle for a ticket.
   *
   * `PUT` because there is at most one bundle per ticket and re-submitting is idempotent
   * in effect - a widget retrying after a dropped connection converges rather than
   * failing or creating a duplicate.
   */
  @Put()
  @RequirePermission('capture:diagnostics')
  @Audited({
    action: 'diagnostics.submitted',
    resourceType: 'diagnostic_bundle',
    idParam: 'ticketId',
  })
  submit(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('ticketId') ticketId: string,
    @Body() body: SubmitDiagnosticsDto,
  ) {
    return this.diagnostics.submit(principal, ticketId, body);
  }

  /** The full bundle, including console and network traces. */
  @Get()
  @RequirePermission('capture:diagnostics:read')
  @Audited({
    action: 'diagnostics.viewed',
    resourceType: 'diagnostic_bundle',
    idParam: 'ticketId',
  })
  get(@CurrentUser() principal: AuthenticatedPrincipal, @Param('ticketId') ticketId: string) {
    return this.diagnostics.getForTicket(principal, ticketId);
  }

  /** Counts and environment only. Returns null when nothing was captured. */
  @Get('summary')
  @RequirePermission('ticket:read:own')
  summary(@CurrentUser() principal: AuthenticatedPrincipal, @Param('ticketId') ticketId: string) {
    return this.diagnostics.getSummaryForTicket(principal, ticketId);
  }
}

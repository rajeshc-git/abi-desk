import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  Audited,
  CurrentUser,
  RequireAnyPermission,
  RequirePermission,
} from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { TicketIdParamDto } from '../tickets/ticket.dto';
import {
  type CreateBusinessHoursDto,
  CreateBusinessHoursSchema,
  type CreateHolidayDto,
  CreateHolidaySchema,
  type CreateSlaPolicyDto,
  CreateSlaPolicySchema,
  type SlaPolicyIdParamDto,
  SlaPolicyIdParamSchema,
  type UpdateSlaPolicyDto,
  UpdateSlaPolicySchema,
} from './sla.dto';
import { SlaService } from './sla.service';

@Controller({ path: 'sla', version: '1' })
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  // ---------------------------------------------------------------------------
  // Policies
  // ---------------------------------------------------------------------------

  @Post('policies')
  @RequirePermission('admin:sla:manage')
  @Audited({ action: 'sla_policy.created', resourceType: 'sla_policy' })
  createPolicy(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateSlaPolicyDto) {
    return this.slaService.createPolicy(principal, dto);
  }

  @Get('policies')
  @RequirePermission('admin:sla:manage')
  listPolicies(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.slaService.listPolicies(principal);
  }

  @Get('policies/:id')
  @RequirePermission('admin:sla:manage')
  getPolicy(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: SlaPolicyIdParamDto,
  ) {
    return this.slaService.getPolicy(principal, params.id);
  }

  @Patch('policies/:id')
  @RequirePermission('admin:sla:manage')
  @Audited({ action: 'sla_policy.updated', resourceType: 'sla_policy', idParam: 'id' })
  updatePolicy(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: SlaPolicyIdParamDto,
    @Body() dto: UpdateSlaPolicyDto,
  ) {
    return this.slaService.updatePolicy(principal, params.id, dto);
  }

  @Delete('policies/:id')
  @RequirePermission('admin:sla:manage')
  @Audited({ action: 'sla_policy.deleted', resourceType: 'sla_policy', idParam: 'id' })
  deletePolicy(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: SlaPolicyIdParamDto,
  ) {
    return this.slaService.deletePolicy(principal, params.id);
  }

  // ---------------------------------------------------------------------------
  // Business Hours & Holidays
  // ---------------------------------------------------------------------------

  @Post('business-hours')
  @RequirePermission('admin:sla:manage')
  @Audited({ action: 'business_hours.created', resourceType: 'business_hours' })
  createBusinessHours(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateBusinessHoursDto,
  ) {
    return this.slaService.createBusinessHours(principal, dto);
  }

  @Get('business-hours')
  @RequirePermission('admin:sla:manage')
  listBusinessHours(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.slaService.listBusinessHours(principal);
  }

  @Post('holidays')
  @RequirePermission('admin:sla:manage')
  @Audited({ action: 'holiday.created', resourceType: 'holiday' })
  createHoliday(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateHolidayDto) {
    return this.slaService.createHoliday(principal, dto);
  }
}

@Controller({ path: 'tickets/:id/sla', version: '1' })
export class TicketSlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get()
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  getTicketSlaClocks(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
  ) {
    return this.slaService.getTicketSlaClocks(principal, params.id);
  }
}

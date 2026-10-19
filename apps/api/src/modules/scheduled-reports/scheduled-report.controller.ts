import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { CurrentUser, RequireAnyPermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { ScheduledReportService } from './scheduled-report.service';
import { UpdateScheduledReportDto, SendNowReportDto } from './scheduled-report.dto';
import { AppException } from '../../common/errors/app-exception';

@Controller({ path: 'scheduled-reports', version: '1' })
export class ScheduledReportController {
  constructor(private readonly service: ScheduledReportService) {}

  @Get(':reportType')
  @RequireAnyPermission('report:view:tenant', 'report:view:own', 'ticket:read:tenant', 'tenant:admin')
  getConfig(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('reportType') reportType: string,
  ) {
    this.validateType(reportType);
    const tenantId = this.requireTenant(principal);
    return this.service.getConfig(tenantId, reportType);
  }

  @Put(':reportType')
  @RequireAnyPermission('report:view:tenant', 'tenant:admin', 'ticket:update:tenant')
  saveConfig(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('reportType') reportType: string,
    @Body() dto: UpdateScheduledReportDto,
  ) {
    this.validateType(reportType);
    const tenantId = this.requireTenant(principal);
    return this.service.saveConfig(tenantId, reportType, dto);
  }

  @Post(':reportType/send-now')
  @RequireAnyPermission('report:view:tenant', 'tenant:admin', 'ticket:update:tenant')
  sendNow(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('reportType') reportType: string,
    @Body() dto: SendNowReportDto,
  ) {
    this.validateType(reportType);
    const tenantId = this.requireTenant(principal);
    return this.service.generateAndSendReport(tenantId, reportType, dto);
  }

  private requireTenant(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantId) {
      throw AppException.permissionDenied('Tenant context required.');
    }
    return principal.tenantId;
  }

  private validateType(type: string): asserts type is 'today_tickets' | 'last_30_days' {
    if (type !== 'today_tickets' && type !== 'last_30_days') {
      throw AppException.badRequest(`Invalid report type: '${type}'. Must be 'today_tickets' or 'last_30_days'.`);
    }
  }
}

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type CreateDataSubjectRequestDto,
  CreateDataSubjectRequestSchema,
  type CreateRetentionPolicyDto,
  CreateRetentionPolicySchema,
  type DataSubjectRequestIdParamDto,
  DataSubjectRequestIdParamSchema,
  type RetentionScope,
} from './compliance.dto';
import { ComplianceService } from './compliance.service';

@Controller({ path: 'compliance', version: '1' })
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  @Post('dsr')
  @RequirePermission('admin:dsr:manage')
  @Audited({ action: 'compliance.dsr_created', resourceType: 'dsr' })
  @HttpCode(HttpStatus.CREATED)
  createDsr(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateDataSubjectRequestDto,
  ) {
    return this.complianceService.createDsr(principal, dto);
  }

  @Get('dsr')
  @RequirePermission('admin:dsr:manage')
  listDsrs(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.complianceService.listDsrs(principal);
  }

  @Get('dsr/:id')
  @RequirePermission('admin:dsr:manage')
  getDsr(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: DataSubjectRequestIdParamDto,
  ) {
    return this.complianceService.getDsr(principal, params.id);
  }

  @Post('retention')
  @RequirePermission('admin:retention:manage')
  @Audited({ action: 'compliance.retention_set', resourceType: 'retention_policy' })
  setRetentionPolicy(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateRetentionPolicyDto,
  ) {
    return this.complianceService.setRetentionPolicy(principal, dto);
  }

  @Get('retention')
  @RequirePermission('admin:retention:manage')
  listRetentionPolicies(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.complianceService.listRetentionPolicies(principal);
  }

  @Post('retention/:scope/run')
  @RequirePermission('admin:retention:manage')
  @Audited({
    action: 'compliance.retention_run',
    resourceType: 'retention_policy',
    idParam: 'scope',
  })
  @HttpCode(HttpStatus.OK)
  executeRetentionPurge(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('scope') scope: RetentionScope,
  ) {
    return this.complianceService.executeRetentionPurge(principal, scope);
  }
}

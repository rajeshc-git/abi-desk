import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type AutomationRuleIdParamDto,
  AutomationRuleIdParamSchema,
  type CreateAutomationRuleDto,
  CreateAutomationRuleSchema,
  type ListAutomationRulesDto,
  ListAutomationRulesSchema,
  type ReorderAutomationRulesDto,
  ReorderAutomationRulesSchema,
  type TestAutomationRuleDto,
  TestAutomationRuleSchema,
  type UpdateAutomationRuleDto,
  UpdateAutomationRuleSchema,
} from './automation.dto';
import { AutomationService } from './automation.service';

@Controller({ path: 'automation-rules', version: '1' })
export class AutomationController {
  constructor(private readonly automationService: AutomationService) {}

  @Post()
  @RequirePermission('admin:automation:manage')
  @Audited({ action: 'automation_rule.created', resourceType: 'automation_rule' })
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateAutomationRuleDto) {
    return this.automationService.createRule(principal, dto);
  }

  @Get()
  @RequirePermission('admin:automation:manage')
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListAutomationRulesDto) {
    return this.automationService.listRules(principal, query);
  }

  @Post('reorder')
  @RequirePermission('admin:automation:manage')
  @Audited({ action: 'automation_rule.reordered', resourceType: 'automation_rule' })
  @HttpCode(HttpStatus.OK)
  reorder(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: ReorderAutomationRulesDto,
  ) {
    return this.automationService.reorderRules(principal, dto);
  }

  @Get(':id')
  @RequirePermission('admin:automation:manage')
  get(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: AutomationRuleIdParamDto) {
    return this.automationService.getRule(principal, params.id);
  }

  @Patch(':id')
  @RequirePermission('admin:automation:manage')
  @Audited({ action: 'automation_rule.updated', resourceType: 'automation_rule', idParam: 'id' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: AutomationRuleIdParamDto,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationService.updateRule(principal, params.id, dto);
  }

  @Delete(':id')
  @RequirePermission('admin:automation:manage')
  @Audited({ action: 'automation_rule.deleted', resourceType: 'automation_rule', idParam: 'id' })
  delete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: AutomationRuleIdParamDto,
  ) {
    return this.automationService.deleteRule(principal, params.id);
  }

  @Post(':id/test')
  @RequirePermission('admin:automation:manage')
  @HttpCode(HttpStatus.OK)
  test(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: AutomationRuleIdParamDto,
    @Body() dto: TestAutomationRuleDto,
  ) {
    return this.automationService.testRule(principal, params.id, dto);
  }

  @Get(':id/runs')
  @RequirePermission('admin:automation:manage')
  runs(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: AutomationRuleIdParamDto,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.automationService.getRuleRuns(principal, params.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }
}

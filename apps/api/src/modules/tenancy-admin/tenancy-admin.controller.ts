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
} from '@nestjs/common';
import { Audited, CurrentUser, RequireAnyPermission, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type BrandIdParamDto,
  BrandIdParamSchema,
  type CreateBrandDto,
  CreateBrandSchema,
  type CreateQueueDto,
  CreateQueueSchema,
  type CreateTeamDto,
  CreateTeamSchema,
  type InviteUserDto,
  InviteUserSchema,
  type SetRoleOverrideDto,
  SetRoleOverrideSchema,
  type TeamMemberInputDto,
  TeamMemberInputSchema,
  type UpdateBrandDto,
  UpdateBrandSchema,
  type UpdateQueueDto,
  UpdateQueueSchema,
  type UpdateTeamDto,
  UpdateTeamSchema,
  type UpdateUserAdminDto,
  UpdateUserAdminSchema,
  type UpdateWidgetConfigDto,
  UpdateWidgetConfigSchema,
} from './tenancy-admin.dto';
import { TenancyAdminService } from './tenancy-admin.service';

@Controller({ path: 'admin', version: '1' })
export class TenancyAdminController {
  constructor(private readonly adminService: TenancyAdminService) {}

  // =========================================================================
  // Brand Management
  // =========================================================================

  @Post('brands')
  @RequirePermission('admin:brand:manage')
  @Audited({ action: 'brand.created', resourceType: 'brand' })
  @HttpCode(HttpStatus.CREATED)
  createBrand(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateBrandDto) {
    return this.adminService.createBrand(principal, dto);
  }

  @Get('brands')
  @RequireAnyPermission('admin:brand:manage', 'ticket:read:tenant', 'ticket:read:own')
  listBrands(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.adminService.listBrands(principal);
  }

  @Get('brands/:id')
  @RequireAnyPermission('admin:brand:manage', 'ticket:read:tenant', 'ticket:read:own')
  getBrand(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: BrandIdParamDto) {
    return this.adminService.getBrand(principal, params.id);
  }

  @Patch('brands/:id')
  @RequirePermission('admin:brand:manage')
  @Audited({ action: 'brand.updated', resourceType: 'brand', idParam: 'id' })
  updateBrand(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: BrandIdParamDto,
    @Body() dto: UpdateBrandDto,
  ) {
    return this.adminService.updateBrand(principal, params.id, dto);
  }

  // -------------------------------------------------------------------------
  // Widget Config
  // -------------------------------------------------------------------------

  @Patch('brands/:id/widget-config')
  @RequirePermission('admin:widget:configure')
  @Audited({ action: 'widget_config.updated', resourceType: 'widget_config', idParam: 'id' })
  updateWidgetConfig(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: BrandIdParamDto,
    @Body() dto: UpdateWidgetConfigDto,
  ) {
    return this.adminService.updateWidgetConfig(principal, params.id, dto);
  }

  @Post('brands/:id/rotate-widget-secret')
  @RequirePermission('admin:widget:configure')
  @Audited({ action: 'widget_config.secret_rotated', resourceType: 'widget_config', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  rotateWidgetSecret(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: BrandIdParamDto,
  ) {
    return this.adminService.rotateWidgetSigningSecret(principal, params.id);
  }

  // -------------------------------------------------------------------------
  // Teams & Queues
  // -------------------------------------------------------------------------

  @Post('teams')
  @RequirePermission('admin:team:manage')
  @Audited({ action: 'team.created', resourceType: 'team' })
  createTeam(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateTeamDto) {
    return this.adminService.createTeam(principal, dto);
  }

  @Get('teams')
  @RequirePermission('admin:team:manage')
  listTeams(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.adminService.listTeams(principal);
  }

  @Post('teams/:id/members')
  @RequirePermission('admin:team:manage')
  @Audited({ action: 'team.member_added', resourceType: 'team', idParam: 'id' })
  addTeamMember(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') teamId: string,
    @Body() dto: TeamMemberInputDto,
  ) {
    return this.adminService.addTeamMember(principal, teamId, dto);
  }

  @Delete('teams/:id/members/:userId')
  @RequirePermission('admin:team:manage')
  @Audited({ action: 'team.member_removed', resourceType: 'team', idParam: 'id' })
  removeTeamMember(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.adminService.removeTeamMember(principal, teamId, userId);
  }

  @Post('queues')
  @RequirePermission('admin:queue:manage')
  @Audited({ action: 'queue.created', resourceType: 'queue' })
  createQueue(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateQueueDto) {
    return this.adminService.createQueue(principal, dto);
  }

  @Get('queues')
  @RequirePermission('admin:queue:manage')
  listQueues(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.adminService.listQueues(principal);
  }

  // -------------------------------------------------------------------------
  // Users & Invitations
  // -------------------------------------------------------------------------

  @Get('users')
  @RequirePermission('admin:user:read')
  listUsers(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.adminService.listUsers(principal);
  }

  @Patch('users/:id')
  @RequirePermission('admin:user:manage')
  @Audited({ action: 'user.updated', resourceType: 'user', idParam: 'id' })
  updateUser(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') userId: string,
    @Body() dto: UpdateUserAdminDto,
  ) {
    return this.adminService.updateUserAdmin(principal, userId, dto);
  }

  @Post('users/invite')
  @RequirePermission('admin:user:invite')
  @Audited({ action: 'user.invited', resourceType: 'user' })
  inviteUser(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: InviteUserDto) {
    return this.adminService.inviteUser(principal, dto);
  }

  // -------------------------------------------------------------------------
  // Role Permission Overrides
  // -------------------------------------------------------------------------

  @Get('roles')
  @RequirePermission('admin:user:invite')
  listRoles(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.adminService.listRoles(principal);
  }

  @Get('roles/overrides')
  @RequirePermission('admin:role:configure')
  listRoleOverrides(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.adminService.listRoleOverrides(principal);
  }

  @Post('roles/overrides')
  @RequirePermission('admin:role:configure')
  @Audited({ action: 'role_override.set', resourceType: 'role_override' })
  setRoleOverride(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: SetRoleOverrideDto,
  ) {
    return this.adminService.setRoleOverride(principal, dto);
  }
}

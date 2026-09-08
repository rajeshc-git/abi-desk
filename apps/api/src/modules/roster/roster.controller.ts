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
  Put,
  Query,
} from '@nestjs/common';
import { Audited, CurrentUser, RequireAnyPermission, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type CreateOrUpdateRosterDto,
  CreateOrUpdateRosterSchema,
  type RosterIdParamDto,
  RosterIdParamSchema,
  type SaveTeamRosterConfigDto,
  SaveTeamRosterConfigSchema,
  type TeamIdParamDto,
  TeamIdParamSchema,
} from './roster.dto';
import { RosterService } from './roster.service';

@Controller({ path: 'admin/roster', version: '1' })
export class RosterController {
  constructor(private readonly rosterService: RosterService) {}

  // =========================================================================
  // Team Rotation Config & Rules
  // =========================================================================

  @Get('teams/:teamId/config')
  @RequireAnyPermission('roster:read', 'roster:manage')
  getTeamConfig(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TeamIdParamDto,
  ) {
    return this.rosterService.getTeamConfig(principal, params.teamId);
  }

  @Put('teams/:teamId/config')
  @RequirePermission('roster:manage')
  @Audited({ action: 'roster_config.updated', resourceType: 'team', idParam: 'teamId' })
  saveTeamConfig(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TeamIdParamDto,
    @Body() dto: SaveTeamRosterConfigDto,
  ) {
    return this.rosterService.saveTeamConfig(principal, params.teamId, dto);
  }

  // =========================================================================
  // Shift Roster Schedules
  // =========================================================================

  @Get('rosters')
  @RequireAnyPermission('roster:read', 'roster:manage')
  listRosters(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query('teamId') teamId?: string,
  ) {
    return this.rosterService.listRosters(principal, teamId);
  }

  @Get('rosters/:id')
  @RequireAnyPermission('roster:read', 'roster:manage')
  getRoster(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: RosterIdParamDto,
  ) {
    return this.rosterService.getRoster(principal, params.id);
  }

  @Post('teams/:teamId/rosters')
  @RequirePermission('roster:manage')
  @Audited({ action: 'roster.created', resourceType: 'shift_roster' })
  @HttpCode(HttpStatus.CREATED)
  createRoster(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TeamIdParamDto,
    @Body() dto: CreateOrUpdateRosterDto,
  ) {
    return this.rosterService.createRoster(principal, params.teamId, dto);
  }

  @Patch('rosters/:id')
  @RequirePermission('roster:manage')
  @Audited({ action: 'roster.updated', resourceType: 'shift_roster', idParam: 'id' })
  updateRoster(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: RosterIdParamDto,
    @Body() dto: Partial<CreateOrUpdateRosterDto>,
  ) {
    return this.rosterService.updateRoster(principal, params.id, dto);
  }

  @Post('rosters/:id/publish')
  @RequirePermission('roster:manage')
  @Audited({ action: 'roster.published', resourceType: 'shift_roster', idParam: 'id' })
  publishRoster(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: RosterIdParamDto,
    @Body('note') note?: string,
  ) {
    return this.rosterService.publishRoster(principal, params.id, note);
  }

  @Delete('rosters/:id')
  @RequirePermission('roster:manage')
  @Audited({ action: 'roster.deleted', resourceType: 'shift_roster', idParam: 'id' })
  deleteRoster(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: RosterIdParamDto,
  ) {
    return this.rosterService.deleteRoster(principal, params.id);
  }

  // =========================================================================
  // Product / Application Endpoints
  // =========================================================================

  @Get('products')
  @RequireAnyPermission('roster:read', 'roster:manage')
  listProducts(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.rosterService.listProducts(principal);
  }

  @Post('products')
  @RequirePermission('roster:manage')
  @Audited({ action: 'product.created', resourceType: 'product' })
  @HttpCode(HttpStatus.CREATED)
  createProduct(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: { name: string; slug: string; brandId?: string | null; description?: string },
  ) {
    return this.rosterService.createProduct(principal, dto);
  }

  @Patch('products/:id')
  @RequirePermission('roster:manage')
  @Audited({ action: 'product.updated', resourceType: 'product', idParam: 'id' })
  updateProduct(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: { name?: string; slug?: string; brandId?: string | null; description?: string; isActive?: boolean },
  ) {
    return this.rosterService.updateProduct(principal, id, dto);
  }

  @Delete('products/:id')
  @RequirePermission('roster:manage')
  @Audited({ action: 'product.deleted', resourceType: 'product', idParam: 'id' })
  deleteProduct(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    return this.rosterService.deleteProduct(principal, id);
  }
}

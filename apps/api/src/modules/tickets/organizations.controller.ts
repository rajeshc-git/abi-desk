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
import {
  Audited,
  CurrentUser,
  RequireAnyPermission,
} from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  CreateOrganizationDto,
  UpdateOrganizationDto,
  BulkImportOrganizationsDto,
  BulkDeleteOrganizationsDto,
} from './ticket.dto';
import { TicketService } from './ticket.service';

@Controller({ path: 'organizations', version: '1' })
export class OrganizationsController {
  constructor(private readonly tickets: TicketService) {}

  @Get()
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant', 'ticket:tag', 'brand:update:tenant')
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.tickets.listOrganizations(principal);
  }

  @Post()
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'organization.created', resourceType: 'organization' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateOrganizationDto,
  ) {
    return this.tickets.createOrganization(principal, dto);
  }

  @Post('bulk-import')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'organization.bulk_imported', resourceType: 'organization' })
  @HttpCode(HttpStatus.OK)
  bulkImport(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: BulkImportOrganizationsDto,
  ) {
    return this.tickets.bulkImportOrganizations(principal, dto.organizations);
  }

  @Post('bulk-delete')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'organization.bulk_deleted', resourceType: 'organization' })
  @HttpCode(HttpStatus.OK)
  bulkDelete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: BulkDeleteOrganizationsDto,
  ) {
    return this.tickets.bulkDeleteOrganizations(principal, dto.ids);
  }

  @Patch(':id')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'organization.updated', resourceType: 'organization' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.tickets.updateOrganization(principal, id, dto);
  }

  @Delete(':id')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'organization.deleted', resourceType: 'organization' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.tickets.deleteOrganization(principal, id);
  }
}


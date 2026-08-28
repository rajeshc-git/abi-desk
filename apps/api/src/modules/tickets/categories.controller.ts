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
import { CreateCategoryDto, UpdateCategoryDto } from './ticket.dto';
import { TicketService } from './ticket.service';

@Controller({ path: 'categories', version: '1' })
export class CategoriesController {
  constructor(private readonly tickets: TicketService) {}

  @Get()
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant', 'ticket:tag', 'brand:update:tenant')
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.tickets.listCategories(principal);
  }

  @Post()
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'category.created', resourceType: 'category' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.tickets.createCategory(principal, dto);
  }

  @Patch(':id')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'category.updated', resourceType: 'category' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.tickets.updateCategory(principal, id, dto);
  }

  @Delete(':id')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'category.deleted', resourceType: 'category' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.tickets.deleteCategory(principal, id);
  }
}

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
import { CreateTagDto, UpdateTagDto } from './ticket.dto';
import { TicketService } from './ticket.service';

@Controller({ path: 'tags', version: '1' })
export class TagsController {
  constructor(private readonly tickets: TicketService) {}

  @Get()
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant', 'ticket:tag', 'brand:update:tenant')
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.tickets.listTags(principal);
  }

  @Post()
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'tag.created', resourceType: 'tag' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: CreateTagDto,
  ) {
    return this.tickets.createTag(principal, dto);
  }

  @Patch(':id')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'tag.updated', resourceType: 'tag' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tickets.updateTag(principal, id, dto);
  }

  @Delete(':id')
  @RequireAnyPermission('ticket:tag', 'brand:update:tenant', 'admin:brand:manage', 'ticket:update:tenant')
  @Audited({ action: 'tag.deleted', resourceType: 'tag' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
  ) {
    await this.tickets.deleteTag(principal, id);
  }
}


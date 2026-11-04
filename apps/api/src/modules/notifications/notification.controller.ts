import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { NotificationService } from './notification.service';

@Controller({ path: 'notifications', version: '1' })
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.notificationService.list(principal);
  }

  @Patch(':id/read')
  markAsRead(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.notificationService.markAsRead(principal, id);
  }

  @Post('read-broadcast')
  markBroadcastAsRead(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() body: { message: string },
  ) {
    return this.notificationService.markBroadcastAsRead(principal, body?.message);
  }

  @Post('read-all')
  markAllAsRead(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.notificationService.markAllAsRead(principal);
  }

  @Delete()
  clearAll(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.notificationService.clearAll(principal);
  }

  @Post('clear-all')
  clearAllPost(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.notificationService.clearAll(principal);
  }

  @Delete(':id')
  delete(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.notificationService.delete(principal, id);
  }
}


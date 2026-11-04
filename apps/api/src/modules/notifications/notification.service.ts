import { Inject, Injectable } from '@nestjs/common';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';

@Injectable()
export class NotificationService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'NotificationService' });
  }

  /**
   * Returns recent notifications for the currently authenticated user in this tenant.
   */
  async list(principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.notification.findMany({
      where: {
        tenantId,
        userId: principal.userId,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  /**
   * Marks a specific notification as read.
   */
  async markAsRead(principal: AuthenticatedPrincipal, id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.notification.updateMany({
      where: {
        id,
        tenantId,
        userId: principal.userId,
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks a broadcast notification as read matching its message body for this user.
   */
  async markBroadcastAsRead(principal: AuthenticatedPrincipal, message?: string) {
    if (!message) return { count: 0 };
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.notification.updateMany({
      where: {
        tenantId,
        userId: principal.userId,
        eventType: { in: ['broadcast.announcement', 'agent.broadcast'] },
        body: message.trim().slice(0, 2000),
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all unread notifications for the user as read.
   */
  async markAllAsRead(principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.notification.updateMany({
      where: {
        tenantId,
        userId: principal.userId,
        status: { not: 'READ' },
      },
      data: {
        status: 'READ',
        readAt: new Date(),
      },
    });
  }

  /**
   * Permanently clears all notifications for the user in this tenant from DB.
   */
  async clearAll(principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.notification.deleteMany({
      where: {
        tenantId,
        userId: principal.userId,
      },
    });
  }

  /**
   * Permanently deletes a single notification for the user in this tenant from DB.
   */
  async delete(principal: AuthenticatedPrincipal, id: string) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.notification.deleteMany({
      where: {
        id,
        tenantId,
        userId: principal.userId,
      },
    });
  }
}


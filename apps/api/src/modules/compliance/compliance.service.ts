import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { StorageService } from '../../infra/storage/storage.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type CreateDataSubjectRequestDto,
  type CreateRetentionPolicyDto,
  type RetentionScope,
} from './compliance.dto';

@Injectable()
export class ComplianceService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly storage: StorageService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'ComplianceService' });
  }

  // =========================================================================
  // Data Subject Requests (GDPR Art. 15 Export & Art. 17 Erasure)
  // =========================================================================

  async createDsr(principal: AuthenticatedPrincipal, dto: CreateDataSubjectRequestDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const subjectUser = await this.db.client.user.findFirst({
      where: { id: dto.subjectUserId, tenantId, deletedAt: null },
    });

    if (!subjectUser) {
      throw AppException.notFound(`Subject user '${dto.subjectUserId}' not found.`);
    }

    const dsr = await this.db.client.dataSubjectRequest.create({
      data: {
        tenantId,
        subjectUserId: subjectUser.id,
        subjectEmail: subjectUser.email,
        type: dto.type,
        status: 'IN_PROGRESS',
        requestedById: principal.userId,
        reason: dto.reason ?? null,
        startedAt: new Date(),
      },
    });

    if (dto.type === 'EXPORT') {
      return this.processExportDsr(dsr.id, tenantId, subjectUser.id);
    } else {
      return this.processErasureDsr(dsr.id, tenantId, subjectUser.id);
    }
  }

  private async processExportDsr(dsrId: string, tenantId: string, userId: string) {
    try {
      const [user, tickets, comments, chats] = await Promise.all([
        this.db.unsafeRawClient.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            fullName: true,
            displayName: true,
            phone: true,
            jobTitle: true,
            timezone: true,
            locale: true,
            createdAt: true,
          },
        }),
        this.db.unsafeRawClient.ticket.findMany({
          where: { tenantId, requesterId: userId, deletedAt: null },
          select: {
            id: true,
            number: true,
            subject: true,
            description: true,
            status: true,
            priority: true,
            channel: true,
            createdAt: true,
            resolvedAt: true,
          },
        }),
        this.db.unsafeRawClient.ticketComment.findMany({
          where: { tenantId, authorId: userId, deletedAt: null },
          select: {
            id: true,
            ticketId: true,
            visibility: true,
            body: true,
            createdAt: true,
          },
        }),
        this.db.unsafeRawClient.chatMessage.findMany({
          where: { tenantId, senderId: userId, deletedAt: null },
          select: {
            id: true,
            conversationId: true,
            body: true,
            createdAt: true,
          },
        }),
      ]);

      const exportBundle = {
        exportedAt: new Date().toISOString(),
        user,
        tickets,
        comments,
        chats,
      };

      const exportStorageKey = `compliance/exports/${tenantId}/${userId}-${Date.now()}.json`;
      const buffer = Buffer.from(JSON.stringify(exportBundle, null, 2), 'utf8');

      await this.storage.putObjectBuffer(exportStorageKey, buffer, 'application/json');

      const exportExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const updated = await this.db.unsafeRawClient.dataSubjectRequest.update({
        where: { id: dsrId },
        data: {
          status: 'COMPLETED',
          exportStorageKey,
          exportExpiresAt,
          completedAt: new Date(),
        },
      });

      const { url } = await this.storage.presignDownload(exportStorageKey, {
        expiresInSeconds: 7 * 24 * 3600,
        downloadFilename: `gdpr-export-${user?.fullName ?? userId}.json`,
      });

      return {
        ...updated,
        downloadUrl: url,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.db.unsafeRawClient.dataSubjectRequest.update({
        where: { id: dsrId },
        data: { status: 'FAILED', error, completedAt: new Date() },
      });
      throw err;
    }
  }

  private async processErasureDsr(dsrId: string, tenantId: string, userId: string) {
    try {
      const result = await this.db.run(async (tx) => {
        // In-place anonymization: keeps row & UUID for relational integrity of tickets/history
        const anonymizedEmail = `anonymized-${userId.slice(0, 8)}@privacy.deleted`;

        await tx.user.update({
          where: { id: userId },
          data: {
            fullName: 'Anonymized User',
            displayName: null,
            email: anonymizedEmail,
            phone: null,
            avatarUrl: null,
            jobTitle: null,
            passwordHash: null,
            mfaSecretEncrypted: null,
            externalId: null,
            anonymizedAt: new Date(),
            status: 'DEACTIVATED',
          },
        });

        // Kill active sessions and federated identity links
        const [deletedSessions, deletedIdentities] = await Promise.all([
          tx.session.deleteMany({ where: { userId } }),
          tx.userIdentity.deleteMany({ where: { userId } }),
        ]);

        const affectedCounts = {
          userAnonymized: 1,
          sessionsPurged: deletedSessions.count,
          identitiesPurged: deletedIdentities.count,
        };

        const updated = await tx.dataSubjectRequest.update({
          where: { id: dsrId },
          data: {
            status: 'COMPLETED',
            affectedCounts: affectedCounts as Prisma.InputJsonValue,
            completedAt: new Date(),
          },
        });

        return updated;
      });

      this.logger.info({ userId, dsrId, tenantId }, 'User GDPR/DPDPA erasure completed');
      return result;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      await this.db.unsafeRawClient.dataSubjectRequest.update({
        where: { id: dsrId },
        data: { status: 'FAILED', error, completedAt: new Date() },
      });
      throw err;
    }
  }

  async listDsrs(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.dataSubjectRequest.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDsr(_principal: AuthenticatedPrincipal, dsrId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const dsr = await this.db.client.dataSubjectRequest.findFirst({
      where: { id: dsrId, tenantId },
    });

    if (!dsr) {
      throw AppException.notFound(`Data subject request '${dsrId}' not found.`);
    }

    let downloadUrl: string | undefined;
    if (dsr.exportStorageKey && dsr.status === 'COMPLETED') {
      const presigned = await this.storage.presignDownload(dsr.exportStorageKey, {
        expiresInSeconds: 3600,
        downloadFilename: `gdpr-export-${dsr.subjectUserId}.json`,
      });
      downloadUrl = presigned.url;
    }

    return { ...dsr, downloadUrl };
  }

  // =========================================================================
  // Retention Policies & Scheduled Purges
  // =========================================================================

  async listRetentionPolicies(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.retentionPolicy.findMany({
      where: { tenantId },
    });
  }

  async setRetentionPolicy(_principal: AuthenticatedPrincipal, dto: CreateRetentionPolicyDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.retentionPolicy.upsert({
      where: { tenantId_scope: { tenantId, scope: dto.scope } },
      create: {
        tenantId,
        scope: dto.scope,
        retentionDays: dto.retentionDays,
        anonymizeInsteadOfDelete: dto.anonymizeInsteadOfDelete,
        isActive: dto.isActive,
      },
      update: {
        retentionDays: dto.retentionDays,
        anonymizeInsteadOfDelete: dto.anonymizeInsteadOfDelete,
        isActive: dto.isActive,
      },
    });
  }

  /**
   * Executes lawful retention purge of aged-out records.
   */
  async executeRetentionPurge(_principal: AuthenticatedPrincipal, scope: RetentionScope) {
    const tenantId = this.tenantContext.requireTenantId();

    const policy = await this.db.client.retentionPolicy.findUnique({
      where: { tenantId_scope: { tenantId, scope } },
    });

    const retentionDays = policy?.retentionDays ?? 180; // default 180 days
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

    let purgedCount = 0;

    await this.db.runRetentionPurge(async (tx) => {
      switch (scope) {
        case 'DIAGNOSTIC': {
          const res = await tx.diagnosticBundle.deleteMany({
            where: { tenantId, capturedAt: { lt: cutoffDate } },
          });
          purgedCount = res.count;
          break;
        }

        case 'MEDIA': {
          const res = await tx.mediaAsset.updateMany({
            where: { tenantId, createdAt: { lt: cutoffDate }, status: { not: 'EXPIRED' } },
            data: { status: 'EXPIRED', deletedAt: new Date() },
          });
          purgedCount = res.count;
          break;
        }

        case 'WEBHOOK_DELIVERY': {
          const res = await tx.webhookDelivery.deleteMany({
            where: { tenantId, createdAt: { lt: cutoffDate } },
          });
          purgedCount = res.count;
          break;
        }

        case 'CHAT': {
          const res = await tx.chatConversation.deleteMany({
            where: { tenantId, status: 'CLOSED', closedAt: { lt: cutoffDate } },
          });
          purgedCount = res.count;
          break;
        }

        case 'AUDIT': {
          const res = await tx.auditLog.deleteMany({
            where: { tenantId, createdAt: { lt: cutoffDate } },
          });
          purgedCount = res.count;
          break;
        }

        default:
          break;
      }

      if (policy) {
        await tx.retentionPolicy.update({
          where: { id: policy.id },
          data: { lastRunAt: new Date(), lastRunCount: purgedCount },
        });
      }
    });

    this.logger.info({ tenantId, scope, purgedCount, retentionDays }, 'Retention purge executed');
    return { scope, purgedCount, cutoffDate };
  }
}

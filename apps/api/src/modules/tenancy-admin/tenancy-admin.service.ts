import { randomBytes, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, sealSecret } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { MailService } from '../../infra/mail/mail.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { invitationEmail } from '../../infra/mail/mail.templates';
import {
  type CreateBrandDto,
  type CreateQueueDto,
  type CreateTeamDto,
  type InviteUserDto,
  type SetRoleOverrideDto,
  type TeamMemberInputDto,
  type UpdateBrandDto,
  type UpdateQueueDto,
  type UpdateTeamDto,
  type UpdateUserAdminDto,
  type UpdateWidgetConfigDto,
} from './tenancy-admin.dto';

@Injectable()
export class TenancyAdminService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfig,
    private readonly mail: MailService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'TenancyAdminService' });
  }

  // =========================================================================
  // Brand & Widget Config Management
  // =========================================================================

  async createBrand(_principal: AuthenticatedPrincipal, dto: CreateBrandDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      if (dto.isDefault) {
        await tx.brand.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      const brand = await tx.brand.create({
        data: {
          tenantId,
          name: dto.name,
          slug: dto.slug,
          isDefault: dto.isDefault,
          primaryColor: dto.primaryColor,
          accentColor: dto.accentColor,
          logoUrl: dto.logoUrl ?? null,
          faviconUrl: dto.faviconUrl ?? null,
          supportEmail: dto.supportEmail ?? null,
          portalDomain: dto.portalDomain ?? null,
          timezone: dto.timezone ?? null,
          locale: dto.locale ?? null,
        },
      });

      // Automatically provision initial WidgetConfig for the new brand
      const publicKey = `pk_${randomBytes(16).toString('hex')}`;
      const rawSigningSecret = `sk_${randomBytes(32).toString('hex')}`;
      const signingSecretEncrypted = sealSecret(rawSigningSecret, this.config.encryptionKey);
      const signingSecretLast4 = rawSigningSecret.slice(-4);

      const widgetConfig = await tx.widgetConfig.create({
        data: {
          tenantId,
          brandId: brand.id,
          publicKey,
          signingSecretEncrypted,
          signingSecretLast4,
          allowedOrigins: [],
        },
      });

      return {
        brand,
        widgetConfig: {
          ...widgetConfig,
          signingSecretEncrypted: undefined,
          initialSigningSecret: rawSigningSecret, // returned only on initial creation
        },
      };
    });
  }

  async listBrands(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.brand.findMany({
      where: { tenantId, deletedAt: null },
      include: {
        widgetConfig: {
          select: {
            id: true,
            publicKey: true,
            signingSecretLast4: true,
            isActive: true,
            adminWidgetEnabled: true,
          },
        },
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
  }

  async getBrand(_principal: AuthenticatedPrincipal, brandId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const brand = await this.db.client.brand.findFirst({
      where: { id: brandId, tenantId, deletedAt: null },
      include: { widgetConfig: true },
    });

    if (!brand) {
      throw AppException.notFound(`Brand '${brandId}' not found.`);
    }

    return brand;
  }

  async updateBrand(_principal: AuthenticatedPrincipal, brandId: string, dto: UpdateBrandDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      const existing = await tx.brand.findFirst({
        where: { id: brandId, tenantId, deletedAt: null },
      });

      if (!existing) {
        throw AppException.notFound(`Brand '${brandId}' not found.`);
      }

      if (dto.isDefault) {
        await tx.brand.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      return tx.brand.update({
        where: { id: brandId },
        data: {
          name: dto.name,
          slug: dto.slug,
          isDefault: dto.isDefault,
          primaryColor: dto.primaryColor,
          accentColor: dto.accentColor,
          logoUrl: dto.logoUrl !== undefined ? (dto.logoUrl ?? null) : undefined,
          faviconUrl: dto.faviconUrl !== undefined ? (dto.faviconUrl ?? null) : undefined,
          supportEmail: dto.supportEmail !== undefined ? (dto.supportEmail ?? null) : undefined,
          portalDomain: dto.portalDomain !== undefined ? (dto.portalDomain ?? null) : undefined,
          timezone: dto.timezone !== undefined ? (dto.timezone ?? null) : undefined,
          locale: dto.locale !== undefined ? (dto.locale ?? null) : undefined,
        },
      });
    });
  }

  async updateWidgetConfig(
    _principal: AuthenticatedPrincipal,
    brandId: string,
    dto: UpdateWidgetConfigDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const brand = await this.db.client.brand.findFirst({
      where: { id: brandId, tenantId },
    });
    if (!brand) {
      throw AppException.notFound(`Brand '${brandId}' not found under this tenant.`);
    }

    const config = await this.db.client.widgetConfig.findFirst({
      where: { brandId, tenantId },
    });

    if (!config) {
      const publicKey = `pk_${randomBytes(16).toString('hex')}`;
      const rawSigningSecret = `sk_${randomBytes(32).toString('hex')}`;
      const signingSecretEncrypted = sealSecret(rawSigningSecret, this.config.encryptionKey);
      const signingSecretLast4 = rawSigningSecret.slice(-4);

      return this.db.client.widgetConfig.create({
        data: {
          tenantId,
          brandId,
          publicKey,
          signingSecretEncrypted,
          signingSecretLast4,
          widgetEnabled: dto.widgetEnabled,
          adminWidgetEnabled: dto.adminWidgetEnabled,
          allowedOrigins: dto.allowedOrigins || [],
          screenshotEnabled: dto.screenshotEnabled,
          annotationEnabled: dto.annotationEnabled,
          screenRecordingEnabled: dto.screenRecordingEnabled,
          voiceRecordingEnabled: dto.voiceRecordingEnabled,
          attachmentsEnabled: dto.attachmentsEnabled,
          consoleCaptureEnabled: dto.consoleCaptureEnabled,
          networkCaptureEnabled: dto.networkCaptureEnabled,
          errorCaptureEnabled: dto.errorCaptureEnabled,
          performanceCapture: dto.performanceCapture,
          liveChatEnabled: dto.liveChatEnabled,
          ticketTrackingEnabled: dto.ticketTrackingEnabled,
          kbDeflectionEnabled: dto.kbDeflectionEnabled,
          anonymousTicketsEnabled: dto.anonymousTicketsEnabled,
          maxRecordingSeconds: dto.maxRecordingSeconds,
          maxAttachmentBytes: dto.maxAttachmentBytes,
          maxAttachmentsPerTicket: dto.maxAttachmentsPerTicket,
          launcherPosition: dto.launcherPosition,
          launcherLabel: dto.launcherLabel,
          welcomeMessage:
            dto.welcomeMessage !== undefined ? (dto.welcomeMessage ?? null) : undefined,
          privacyNotice: dto.privacyNotice !== undefined ? (dto.privacyNotice ?? null) : undefined,
          requireConsent: dto.requireConsent,
          theme: dto.theme as Prisma.InputJsonValue,
          isActive: dto.isActive,
        },
      });
    }

    return this.db.client.widgetConfig.update({
      where: { brandId },
      data: {
        widgetEnabled: dto.widgetEnabled,
        adminWidgetEnabled: dto.adminWidgetEnabled,
        allowedOrigins: dto.allowedOrigins,
        screenshotEnabled: dto.screenshotEnabled,
        annotationEnabled: dto.annotationEnabled,
        screenRecordingEnabled: dto.screenRecordingEnabled,
        voiceRecordingEnabled: dto.voiceRecordingEnabled,
        attachmentsEnabled: dto.attachmentsEnabled,
        consoleCaptureEnabled: dto.consoleCaptureEnabled,
        networkCaptureEnabled: dto.networkCaptureEnabled,
        errorCaptureEnabled: dto.errorCaptureEnabled,
        performanceCapture: dto.performanceCapture,
        liveChatEnabled: dto.liveChatEnabled,
        ticketTrackingEnabled: dto.ticketTrackingEnabled,
        kbDeflectionEnabled: dto.kbDeflectionEnabled,
        anonymousTicketsEnabled: dto.anonymousTicketsEnabled,
        maxRecordingSeconds: dto.maxRecordingSeconds,
        maxAttachmentBytes: dto.maxAttachmentBytes,
        maxAttachmentsPerTicket: dto.maxAttachmentsPerTicket,
        launcherPosition: dto.launcherPosition,
        launcherLabel: dto.launcherLabel,
        welcomeMessage: dto.welcomeMessage !== undefined ? (dto.welcomeMessage ?? null) : undefined,
        privacyNotice: dto.privacyNotice !== undefined ? (dto.privacyNotice ?? null) : undefined,
        requireConsent: dto.requireConsent,
        theme: dto.theme as Prisma.InputJsonValue,
        isActive: dto.isActive,
      },
    });
  }

  async rotateWidgetSigningSecret(_principal: AuthenticatedPrincipal, brandId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const brand = await this.db.client.brand.findFirst({
      where: { id: brandId, tenantId },
    });
    if (!brand) {
      throw AppException.notFound(`Brand '${brandId}' not found under this tenant.`);
    }

    const config = await this.db.client.widgetConfig.findFirst({
      where: { brandId, tenantId },
    });

    const newRawSecret = `sk_${randomBytes(32).toString('hex')}`;
    const encrypted = sealSecret(newRawSecret, this.config.encryptionKey);
    const last4 = newRawSecret.slice(-4);

    if (!config) {
      const publicKey = `pk_${randomBytes(16).toString('hex')}`;
      await this.db.client.widgetConfig.create({
        data: {
          tenantId,
          brandId,
          publicKey,
          signingSecretEncrypted: encrypted,
          signingSecretLast4: last4,
          signingSecretRotatedAt: new Date(),
          allowedOrigins: [],
          widgetEnabled: true,
        },
      });
    } else {
      await this.db.client.widgetConfig.update({
        where: { brandId },
        data: {
          signingSecretEncrypted: encrypted,
          signingSecretLast4: last4,
          signingSecretRotatedAt: new Date(),
        },
      });
    }

    return {
      brandId,
      signingSecret: newRawSecret, // returned once to the caller
      signingSecretLast4: last4,
      rotatedAt: new Date(),
    };
  }

  // =========================================================================
  // Teams & Queues Management
  // =========================================================================

  async createTeam(_principal: AuthenticatedPrincipal, dto: CreateTeamDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.team.create({
      data: {
        tenantId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description ?? null,
        tier: dto.tier ?? null,
        isActive: dto.isActive,
      },
    });
  }

  async listTeams(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.team.findMany({
      where: { tenantId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, fullName: true, email: true, status: true, isAvailable: true },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async addTeamMember(_principal: AuthenticatedPrincipal, teamId: string, dto: TeamMemberInputDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.teamMember.upsert({
      where: { teamId_userId: { teamId, userId: dto.userId } },
      create: {
        tenantId,
        teamId,
        userId: dto.userId,
        isLead: dto.isLead,
      },
      update: { isLead: dto.isLead },
    });
  }

  async removeTeamMember(_principal: AuthenticatedPrincipal, teamId: string, userId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    await this.db.client.teamMember.deleteMany({
      where: { teamId, userId, tenantId },
    });

    return { success: true, teamId, userId };
  }

  async createQueue(_principal: AuthenticatedPrincipal, dto: CreateQueueDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      if (dto.isDefault) {
        await tx.queue.updateMany({
          where: { tenantId },
          data: { isDefault: false },
        });
      }

      return tx.queue.create({
        data: {
          tenantId,
          name: dto.name,
          slug: dto.slug,
          description: dto.description ?? null,
          tier: dto.tier,
          brandId: dto.brandId ?? null,
          teamId: dto.teamId ?? null,
          routing: dto.routing,
          isDefault: dto.isDefault,
          isActive: dto.isActive,
        },
        include: { team: true, brand: true },
      });
    });
  }

  async listQueues(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.queue.findMany({
      where: { tenantId },
      include: { team: true, brand: true },
      orderBy: [{ isDefault: 'desc' }, { tier: 'asc' }, { name: 'asc' }],
    });
  }

  // =========================================================================
  // User Management & Invitations
  // =========================================================================

  async listUsers(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.user.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        displayName: true,
        avatarUrl: true,
        kind: true,
        status: true,
        isAvailable: true,
        maxConcurrentTickets: true,
        lastLoginAt: true,
        createdAt: true,
        roles: {
          include: {
            role: { select: { id: true, key: true, name: true, rank: true, tier: true } },
            brand: { select: { id: true, name: true } },
          },
        },
        teamMembers: {
          include: { team: { select: { id: true, name: true, tier: true } } },
        },
      },
      orderBy: [{ kind: 'asc' }, { fullName: 'asc' }],
    });
  }

  async updateUserAdmin(
    _principal: AuthenticatedPrincipal,
    userId: string,
    dto: UpdateUserAdminDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      const user = await tx.user.findFirst({
        where: { id: userId, tenantId, deletedAt: null },
      });

      if (!user) {
        throw AppException.notFound(`User '${userId}' not found.`);
      }

      if (
        dto.status !== undefined ||
        dto.isAvailable !== undefined ||
        dto.maxConcurrentTickets !== undefined
      ) {
        await tx.user.update({
          where: { id: userId },
          data: {
            status: dto.status,
            isAvailable: dto.isAvailable,
            maxConcurrentTickets: dto.maxConcurrentTickets,
          },
        });
      }

      if (dto.roleId) {
        await tx.userRole.deleteMany({ where: { userId, tenantId } });
        await tx.userRole.create({
          data: {
            tenantId,
            userId,
            roleId: dto.roleId,
            brandId: dto.brandId ?? null,
            assignedById: _principal.userId,
          },
        });
      }

      return tx.user.findUnique({
        where: { id: userId },
        include: { roles: { include: { role: true } } },
      });
    });
  }

  async inviteUser(principal: AuthenticatedPrincipal, dto: InviteUserDto) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.run(async (tx) => {
      const existingUser = await tx.user.findFirst({
        where: { email: dto.email.toLowerCase(), tenantId, deletedAt: null },
      });

      if (existingUser) {
        throw AppException.conflict(
          `A user with email '${dto.email}' already exists in this tenant.`,
        );
      }

      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invitation = await tx.invitation.create({
        data: {
          tenantId,
          brandId: dto.brandId ?? null,
          email: dto.email.toLowerCase(),
          roleId: dto.roleId,
          invitedById: principal.userId,
          tokenHash,
          message: dto.message ?? null,
          expiresAt,
        },
        include: { role: true, brand: true },
      });

      const inviter = await tx.user.findUnique({
        where: { id: principal.userId },
        select: { fullName: true },
      });
      const inviterName = inviter?.fullName || 'An administrator';

      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { name: true },
      });
      const tenantName = tenant?.name || 'our organization';

      const inviteLink = `${this.config.urls.console}/register?token=${rawToken}`;
      const expiresInDays = Math.max(1, Math.ceil((expiresAt.getTime() - Date.now()) / 86_400_000));

      await this.mail.send(
        invitationEmail({
          email: dto.email,
          inviterName,
          tenantName,
          roleName: invitation.role.name,
          url: inviteLink,
          expiresInDays,
          ...(dto.message ? { message: dto.message } : {}),
        }),
      );

      return {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role.name,
        expiresAt: invitation.expiresAt,
        token: rawToken, // returned once for debug/admin UI
      };
    });
  }

  // =========================================================================
  // Role Permission Overrides
  // =========================================================================

  async listRoleOverrides(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.tenantRolePermissionOverride.findMany({
      where: { tenantId },
      include: {
        role: { select: { id: true, key: true, name: true } },
        permission: {
          select: { id: true, key: true, description: true, tenantConfigurable: true },
        },
      },
    });
  }

  async setRoleOverride(principal: AuthenticatedPrincipal, dto: SetRoleOverrideDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const permission = await this.db.client.permission.findUnique({
      where: { key: dto.permissionKey },
    });

    if (!permission) {
      throw AppException.notFound(`Permission '${dto.permissionKey}' not found.`);
    }

    if (!permission.tenantConfigurable) {
      throw AppException.badRequest(
        `Permission '${dto.permissionKey}' is not tenant-configurable.`,
      );
    }

    const override = await this.db.client.tenantRolePermissionOverride.upsert({
      where: {
        tenantId_roleId_permissionId: {
          tenantId,
          roleId: dto.roleId,
          permissionId: permission.id,
        },
      },
      create: {
        tenantId,
        roleId: dto.roleId,
        permissionId: permission.id,
        granted: dto.granted,
        reason: dto.reason ?? null,
        updatedById: principal.userId,
      },
      update: {
        granted: dto.granted,
        reason: dto.reason ?? null,
        updatedById: principal.userId,
      },
      include: { role: true, permission: true },
    });

    return override;
  }

  async listRoles(_principal: AuthenticatedPrincipal) {
    return this.db.client.role.findMany({
      where: { scope: 'TENANT' },
      orderBy: { rank: 'asc' },
    });
  }
}

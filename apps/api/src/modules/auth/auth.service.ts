import { Inject, Injectable } from '@nestjs/common';
import { type RoleKey } from '@abi-desk/rbac';
import { type Prisma, type User, sealSecret } from '@abi-desk/db';
import { randomBytes } from 'node:crypto';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { MailService } from '../../infra/mail/mail.service';
import {
  invitationEmail,
  magicLinkEmail,
  passwordChangedEmail,
  passwordResetEmail,
  registrationOtpEmail,
  suspiciousRefreshEmail,
  welcomeRegistrationEmail,
  widgetOtpEmail,
} from '../../infra/mail/mail.templates';
import { RedisService } from '../../infra/redis/redis.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import {
  type TenantTransaction,
  TenantPrismaService,
} from '../../infra/tenancy/tenant-prisma.service';
import { PermissionResolverService } from '../authorization/permission-resolver.service';
import {
  type AuthenticatedPrincipal,
  type AuthenticatedResult,
  type AuthMethod,
  type CallerContext,
  type IssuedTokens,
} from './auth.types';
import { OneTimeTokenService } from './one-time-token.service';
import { PasswordService } from './password.service';
import { REVOCATION_REASON, SessionService, type SessionOrigin } from './session.service';
import { TokenService } from './token.service';

/** Fields every flow needs from the user row. */
const USER_SELECT = {
  id: true,
  tenantId: true,
  email: true,
  fullName: true,
  kind: true,
  status: true,
  passwordHash: true,
  failedLoginCount: true,
  lockedUntil: true,
  emailVerifiedAt: true,
} as const;

type AuthUser = Pick<User, keyof typeof USER_SELECT>;

@Injectable()
export class AuthService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly contexts: TenantContextService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    private readonly oneTimeTokens: OneTimeTokenService,
    private readonly permissions: PermissionResolverService,
    private readonly mail: MailService,
    private readonly config: AppConfig,
    private readonly redis: RedisService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'AuthService' });
  }

  // =========================================================================
  // Password sign-in
  // =========================================================================

  /**
   * Authenticates with email and password.
   *
   * Every failure path returns the same generic error and burns comparable CPU time.
   * Distinguishing "no such account" from "wrong password", or returning quickly for
   * one of them, hands an attacker a working account-enumeration oracle.
   */
  async loginWithPassword(input: {
    email: string;
    password: string;
    tenantSlug?: string;
    origin: SessionOrigin;
  }): Promise<AuthenticatedResult> {
    const email = input.email.trim().toLowerCase();

    // Pre-authentication lookup: the tenant is not known yet, so this is one of the
    // three sanctioned uses of an RLS bypass.
    const candidates = await this.contexts.runWithBypass('authentication', {}, () =>
      this.findLoginCandidates(email, input.tenantSlug),
    );

    if (candidates.length === 0) {
      await this.passwords.burnTimingBudget(input.password);
      throw this.invalidCredentials();
    }

    if (candidates.length > 1) {
      // The same address exists in several workspaces. We must ask which one, and
      // that necessarily reveals the address is in use somewhere - unavoidable, and
      // the alternative (guessing) would sign the user into the wrong tenant.
      throw new AppException(
        ErrorCode.TENANT_CONTEXT_MISSING,
        409,
        'This email belongs to more than one workspace. Include your workspace to sign in.',
        { errors: [{ path: 'tenantSlug', message: 'required when the email is shared' }] },
      );
    }

    const user = candidates[0]!;

    this.assertNotLocked(user);

    const valid = await this.passwords.verify(user.passwordHash, input.password);

    if (!valid) {
      await this.contexts.runWithBypass('authentication', {}, () => this.recordFailedLogin(user));
      throw this.invalidCredentials();
    }

    this.assertUsableAccount(user);

    return this.contexts.runWithBypass('authentication', { userId: user.id }, async () => {
      // Successful sign-in clears the lockout counter and upgrades the hash if the
      // cost parameters have since been raised.
      const rehash =
        user.passwordHash && this.passwords.needsRehash(user.passwordHash)
          ? await this.passwords.hash(input.password)
          : undefined;

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          ...(rehash ? { passwordHash: rehash, passwordUpdatedAt: new Date() } : {}),
        },
      });

      if (rehash) {
        this.logger.info({ userId: user.id }, 'Password hash upgraded to current parameters');
      }

      return this.issueSession(user, input.origin, 'password');
    });
  }

  // =========================================================================
  // Self-Service Organization & Administrator Registration
  // =========================================================================

  /**
   * Registers a new tenant organization and its primary administrator account.
   * Sends a confirmation and welcome email via Office 365 SMTP.
   */
  async registerOrganization(input: {
    companyName: string;
    fullName: string;
    email: string;
    password: string;
    origin: SessionOrigin;
  }): Promise<AuthenticatedResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const cleanCompany = input.companyName.trim();
    const cleanName = input.fullName.trim();

    return this.contexts.runWithBypass('authentication', {}, async () => {
      // 1. Check if email already registered
      const existingUser = await this.prisma.client.user.findFirst({
        where: { email: normalizedEmail },
      });

      if (existingUser) {
        throw AppException.conflict(
          'An account with this email address already exists. Please log in.',
        );
      }

      // 2. Hash password with Argon2id
      const passwordHash = await this.passwords.hash(input.password);

      // 3. Create slug
      const baseSlug = cleanCompany
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 30);
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const tenantSlug = `${baseSlug || 'tenant'}-${randomSuffix}`;

      const prefix =
        cleanCompany
          .replace(/[^a-zA-Z]/g, '')
          .slice(0, 3)
          .toUpperCase() || 'AB';

      // 4. Create Tenant, Default Brand, Team, Queue and Administrator User
      const tenant = await this.prisma.client.tenant.create({
        data: {
          slug: tenantSlug,
          name: cleanCompany,
          ticketPrefix: prefix,
          status: 'ACTIVE',
        },
      });

      const brand = await this.prisma.client.brand.create({
        data: {
          tenantId: tenant.id,
          name: `${cleanCompany} Helpdesk`,
          slug: 'default',
          isDefault: true,
          primaryColor: '#3B82F6',
        },
      });

      await this.prisma.client.team.create({
        data: {
          tenantId: tenant.id,
          name: 'General Support',
          slug: 'general-support',
          description: 'Frontline support team',
        },
      });

      await this.prisma.client.queue.create({
        data: {
          tenantId: tenant.id,
          brandId: brand.id,
          name: 'General Queue',
          slug: 'general-queue',
          description: 'Default incoming customer queue',
        },
      });

      const user = await this.prisma.client.user.create({
        data: {
          tenantId: tenant.id,
          email: normalizedEmail,
          fullName: cleanName,
          kind: 'STAFF',
          status: 'ACTIVE',
          passwordHash,
          emailVerifiedAt: new Date(),
        },
        select: USER_SELECT,
      });

      const adminRole = await this.prisma.client.role.findFirst({
        where: { key: 'TENANT_ADMIN' },
      });

      if (adminRole) {
        await this.prisma.client.userRole.create({
          data: {
            tenantId: tenant.id,
            userId: user.id,
            roleId: adminRole.id,
          },
        });
      }

      // 5. Send Real Welcome & Registration Email via Office 365 SMTP
      try {
        const baseUrl = this.resolveConsoleBaseUrl(input.origin);
        const welcomeMail = welcomeRegistrationEmail({
          email: normalizedEmail,
          fullName: cleanName,
          companyName: cleanCompany,
          loginUrl: `${baseUrl}/login`,
        });

        await this.mail.send(welcomeMail);
        this.logger.info(
          { email: normalizedEmail, tenantId: tenant.id },
          'Welcome registration email dispatched',
        );
      } catch (err: unknown) {
        this.logger.warn(
          { error: err, email: normalizedEmail },
          'Failed to dispatch welcome registration email',
        );
      }

      // 6. Issue immediate authenticated session
      return this.issueSession(user, input.origin, 'password');
    });
  }

  // =========================================================================
  // Self-Service OTP Registration
  // =========================================================================

  /**
   * Generates a 6-digit verification OTP and registers the organization details in Redis.
   * Sends the OTP to the user's email.
   */
  async requestRegistrationOtp(input: {
    companyName: string;
    fullName: string;
    email: string;
    password: string;
    origin: SessionOrigin;
  }): Promise<{ message: string }> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const cleanCompany = input.companyName.trim();
    const cleanName = input.fullName.trim();

    return this.contexts.runWithBypass('authentication', {}, async () => {
      // 1. Check if email already registered
      const existingUser = await this.prisma.client.user.findFirst({
        where: { email: normalizedEmail, deletedAt: null },
      });

      if (existingUser) {
        throw AppException.conflict(
          'An account with this email address already exists. Please log in.',
        );
      }

      // 2. Hash password with Argon2id immediately so we don't store plaintext in Redis
      const passwordHash = await this.passwords.hash(input.password);

      // 3. Generate a 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();

      // 4. Save registration details in Redis with 15-minute expiration (900 seconds)
      const redisKey = `register:otp:${normalizedEmail}`;
      const payload = {
        otp,
        companyName: cleanCompany,
        fullName: cleanName,
        passwordHash,
        attempts: 0,
      };

      await this.redis.client.set(redisKey, JSON.stringify(payload), 'EX', 900);

      // 5. Send Verification OTP email
      try {
        const otpMail = registrationOtpEmail({
          email: normalizedEmail,
          fullName: cleanName,
          companyName: cleanCompany,
          otp,
          expiresInMinutes: 15,
        });

        await this.mail.send(otpMail);
        this.logger.info({ email: normalizedEmail }, 'Registration OTP email dispatched');
      } catch (err: unknown) {
        this.logger.warn(
          { error: err, email: normalizedEmail },
          'Failed to dispatch registration OTP email',
        );
        throw new AppException(
          ErrorCode.INTERNAL_ERROR,
          500,
          'Failed to send OTP verification email. Please try again.',
        );
      }

      return { message: 'OTP verification code sent to your email.' };
    });
  }

  /**
   * Verifies the OTP, retrieves cached details from Redis, and JIT-creates the organization, tenant, and admin user in the database.
   */
  async verifyRegistrationOtp(input: {
    email: string;
    otp: string;
    origin: SessionOrigin;
  }): Promise<AuthenticatedResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const redisKey = `register:otp:${normalizedEmail}`;

    return this.contexts.runWithBypass('authentication', {}, async () => {
      // 1. Retrieve the registration payload from Redis
      const rawPayload = await this.redis.client.get(redisKey);
      if (!rawPayload) {
        throw AppException.badRequest(
          'Verification code has expired or is invalid. Please sign up again.',
        );
      }

      const payload = JSON.parse(rawPayload);

      // 2. Brute-force protection: check and increment attempts
      payload.attempts += 1;
      if (payload.attempts > 3) {
        await this.redis.client.del(redisKey);
        throw AppException.badRequest(
          'Too many incorrect verification attempts. Please sign up again.',
        );
      }

      // Save updated attempts count back to Redis
      await this.redis.client.set(redisKey, JSON.stringify(payload), 'KEEPTTL');

      // 3. Verify the entered OTP matches
      if (payload.otp !== input.otp.trim()) {
        throw AppException.badRequest('Invalid verification code.');
      }

      // 4. Create Tenant, default Brand, Team, Queue, and Administrator User
      const cleanCompany = payload.companyName;
      const cleanName = payload.fullName;
      const passwordHash = payload.passwordHash;

      // 5. Slugify and Prefix creation
      const baseSlug = cleanCompany
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-')
        .slice(0, 30);
      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const tenantSlug = `${baseSlug || 'tenant'}-${randomSuffix}`;
      const prefix =
        cleanCompany
          .replace(/[^a-zA-Z]/g, '')
          .slice(0, 3)
          .toUpperCase() || 'AB';

      const result = await this.prisma.run(async (tx) => {
        const tenant = await tx.tenant.create({
          data: {
            slug: tenantSlug,
            name: cleanCompany,
            ticketPrefix: prefix,
            status: 'ACTIVE',
          },
        });

        const brand = await tx.brand.create({
          data: {
            tenantId: tenant.id,
            name: `${cleanCompany} Helpdesk`,
            slug: 'default',
            isDefault: true,
            primaryColor: '#3B82F6',
          },
        });

        // Automatically provision initial WidgetConfig for the default brand
        const publicKey = `pk_${randomBytes(16).toString('hex')}`;
        const rawSigningSecret = `sk_${randomBytes(32).toString('hex')}`;
        const signingSecretEncrypted = sealSecret(rawSigningSecret, this.config.encryptionKey);
        const signingSecretLast4 = rawSigningSecret.slice(-4);

        await tx.widgetConfig.create({
          data: {
            tenantId: tenant.id,
            brandId: brand.id,
            publicKey,
            signingSecretEncrypted,
            signingSecretLast4,
            allowedOrigins: [],
          },
        });

        await tx.team.create({
          data: {
            tenantId: tenant.id,
            name: 'General Support',
            slug: 'general-support',
            description: 'Frontline support team',
          },
        });

        await tx.queue.create({
          data: {
            tenantId: tenant.id,
            brandId: brand.id,
            name: 'General Queue',
            slug: 'general-queue',
            description: 'Default incoming customer queue',
          },
        });

        const user = await tx.user.create({
          data: {
            tenantId: tenant.id,
            email: normalizedEmail,
            fullName: cleanName,
            kind: 'STAFF',
            status: 'ACTIVE',
            passwordHash,
            emailVerifiedAt: new Date(),
          },
          select: USER_SELECT,
        });

        const adminRole = await tx.role.findFirst({
          where: { key: 'TENANT_ADMIN' },
        });

        if (adminRole) {
          await tx.userRole.create({
            data: {
              tenantId: tenant.id,
              userId: user.id,
              roleId: adminRole.id,
            },
          });
        }

        return { tenant, user };
      });

      // 6. Send Congratulations and Welcome Email
      try {
        const baseUrl = this.resolveConsoleBaseUrl(input.origin);
        const welcomeMail = welcomeRegistrationEmail({
          email: normalizedEmail,
          fullName: cleanName,
          companyName: cleanCompany,
          loginUrl: `${baseUrl}/login`,
        });

        await this.mail.send(welcomeMail);
        this.logger.info(
          { email: normalizedEmail, tenantId: result.tenant.id },
          'Welcome registration email dispatched',
        );
      } catch (err: unknown) {
        this.logger.warn(
          { error: err, email: normalizedEmail },
          'Failed to dispatch welcome registration email',
        );
      }

      // 7. Clean up OTP data from Redis
      await this.redis.client.del(redisKey);

      // 8. Issue immediate authenticated session
      return this.issueSession(result.user, input.origin, 'password');
    });
  }

  // =========================================================================
  // Refresh
  // =========================================================================

  /**
   * Exchanges a refresh token for a new pair.
   *
   * Reuse of a spent token revokes the whole family (see SessionService) and emails
   * the account owner, because that is the only signal they will get that a token
   * was copied.
   */
  async refresh(rawToken: string, origin: SessionOrigin): Promise<AuthenticatedResult> {
    return this.contexts.runWithBypass('authentication', {}, async () => {
      let rotation;

      try {
        rotation = await this.sessions.rotate(rawToken, origin);
      } catch (error: unknown) {
        if (
          error instanceof AppException &&
          error.code === ErrorCode.SESSION_REVOKED &&
          error.logContext?.reason === 'token-reuse'
        ) {
          void this.notifyTokenReuse(rawToken, origin);
        }
        throw error;
      }

      const user = await this.prisma.client.user.findUnique({
        where: { id: rotation.userId },
        select: USER_SELECT,
      });

      if (!user) {
        throw AppException.unauthenticated('Account no longer exists.');
      }

      this.assertUsableAccount(user);

      const authority = await this.permissions.resolve(user.id, user.tenantId);

      const tokens = await this.mintAccessToken({
        user,
        sessionId: rotation.outcome.session.id,
        familyId: rotation.outcome.session.familyId,
        roles: authority.roles,
        brandId: authority.brandId,
        refreshToken: rotation.outcome.refreshToken,
      });

      return {
        tokens,
        principal: this.toPrincipal(user, {
          sessionId: rotation.outcome.session.id,
          familyId: rotation.outcome.session.familyId,
          roles: authority.roles,
          permissions: authority.permissions,
          brandId: authority.brandId,
          isPlatformAdmin: authority.isPlatformAdmin,
        }),
        csrfToken: this.tokens.createCsrfToken(),
      };
    });
  }

  // =========================================================================
  // Sign out
  // =========================================================================

  async logout(familyId: string): Promise<void> {
    await this.contexts.runWithBypass('authentication', {}, () =>
      this.sessions.revokeFamily(familyId, REVOCATION_REASON.LOGOUT),
    );
  }

  /**
   * Signs out using only a refresh token.
   *
   * Needed because logout must work when the access token has already expired -
   * otherwise a user who left a tab open overnight cannot sign out, and the session
   * stays alive for the rest of the refresh window. Resolves the family without
   * rotating, so no new tokens are issued.
   */
  async logoutByRefreshToken(rawToken: string): Promise<void> {
    const digest = this.tokens.digestRefreshToken(rawToken);

    await this.contexts.runWithBypass('authentication', {}, async () => {
      const session = await this.prisma.client.session.findUnique({
        where: { refreshTokenHash: digest },
        select: { familyId: true },
      });

      // Unknown token: nothing to revoke. Reported as success either way, since
      // "log me out" has no failure mode a client can act on.
      if (!session) return;

      await this.sessions.revokeFamily(session.familyId, REVOCATION_REASON.LOGOUT);
    });
  }

  async logoutEverywhere(userId: string): Promise<number> {
    return this.contexts.runWithBypass('authentication', { userId }, () =>
      this.sessions.revokeAllForUser(userId, REVOCATION_REASON.LOGOUT_ALL),
    );
  }

  async getWidgetConfig(publicKey: string, origin?: string) {
    const config = await this.contexts.runWithBypass('authentication', {}, () =>
      this.prisma.client.widgetConfig.findFirst({
        where: { publicKey, isActive: true },
        include: {
          brand: {
            select: {
              name: true,
              primaryColor: true,
              accentColor: true,
              isActive: true,
            },
          },
        },
      }),
    );

    if (!config || !config.brand.isActive) {
      throw AppException.notFound('Widget configuration not found or inactive.');
    }

    if (config.allowedOrigins.length > 0 && origin) {
      const normalised = origin.replace(/\/+$/, '').toLowerCase();
      const allowed = config.allowedOrigins.some(
        (ao) => ao.replace(/\/+$/, '').toLowerCase() === normalised,
      );
      if (!allowed) {
        throw new AppException(
          ErrorCode.UNAUTHENTICATED,
          403,
          `Origin '${origin}' is not authorized for this widget.`,
        );
      }
    }

    return {
      publicKey: config.publicKey,
      brandName: config.brand.name,
      primaryColor: config.brand.primaryColor || '#2563EB',
      accentColor: config.brand.accentColor || '#1E40AF',
      launcherPosition: config.launcherPosition,
      launcherLabel: config.launcherLabel,
      welcomeMessage: config.welcomeMessage,
      privacyNotice: config.privacyNotice,
      requireConsent: config.requireConsent,
      screenshotEnabled: config.screenshotEnabled,
      annotationEnabled: config.annotationEnabled,
      screenRecordingEnabled: config.screenRecordingEnabled,
      voiceRecordingEnabled: config.voiceRecordingEnabled,
      attachmentsEnabled: config.attachmentsEnabled,
      consoleCaptureEnabled: config.consoleCaptureEnabled,
      networkCaptureEnabled: config.networkCaptureEnabled,
      errorCaptureEnabled: config.errorCaptureEnabled,
      liveChatEnabled: config.liveChatEnabled,
      anonymousTicketsEnabled: config.anonymousTicketsEnabled,
      widgetEnabled: config.widgetEnabled,
    };
  }

  // =========================================================================
  // Magic link (widget visitors with no host-app account)
  // =========================================================================

  /**
   * Requests a sign-in link.
   *
   * Always reports success. Whether the address exists is exactly what an attacker
   * wants to learn, and this endpoint is reachable from any embedded widget.
   */
  async requestMagicLink(input: {
    email: string;
    widgetPublicKey: string;
    origin: SessionOrigin;
  }): Promise<{ expiresInMinutes: number }> {
    const email = input.email.trim().toLowerCase();
    const ttlMinutes = this.config.auth.magicLinkTtlMinutes;

    // Two limits: per address (inbox flooding) and per source address (enumeration
    // sweeps across many emails from one host).
    const withinEmailLimit = await this.oneTimeTokens.consumeRateLimit(
      'magic-link',
      email,
      5,
      15 * 60,
    );
    const withinIpLimit = input.origin.ipAddress
      ? await this.oneTimeTokens.consumeRateLimit(
          'magic-link',
          `ip:${input.origin.ipAddress}`,
          20,
          15 * 60,
        )
      : true;

    if (!withinEmailLimit || !withinIpLimit) {
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        429,
        'Too many sign-in link requests. Try again shortly.',
      );
    }

    const widget = await this.contexts.runWithBypass('authentication', {}, () =>
      this.prisma.client.widgetConfig.findUnique({
        where: { publicKey: input.widgetPublicKey },
        select: {
          tenantId: true,
          brandId: true,
          isActive: true,
          anonymousTicketsEnabled: true,
          brand: { select: { name: true, isActive: true } },
        },
      }),
    );

    if (!widget?.isActive || !widget.brand.isActive || !widget.anonymousTicketsEnabled) {
      // A bad or disabled widget key is a configuration error on the host page, not
      // a credential problem, so it is safe to be specific.
      throw AppException.badRequest('This widget is not configured for email sign-in.');
    }

    const { token } = await this.oneTimeTokens.issue(
      {
        purpose: 'magic-link',
        email,
        tenantId: widget.tenantId,
        brandId: widget.brandId,
      },
      ttlMinutes * 60,
    );

    const baseUrl = this.resolveConsoleBaseUrl(input.origin);
    const url = `${baseUrl}/auth/magic-link?token=${encodeURIComponent(token)}`;

    void this.mail.send(
      magicLinkEmail({
        email,
        url,
        expiresInMinutes: ttlMinutes,
        brandName: widget.brand.name,
      }),
    );

    await this.audit({
      tenantId: widget.tenantId,
      action: 'auth.magic_link_requested',
      resourceType: 'user',
      resourceLabel: email,
      origin: input.origin,
    });

    return { expiresInMinutes: ttlMinutes };
  }

  /**
   * Redeems a sign-in link.
   *
   * Creates the customer account on first use. A widget visitor has no account until
   * they engage support, and forcing a registration step before they can report a
   * problem is how you lose the report.
   */
  async redeemMagicLink(rawToken: string, origin: SessionOrigin): Promise<AuthenticatedResult> {
    const payload = await this.oneTimeTokens.consume<{
      purpose: 'magic-link';
      email: string;
      tenantId: string;
      brandId: string;
    }>('magic-link', rawToken);

    if (!payload) {
      throw AppException.unauthenticated(
        'This sign-in link is invalid, expired, or already used.',
        ErrorCode.TOKEN_INVALID,
      );
    }

    return this.contexts.runWithBypass('authentication', {}, async () => {
      const user = await this.prisma.run(async (tx) => {
        const existing = await tx.user.findFirst({
          where: { email: payload.email, tenantId: payload.tenantId },
          select: USER_SELECT,
        });

        if (existing) {
          await tx.user.update({
            where: { id: existing.id },
            data: {
              // Redeeming a link proves control of the mailbox.
              emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
              lastLoginAt: new Date(),
              status: existing.status === 'INVITED' ? 'ACTIVE' : existing.status,
            },
          });
          return { ...existing, status: 'ACTIVE' as const };
        }

        const guestRole = await tx.role.findUniqueOrThrow({
          where: { key: 'GUEST_CUSTOMER' },
          select: { id: true },
        });

        const created = await tx.user.create({
          data: {
            tenantId: payload.tenantId,
            email: payload.email,
            fullName: payload.email.split('@')[0] ?? payload.email,
            kind: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            lastLoginAt: new Date(),
            isAvailable: false,
            roles: {
              create: { roleId: guestRole.id, tenantId: payload.tenantId },
            },
          },
          select: USER_SELECT,
        });

        return created;
      });

      await this.audit({
        tenantId: payload.tenantId,
        actorId: user.id,
        action: 'auth.magic_link_redeemed',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.email,
        origin,
      });

      return this.issueSession(user, origin, 'magic-link');
    });
  }

  // =========================================================================
  // Password reset
  // =========================================================================

  /** Requests a reset link. Always reports success, for the same reason as above. */
  async requestPasswordReset(input: {
    email: string;
    tenantSlug?: string;
    origin: SessionOrigin;
  }): Promise<{ expiresInMinutes: number }> {
    const email = input.email.trim().toLowerCase();
    const ttlMinutes = this.config.auth.passwordResetTtlMinutes;

    const allowed = await this.oneTimeTokens.consumeRateLimit('password-reset', email, 5, 15 * 60);

    if (!allowed) {
      // Rate limited rather than silently dropped: a legitimate user who clicks
      // twice deserves to know why nothing arrived.
      throw new AppException(
        ErrorCode.RATE_LIMITED,
        429,
        'Too many reset requests. Try again shortly.',
      );
    }

    const candidates = await this.contexts.runWithBypass('authentication', {}, () =>
      this.findLoginCandidates(email, input.tenantSlug),
    );

    // Exactly one match, and only for accounts that can actually use a password.
    if (candidates.length === 1) {
      const user = candidates[0]!;

      if (user.status === 'ACTIVE' || user.status === 'INVITED') {
        const { token } = await this.oneTimeTokens.issue(
          {
            purpose: 'password-reset',
            userId: user.id,
            email: user.email,
            tenantId: user.tenantId,
          },
          ttlMinutes * 60,
        );

        const baseUrl = this.resolveConsoleBaseUrl(input.origin);
        const url = `${baseUrl}/auth/reset-password?token=${encodeURIComponent(token)}`;

        void this.mail.send(
          passwordResetEmail({
            email: user.email,
            fullName: user.fullName,
            url,
            expiresInMinutes: ttlMinutes,
          }),
        );

        await this.audit({
          tenantId: user.tenantId,
          actorId: user.id,
          action: 'auth.password_reset_requested',
          resourceType: 'user',
          resourceId: user.id,
          resourceLabel: user.email,
          origin: input.origin,
        });
      }
    }

    return { expiresInMinutes: ttlMinutes };
  }

  /**
   * Completes a reset.
   *
   * Signs out every other session: a reset is what someone does when they suspect
   * compromise, and leaving existing sessions alive would defeat the point.
   */
  async completePasswordReset(input: {
    token: string;
    password: string;
    origin: SessionOrigin;
  }): Promise<void> {
    const payload = await this.oneTimeTokens.consume<{
      purpose: 'password-reset';
      userId: string;
      email: string;
      tenantId: string | null;
    }>('password-reset', input.token);

    if (!payload) {
      throw AppException.unauthenticated(
        'This reset link is invalid, expired, or already used.',
        ErrorCode.TOKEN_INVALID,
      );
    }

    await this.contexts.runWithBypass('authentication', { userId: payload.userId }, async () => {
      const user = await this.prisma.client.user.findUnique({
        where: { id: payload.userId },
        select: USER_SELECT,
      });

      if (!user) {
        throw AppException.unauthenticated('Account no longer exists.');
      }

      this.passwords.assertAcceptable(input.password, {
        email: user.email,
        fullName: user.fullName,
      });

      const passwordHash = await this.passwords.hash(input.password);

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          passwordUpdatedAt: new Date(),
          failedLoginCount: 0,
          lockedUntil: null,
          status: user.status === 'INVITED' ? 'ACTIVE' : user.status,
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      });

      await this.sessions.revokeAllForUser(user.id, REVOCATION_REASON.PASSWORD_CHANGED);

      void this.mail.send(
        passwordChangedEmail({
          email: user.email,
          fullName: user.fullName,
          changedAt: new Date(),
          ipAddress: input.origin.ipAddress,
        }),
      );

      await this.audit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'auth.password_reset_completed',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.email,
        origin: input.origin,
      });
    });
  }

  /** Changes a password for an already-authenticated user. */
  async changePassword(input: {
    userId: string;
    tenantId: string | null;
    currentPassword: string;
    newPassword: string;
    origin: SessionOrigin;
    keepSessionFamilyId?: string;
  }): Promise<void> {
    await this.contexts.runWithBypass('authentication', { userId: input.userId }, async () => {
      const user = await this.prisma.client.user.findUnique({
        where: { id: input.userId },
        select: USER_SELECT,
      });

      if (!user) throw AppException.unauthenticated();

      const valid = await this.passwords.verify(user.passwordHash, input.currentPassword);

      if (!valid) {
        throw new AppException(
          ErrorCode.INVALID_CREDENTIALS,
          400,
          'The current password is incorrect.',
          { errors: [{ path: 'currentPassword', message: 'incorrect' }] },
        );
      }

      this.passwords.assertAcceptable(input.newPassword, {
        email: user.email,
        fullName: user.fullName,
      });

      const passwordHash = await this.passwords.hash(input.newPassword);

      await this.prisma.client.user.update({
        where: { id: user.id },
        data: { passwordHash, passwordUpdatedAt: new Date() },
      });

      await this.sessions.revokeAllForUser(user.id, REVOCATION_REASON.PASSWORD_CHANGED);

      void this.mail.send(
        passwordChangedEmail({
          email: user.email,
          fullName: user.fullName,
          changedAt: new Date(),
          ipAddress: input.origin.ipAddress,
        }),
      );

      await this.audit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'auth.password_changed',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.email,
        origin: input.origin,
      });
    });
  }

  // =========================================================================
  // Invitations
  // =========================================================================

  /** Invitation details for the acceptance screen. Consumes nothing. */
  async describeInvitation(rawToken: string): Promise<{
    email: string;
    tenantName: string;
    brandName: string | null;
    roleName: string;
    expiresAt: Date;
    requiresPassword: boolean;
  }> {
    const digest = this.tokens.digestOneTimeToken(rawToken);

    const invitation = await this.contexts.runWithBypass('authentication', {}, () =>
      this.prisma.client.invitation.findUnique({
        where: { tokenHash: digest },
        select: {
          email: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          tenantId: true,
          tenant: { select: { name: true } },
          brand: { select: { name: true } },
          role: { select: { name: true } },
        },
      }),
    );

    if (!invitation || invitation.revokedAt || invitation.acceptedAt) {
      throw AppException.notFound('Invitation');
    }

    if (invitation.expiresAt.getTime() <= Date.now()) {
      throw new AppException(ErrorCode.TOKEN_EXPIRED, 410, 'This invitation has expired.');
    }

    const existing = await this.contexts.runWithBypass('authentication', {}, () =>
      this.prisma.client.user.findFirst({
        where: { email: invitation.email, tenantId: invitation.tenantId },
        select: { passwordHash: true },
      }),
    );

    return {
      email: invitation.email,
      tenantName: invitation.tenant.name,
      brandName: invitation.brand?.name ?? null,
      roleName: invitation.role.name,
      expiresAt: invitation.expiresAt,
      requiresPassword: !existing?.passwordHash,
    };
  }

  /** Accepts an invitation, creating or activating the account. */
  async acceptInvitation(input: {
    token: string;
    fullName?: string;
    password?: string;
    origin: SessionOrigin;
  }): Promise<AuthenticatedResult> {
    const digest = this.tokens.digestOneTimeToken(input.token);

    return this.contexts.runWithBypass('authentication', {}, async () => {
      const user = await this.prisma.run(async (tx) => {
        const invitation = await tx.invitation.findUnique({
          where: { tokenHash: digest },
          select: {
            id: true,
            email: true,
            tenantId: true,
            brandId: true,
            roleId: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
          },
        });

        if (!invitation || invitation.revokedAt) {
          throw AppException.notFound('Invitation');
        }

        if (invitation.acceptedAt) {
          throw AppException.conflict('This invitation has already been accepted.');
        }

        if (invitation.expiresAt.getTime() <= Date.now()) {
          throw new AppException(ErrorCode.TOKEN_EXPIRED, 410, 'This invitation has expired.');
        }

        const existing = await tx.user.findFirst({
          where: { email: invitation.email, tenantId: invitation.tenantId },
          select: USER_SELECT,
        });

        let passwordHash: string | undefined;

        if (!existing?.passwordHash) {
          if (!input.password) {
            throw AppException.unprocessable('A password is required to accept this invitation.', [
              { path: 'password', message: 'required' },
            ]);
          }

          this.passwords.assertAcceptable(input.password, {
            email: invitation.email,
            fullName: input.fullName,
          });

          passwordHash = await this.passwords.hash(input.password);
        }

        const account = existing
          ? await tx.user.update({
              where: { id: existing.id },
              data: {
                status: 'ACTIVE',
                emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
                lastLoginAt: new Date(),
                ...(input.fullName ? { fullName: input.fullName } : {}),
                ...(passwordHash ? { passwordHash, passwordUpdatedAt: new Date() } : {}),
              },
              select: USER_SELECT,
            })
          : await tx.user.create({
              data: {
                tenantId: invitation.tenantId,
                email: invitation.email,
                fullName: input.fullName ?? invitation.email.split('@')[0] ?? invitation.email,
                kind: 'STAFF',
                status: 'ACTIVE',
                emailVerifiedAt: new Date(),
                lastLoginAt: new Date(),
                passwordHash: passwordHash ?? null,
                passwordUpdatedAt: passwordHash ? new Date() : null,
              },
              select: USER_SELECT,
            });

        // Idempotent: a re-run must not create a duplicate assignment. The
        // uniqueness guarantee is a partial index, so Prisma cannot target it.
        const assigned = await tx.userRole.findFirst({
          where: { userId: account.id, roleId: invitation.roleId, brandId: invitation.brandId },
          select: { id: true },
        });

        if (!assigned) {
          await tx.userRole.create({
            data: {
              userId: account.id,
              roleId: invitation.roleId,
              brandId: invitation.brandId,
              tenantId: invitation.tenantId,
            },
          });
        }

        await tx.invitation.update({
          where: { id: invitation.id },
          data: { acceptedAt: new Date(), acceptedUserId: account.id },
        });

        return account;
      });

      await this.permissions.invalidateUser(user.id, user.tenantId);

      await this.audit({
        tenantId: user.tenantId,
        actorId: user.id,
        action: 'auth.invitation_accepted',
        resourceType: 'user',
        resourceId: user.id,
        resourceLabel: user.email,
        origin: input.origin,
      });

      return this.issueSession(user, input.origin, 'invitation');
    });
  }

  /** Sends (or re-sends) an invitation email. Called by the admin module. */
  async sendInvitationEmail(input: {
    invitationId: string;
    rawToken: string;
    inviterName: string;
  }): Promise<void> {
    const invitation = await this.prisma.client.invitation.findUnique({
      where: { id: input.invitationId },
      select: {
        email: true,
        message: true,
        expiresAt: true,
        tenant: { select: { name: true } },
        role: { select: { name: true } },
      },
    });

    if (!invitation) return;

    const url = `${this.config.urls.console}/auth/accept-invitation?token=${encodeURIComponent(input.rawToken)}`;
    const days = Math.max(1, Math.ceil((invitation.expiresAt.getTime() - Date.now()) / 86_400_000));

    void this.mail.send(
      invitationEmail({
        email: invitation.email,
        inviterName: input.inviterName,
        tenantName: invitation.tenant.name,
        roleName: invitation.role.name,
        url,
        expiresInDays: days,
        ...(invitation.message ? { message: invitation.message } : {}),
      }),
    );
  }

  // =========================================================================
  // Principal resolution (used by the auth guard)
  // =========================================================================

  /**
   * Builds the principal for a verified access token.
   *
   * Checks family revocation before anything else: that is what makes sign-out take
   * effect immediately rather than at the end of the access token's lifetime.
   */
  async resolvePrincipal(claims: {
    sub: string;
    tid: string | null;
    sid: string;
    fid: string;
  }): Promise<AuthenticatedPrincipal> {
    return this.contexts.runWithBypass('authentication', { userId: claims.sub }, async () => {
      if (await this.sessions.isFamilyRevoked(claims.fid)) {
        throw new AppException(ErrorCode.SESSION_REVOKED, 401, 'This session has been signed out.');
      }

      const user = await this.prisma.client.user.findUnique({
        where: { id: claims.sub },
        select: USER_SELECT,
      });

      if (!user) {
        throw AppException.unauthenticated('Account no longer exists.');
      }

      this.assertUsableAccount(user);

      const authority = await this.permissions.resolve(user.id, user.tenantId);

      return this.toPrincipal(user, {
        sessionId: claims.sid,
        familyId: claims.fid,
        roles: authority.roles,
        permissions: authority.permissions,
        brandId: authority.brandId,
        isPlatformAdmin: authority.isPlatformAdmin,
      });
    });
  }

  /**
   * Resolves a principal for anonymous widget submissions.
   *
   * Enterprise hardening layers (in order):
   *  1. **Public key validation** — the key must map to an active widget config.
   *  2. **Anonymous tickets gate** — `anonymousTicketsEnabled` must be true.
   *  3. **Origin allowlist** — if `allowedOrigins` is configured, the request's
   *     `Origin` header must match one of them. This is an authorization check, not
   *     just CORS, because CORS alone is not a security boundary.
   *  4. **Redis rate limiting** — max 10 anonymous tickets per IP per hour. Prevents
   *     spam flooding without impacting legitimate visitors.
   *  5. **Minimal principal** — a shared `GUEST_CUSTOMER` user with only `ticket:create`
   *     permission. No session tokens are issued.
   */
  async resolveWidgetPrincipal(
    publicKey: string,
    origin?: string,
    clientIp?: string,
    widgetUserEmail?: string,
    widgetUserToken?: string,
    method?: string,
    url?: string,
  ): Promise<AuthenticatedPrincipal> {
    return this.contexts.runWithBypass('authentication', {}, async () => {
      const widget = await this.prisma.client.widgetConfig.findUnique({
        where: { publicKey },
        select: {
          tenantId: true,
          brandId: true,
          isActive: true,
          anonymousTicketsEnabled: true,
          allowedOrigins: true,
        },
      });

      if (!widget || !widget.isActive) {
        throw new AppException(
          ErrorCode.UNAUTHENTICATED,
          401,
          'Widget key is invalid or the widget is deactivated.',
        );
      }

      if (!widget.anonymousTicketsEnabled) {
        throw new AppException(
          ErrorCode.UNAUTHENTICATED,
          401,
          'Anonymous ticket submission is disabled for this widget.',
        );
      }

      // ── Origin allowlist enforcement ──────────────────────────────────────
      // When allowedOrigins is populated, only requests from those domains are
      // accepted. An empty array means "allow any origin" (development / testing).
      if (widget.allowedOrigins.length > 0 && origin) {
        const normalised = origin.replace(/\/+$/, '').toLowerCase();
        const allowed = widget.allowedOrigins.some(
          (ao) => ao.replace(/\/+$/, '').toLowerCase() === normalised,
        );
        if (!allowed) {
          this.logger.warn(
            { publicKey, origin, allowedOrigins: widget.allowedOrigins },
            'Widget request rejected: origin not in allowlist',
          );
          throw new AppException(
            ErrorCode.UNAUTHENTICATED,
            403,
            `Origin '${origin}' is not authorized for this widget.`,
          );
        }
      }

      // ── Per-IP rate limiting (Redis) ──────────────────────────────────────
      // 10 anonymous submissions per IP per hour. Uses the same INCR+EXPIRE
      // pattern as OTP rate limiting for consistency.
      const isSubmission =
        method === 'POST' &&
        url &&
        (url.includes('/tickets') ||
          (url.includes('/chat/conversations') &&
            !url.includes('/messages') &&
            !url.includes('/accept') &&
            !url.includes('/close') &&
            !url.includes('/typing') &&
            !url.includes('/promote')));

      if (clientIp && isSubmission) {
        const rateLimitKey = `widget:anon-rate:${publicKey}:${clientIp}`;
        const count = await this.redis.client.incr(rateLimitKey);
        if (count === 1) {
          await this.redis.client.expire(rateLimitKey, 3600); // 1 hour window
        }
        if (count > 10) {
          this.logger.warn(
            { publicKey, clientIp, count },
            'Widget anonymous ticket rate limit exceeded',
          );
          throw new AppException(
            ErrorCode.RATE_LIMITED,
            429,
            'Too many ticket submissions. Please try again later.',
          );
        }
      }

      // ── Enforce email verification using the OTP-verified token ────────────
      if (widgetUserEmail && widgetUserEmail.trim() !== 'anonymous-visitor@abidesk.local') {
        const emailLower = widgetUserEmail.trim().toLowerCase();
        if (!widgetUserToken) {
          throw AppException.unauthenticated('Email verification is required.');
        }

        // Verify the token matches the requested email
        const verified = await this.tokens.verifyWidgetToken(widgetUserToken);
        if (verified.email !== emailLower) {
          throw AppException.unauthenticated('Verification token does not match email.');
        }
      }

      // ── Resolve or create the shared or email-specific anonymous visitor user ────────────────
      const targetEmail = widgetUserEmail
        ? widgetUserEmail.trim()
        : 'anonymous-visitor@abidesk.local';

      let user = await this.prisma.client.user.findFirst({
        where: { email: targetEmail, tenantId: widget.tenantId },
        select: USER_SELECT,
      });

      if (!user) {
        const guestRole = await this.prisma.client.role.findFirst({
          where: { key: 'GUEST_CUSTOMER' },
          select: { id: true },
        });

        if (!guestRole) {
          throw new AppException(ErrorCode.INTERNAL_ERROR, 500, 'Guest customer role not found.');
        }

        const namePart = targetEmail.split('@')[0] || '';
        const fullName =
          targetEmail === 'anonymous-visitor@abidesk.local' || !namePart
            ? 'Anonymous Visitor'
            : namePart.charAt(0).toUpperCase() + namePart.slice(1);

        user = await this.prisma.client.user.create({
          data: {
            tenantId: widget.tenantId,
            email: targetEmail,
            fullName,
            kind: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            roles: {
              create: { roleId: guestRole.id, tenantId: widget.tenantId },
            },
          },
          select: USER_SELECT,
        });
      }

      const authority = await this.permissions.resolve(user.id, user.tenantId);

      return this.toPrincipal(user, {
        sessionId: 'anonymous',
        familyId: 'anonymous',
        roles: authority.roles,
        permissions: authority.permissions,
        brandId: widget.brandId,
        isPlatformAdmin: false,
      });
    });
  }

  /** Live sessions for the "your devices" screen. */
  async listSessions(userId: string, currentFamilyId: string) {
    const sessions = await this.contexts.runWithBypass('authentication', { userId }, () =>
      this.sessions.listActiveForUser(userId),
    );

    return sessions.map((session) => ({
      ...session,
      isCurrent: session.familyId === currentFamilyId,
    }));
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.contexts.runWithBypass('authentication', { userId }, () =>
      this.sessions.revokeSessionForUser(sessionId, userId),
    );
  }

  // =========================================================================
  // Internals
  // =========================================================================

  /**
   * Finds accounts matching an email.
   *
   * With `tenantSlug` this is unambiguous. Without it, the same address can exist in
   * several tenants (email is unique *per tenant*, deliberately - one person may be
   * a customer of two vendors using this platform), so the caller has to disambiguate.
   */
  private async findLoginCandidates(email: string, tenantSlug?: string): Promise<AuthUser[]> {
    if (tenantSlug) {
      const tenant = await this.prisma.client.tenant.findUnique({
        where: { slug: tenantSlug.trim().toLowerCase() },
        select: { id: true, status: true },
      });

      if (!tenant) return [];

      if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
        throw new AppException(
          ErrorCode.TENANT_SUSPENDED,
          403,
          'This workspace is not currently active.',
        );
      }

      return this.prisma.client.user.findMany({
        where: { email, tenantId: tenant.id, deletedAt: null },
        select: USER_SELECT,
      });
    }

    return this.prisma.client.user.findMany({
      where: { email, kind: 'STAFF', deletedAt: null },
      select: USER_SELECT,
      take: 5,
    });
  }

  private assertNotLocked(user: AuthUser): void {
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const seconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);

      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        429,
        `Too many failed attempts. Try again in ${Math.ceil(seconds / 60)} minute(s).`,
        { logContext: { userId: user.id, lockedUntil: user.lockedUntil } },
      );
    }
  }

  private assertUsableAccount(user: AuthUser): void {
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw AppException.permissionDenied('This account is not active.', {
        userId: user.id,
        status: user.status,
      });
    }

    if (user.status === 'INVITED') {
      throw AppException.permissionDenied('This account has not completed its invitation.', {
        userId: user.id,
      });
    }
  }

  /**
   * Increments the failure counter and locks the account past the threshold.
   *
   * Lockout is time-boxed rather than permanent: a permanent lock turns a failed
   * password guess into a denial-of-service against the real user.
   */
  private async recordFailedLogin(user: AuthUser): Promise<void> {
    const attempts = user.failedLoginCount + 1;
    const threshold = this.config.auth.maxFailedLogins;

    const lockedUntil =
      attempts >= threshold
        ? new Date(Date.now() + this.config.auth.lockoutMinutes * 60_000)
        : null;

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: lockedUntil ? 0 : attempts,
        ...(lockedUntil ? { lockedUntil } : {}),
      },
    });

    if (lockedUntil) {
      this.logger.warn(
        { userId: user.id, tenantId: user.tenantId, lockedUntil },
        'Account locked after consecutive failed sign-in attempts',
      );
    }
  }

  private invalidCredentials(): AppException {
    return new AppException(ErrorCode.INVALID_CREDENTIALS, 401, 'Email or password is incorrect.');
  }

  /** Creates a session and mints the first token pair. */
  private async issueSession(
    user: AuthUser,
    origin: SessionOrigin,
    method: AuthMethod,
  ): Promise<AuthenticatedResult> {
    const authority = await this.permissions.resolve(user.id, user.tenantId);

    const created = await this.prisma.run((tx) =>
      this.sessions.create(tx, { userId: user.id, tenantId: user.tenantId, origin }),
    );

    const tokens = await this.mintAccessToken({
      user,
      sessionId: created.sessionId,
      familyId: created.familyId,
      roles: authority.roles,
      brandId: authority.brandId,
      refreshToken: created.refreshToken,
    });

    await this.audit({
      tenantId: user.tenantId,
      actorId: user.id,
      action: `auth.signed_in`,
      resourceType: 'session',
      resourceId: created.sessionId,
      resourceLabel: user.email,
      changes: { method },
      origin,
    });

    return {
      tokens,
      principal: this.toPrincipal(user, {
        sessionId: created.sessionId,
        familyId: created.familyId,
        roles: authority.roles,
        permissions: authority.permissions,
        brandId: authority.brandId,
        isPlatformAdmin: authority.isPlatformAdmin,
      }),
      csrfToken: this.tokens.createCsrfToken(),
    };
  }

  private async mintAccessToken(input: {
    user: AuthUser;
    sessionId: string;
    familyId: string;
    roles: RoleKey[];
    brandId: string | null;
    refreshToken: string;
  }): Promise<IssuedTokens> {
    const { token, expiresIn } = await this.tokens.signAccessToken({
      sub: input.user.id,
      tid: input.user.tenantId,
      sid: input.sessionId,
      fid: input.familyId,
      knd: input.user.kind,
      rls: input.roles,
      ...(input.brandId ? { brd: input.brandId } : {}),
    });

    return {
      accessToken: token,
      refreshToken: input.refreshToken,
      expiresIn,
      tokenType: 'Bearer',
    };
  }

  private toPrincipal(
    user: AuthUser,
    extra: {
      sessionId: string;
      familyId: string;
      roles: RoleKey[];
      permissions: string[];
      brandId: string | null;
      isPlatformAdmin: boolean;
    },
  ): AuthenticatedPrincipal {
    return {
      userId: user.id,
      tenantId: user.tenantId,
      sessionId: extra.sessionId,
      familyId: extra.familyId,
      email: user.email,
      fullName: user.fullName,
      kind: user.kind,
      roles: extra.roles,
      permissions: new Set(extra.permissions),
      ...(extra.brandId ? { brandId: extra.brandId } : {}),
      isPlatformAdmin: extra.isPlatformAdmin,
    };
  }

  /**
   * Notifies the account owner that a spent token was replayed.
   *
   * Best-effort and deliberately after the fact: the token is already revoked by
   * this point, and the family id is enough to find the owner.
   */
  private async notifyTokenReuse(rawToken: string, origin: SessionOrigin): Promise<void> {
    try {
      const digest = this.tokens.digestRefreshToken(rawToken);

      const session = await this.contexts.runWithBypass('authentication', {}, () =>
        this.prisma.client.session.findUnique({
          where: { refreshTokenHash: digest },
          select: { user: { select: { email: true, fullName: true } } },
        }),
      );

      if (!session?.user) return;

      void this.mail.send(
        suspiciousRefreshEmail({
          email: session.user.email,
          fullName: session.user.fullName,
          detectedAt: new Date(),
          ipAddress: origin.ipAddress,
        }),
      );
    } catch (error: unknown) {
      this.logger.warn({ err: error }, 'Failed to notify user of refresh token reuse');
    }
  }

  /**
   * Writes an audit entry.
   *
   * Auth events are exactly the entries a security review asks for, including the
   * failed ones, so they are recorded here rather than left to the generic
   * request interceptor (which never sees a rejected sign-in's actor).
   */
  private async audit(entry: {
    tenantId: string | null;
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId?: string;
    resourceLabel?: string;
    changes?: Prisma.InputJsonValue;
    succeeded?: boolean;
    origin: SessionOrigin;
  }): Promise<void> {
    try {
      await this.prisma.client.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorId: entry.actorId ?? null,
          actorType: 'USER',
          actorEmail: entry.resourceLabel ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          resourceLabel: entry.resourceLabel ?? null,
          ...(entry.changes ? { changes: entry.changes } : {}),
          ipAddress: entry.origin.ipAddress ?? null,
          userAgent: entry.origin.userAgent?.slice(0, 512) ?? null,
          succeeded: entry.succeeded ?? true,
        },
      });
    } catch (error: unknown) {
      // Never fail a sign-in because the audit write failed, but make it loud.
      this.logger.error({ err: error, action: entry.action }, 'Failed to write audit entry');
    }
  }

  private resolveConsoleBaseUrl(origin?: CallerContext): string {
    let url = '';
    if (origin?.originHeader && origin.originHeader !== 'null') {
      url = origin.originHeader.replace(/\/+$/, '');
    } else if (origin?.referer && origin.referer !== 'null') {
      try {
        const u = new URL(origin.referer);
        url = `${u.protocol}//${u.host}`;
      } catch {
        url = (this.config.urls.console || 'http://localhost:9999').replace(/\/+$/, '');
      }
    } else {
      url = (this.config.urls.console || 'http://localhost:9999').replace(/\/+$/, '');
    }
    const consoleUrl = this.config.urls.console || 'http://localhost:9999';
    try {
      const parsed = new URL(consoleUrl);
      return url.replace('localhost:9999', parsed.host);
    } catch {
      return url.replace('localhost:9999', '127.0.0.1:9999');
    }
  }

  // -- Widget OTP Verification ---------------------------------------------

  async sendWidgetOtp(email: string, publicKey: string) {
    return this.contexts.runWithBypass('authentication', {}, async () => {
      const widget = await this.prisma.client.widgetConfig.findUnique({
        where: { publicKey },
        select: { tenantId: true, isActive: true, brandId: true },
      });

      if (!widget || !widget.isActive) {
        throw AppException.badRequest('Widget key is invalid or inactive.');
      }

      // Query brand name for email template branding
      const brand = await this.prisma.client.brand.findUnique({
        where: { id: widget.brandId },
        select: { name: true },
      });
      const brandName = brand?.name || 'ABI Desk';

      // Generate a 4-digit code
      const code = Math.floor(1000 + Math.random() * 9000).toString();

      // Store in Redis (5 minutes expiry)
      const key = `widget:otp:${publicKey}:${email.trim().toLowerCase()}`;
      await this.redis.client.set(key, code, 'EX', 300);

      // Send verification mail using the custom branded template
      const otpMail = widgetOtpEmail({
        email: email.trim(),
        otp: code,
        brandName,
      });

      await this.mail.send(otpMail);

      return { status: 'sent', message: 'Verification code sent.' };
    });
  }

  async verifyWidgetOtp(email: string, publicKey: string, otp: string) {
    return this.contexts.runWithBypass('authentication', {}, async () => {
      const widget = await this.prisma.client.widgetConfig.findUnique({
        where: { publicKey },
        select: { tenantId: true, isActive: true },
      });

      if (!widget || !widget.isActive) {
        throw AppException.badRequest('Widget key is invalid or inactive.');
      }

      const emailClean = email.trim().toLowerCase();
      const key = `widget:otp:${publicKey}:${emailClean}`;
      const savedCode = await this.redis.client.get(key);

      if (!savedCode || savedCode !== otp) {
        throw AppException.badRequest('Verification code is invalid or has expired.');
      }

      // Delete OTP on success
      await this.redis.client.del(key);

      // Generate verification token
      const token = await this.tokens.signWidgetToken(emailClean);

      return {
        status: 'verified',
        email: emailClean,
        token,
      };
    });
  }

  async getTenantName(tenantId: string | null | undefined): Promise<string> {
    if (!tenantId) return 'Platform Administration';
    const tenant = await this.prisma.client.tenant.findUnique({
      where: { id: tenantId },
      select: { name: true },
    });
    return tenant?.name ?? 'Unknown Organization';
  }

  async getUserPreferences(userId: string): Promise<{ themeColor?: string | null }> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { externalMetadata: true },
    });
    const metadata = (user?.externalMetadata as Record<string, any>) || {};
    return metadata.preferences || {};
  }

  async updateUserPreferences(
    userId: string,
    dto: { themeColor?: string | null },
  ): Promise<{ preferences: { themeColor?: string | null } }> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { externalMetadata: true },
    });

    const currentMetadata = (user.externalMetadata as Record<string, any>) || {};
    const updatedPreferences = {
      ...(currentMetadata.preferences || {}),
      themeColor: dto.themeColor !== undefined ? dto.themeColor : (currentMetadata.preferences?.themeColor ?? null),
    };

    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        externalMetadata: {
          ...currentMetadata,
          preferences: updatedPreferences,
        },
      },
    });

    return { preferences: updatedPreferences };
  }
}

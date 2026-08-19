import { createHash, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type RoleKey } from '@abi-desk/rbac';
import { type Prisma, openSecret, sealSecret } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { RedisService } from '../../infra/redis/redis.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { SessionService, type SessionOrigin } from '../auth/session.service';
import { TokenService } from '../auth/token.service';
import {
  type ConfigureOidcProviderDto,
  type ConfigureSamlProviderDto,
  type InitiateSsoDto,
} from './sso.dto';

interface SsoStatePayload {
  tenantId: string;
  providerId: string;
  codeVerifier: string;
  redirectUrl?: string;
}

@Injectable()
export class SsoService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfig,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
    private readonly sessions: SessionService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'SsoService' });
  }

  // =========================================================================
  // Provider Configuration
  // =========================================================================

  async configureOidc(principal: AuthenticatedPrincipal, dto: ConfigureOidcProviderDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.ssoProvider.findUnique({
      where: {
        tenantId_protocol_issuer: {
          tenantId,
          protocol: 'OIDC',
          issuer: dto.issuer,
        },
      },
    });

    if (!existing && !dto.clientSecret) {
      throw AppException.badRequest(
        'Client Secret is required when configuring a new OIDC provider.',
      );
    }

    const clientSecretEncrypted = dto.clientSecret
      ? sealSecret(dto.clientSecret, this.config.encryptionKey)
      : existing?.clientSecretEncrypted;

    if (!clientSecretEncrypted) {
      throw AppException.badRequest('Client Secret is required.');
    }

    const provider = await this.db.client.ssoProvider.upsert({
      where: {
        tenantId_protocol_issuer: {
          tenantId,
          protocol: 'OIDC',
          issuer: dto.issuer,
        },
      },
      create: {
        tenantId,
        displayName: dto.name,
        protocol: 'OIDC',
        issuer: dto.issuer,
        clientId: dto.clientId,
        clientSecretEncrypted,
        authorizationEndpoint: dto.authorizationUrl,
        tokenEndpoint: dto.tokenUrl,
        userinfoEndpoint: dto.userinfoUrl ?? null,
        jwksUri: dto.jwksUri ?? null,
        claimMappings: (dto.claimMapping ?? {
          email: 'email',
          fullName: 'name',
        }) as Prisma.InputJsonValue,
        emailDomains: [dto.domain.toLowerCase()],
        defaultRoleId: dto.defaultRoleId ?? null,
        jitProvisioning: dto.jitProvisioning,
        enabled: dto.isActive,
      },
      update: {
        displayName: dto.name,
        clientId: dto.clientId,
        clientSecretEncrypted,
        authorizationEndpoint: dto.authorizationUrl,
        tokenEndpoint: dto.tokenUrl,
        userinfoEndpoint: dto.userinfoUrl ?? null,
        jwksUri: dto.jwksUri ?? null,
        claimMappings: (dto.claimMapping ?? {
          email: 'email',
          fullName: 'name',
        }) as Prisma.InputJsonValue,
        emailDomains: [dto.domain.toLowerCase()],
        defaultRoleId: dto.defaultRoleId ?? null,
        jitProvisioning: dto.jitProvisioning,
        enabled: dto.isActive,
      },
    });

    this.logger.info(
      { providerId: provider.id, issuer: provider.issuer, tenantId },
      'OIDC provider configured',
    );

    return {
      id: provider.id,
      name: provider.displayName,
      protocol: provider.protocol,
      issuer: provider.issuer,
      clientId: provider.clientId,
      emailDomains: provider.emailDomains,
      enabled: provider.enabled,
      jitProvisioning: provider.jitProvisioning,
    };
  }

  async configureSaml(principal: AuthenticatedPrincipal, dto: ConfigureSamlProviderDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.ssoProvider.findUnique({
      where: {
        tenantId_protocol_issuer: {
          tenantId,
          protocol: 'SAML',
          issuer: dto.samlEntityId,
        },
      },
    });

    if (!existing && !dto.samlCert) {
      throw AppException.badRequest(
        'SAML Certificate is required when configuring a new SAML provider.',
      );
    }

    const samlCertificate = dto.samlCert || existing?.samlCertificate;
    if (!samlCertificate) {
      throw AppException.badRequest('SAML Certificate is required.');
    }

    const provider = await this.db.client.ssoProvider.upsert({
      where: {
        tenantId_protocol_issuer: {
          tenantId,
          protocol: 'SAML',
          issuer: dto.samlEntityId,
        },
      },
      create: {
        tenantId,
        displayName: dto.name,
        protocol: 'SAML',
        issuer: dto.samlEntityId,
        authorizationEndpoint: dto.samlSsoUrl,
        samlCertificate,
        claimMappings: (dto.claimMapping ?? {
          email: 'email',
          fullName: 'name',
        }) as Prisma.InputJsonValue,
        emailDomains: [dto.domain.toLowerCase()],
        defaultRoleId: dto.defaultRoleId ?? null,
        jitProvisioning: dto.jitProvisioning,
        enabled: dto.isActive,
      },
      update: {
        displayName: dto.name,
        authorizationEndpoint: dto.samlSsoUrl,
        samlCertificate,
        claimMappings: (dto.claimMapping ?? {
          email: 'email',
          fullName: 'name',
        }) as Prisma.InputJsonValue,
        emailDomains: [dto.domain.toLowerCase()],
        defaultRoleId: dto.defaultRoleId ?? null,
        jitProvisioning: dto.jitProvisioning,
        enabled: dto.isActive,
      },
    });

    this.logger.info(
      { providerId: provider.id, issuer: provider.issuer, tenantId },
      'SAML provider configured',
    );

    return {
      id: provider.id,
      name: provider.displayName,
      protocol: provider.protocol,
      issuer: provider.issuer,
      emailDomains: provider.emailDomains,
      enabled: provider.enabled,
      jitProvisioning: provider.jitProvisioning,
    };
  }

  async listProviders(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.ssoProvider.findMany({
      where: { tenantId },
      select: {
        id: true,
        displayName: true,
        protocol: true,
        issuer: true,
        clientId: true,
        authorizationEndpoint: true,
        tokenEndpoint: true,
        userinfoEndpoint: true,
        emailDomains: true,
        claimMappings: true,
        defaultRoleId: true,
        jitProvisioning: true,
        enabled: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteProvider(_principal: AuthenticatedPrincipal, providerId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    await this.db.client.ssoProvider.deleteMany({
      where: { id: providerId, tenantId },
    });
    return { success: true, providerId };
  }

  // =========================================================================
  // SSO Flow: Initiate & Callback
  // =========================================================================

  async initiateSso(dto: InitiateSsoDto) {
    let domain: string | undefined = dto.domain;
    if (!domain && dto.email) {
      domain = dto.email.split('@')[1];
    }

    if (!domain) {
      throw AppException.badRequest('Domain or email is required to initiate SSO.');
    }

    const domainLower = domain.toLowerCase();

    // Bypass RLS to look up provider by domain across tenants
    const provider = await this.tenantContext.runWithBypass('authentication', {}, async () => {
      return this.db.client.ssoProvider.findFirst({
        where: {
          emailDomains: { has: domainLower },
          enabled: true,
        },
        include: { tenant: true },
      });
    });

    if (!provider || !provider.authorizationEndpoint) {
      throw AppException.notFound(`No active SSO provider found for domain '${domain}'.`);
    }

    // Generate PKCE code verifier and code challenge
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');
    const state = randomBytes(24).toString('hex');
    const nonce = randomBytes(16).toString('hex');

    const statePayload: SsoStatePayload = {
      tenantId: provider.tenantId,
      providerId: provider.id,
      codeVerifier,
      redirectUrl: dto.redirectUrl,
    };

    // Store SSO state in Redis with 10 min TTL
    await this.redis.client.set(`sso:state:${state}`, JSON.stringify(statePayload), 'EX', 600);

    const redirectUri = `${this.config.urls.console}/api/v1/auth/sso/callback`;

    const authUrl = new URL(provider.authorizationEndpoint);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('client_id', provider.clientId ?? '');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', provider.scopes.join(' '));
    authUrl.searchParams.set('state', state);
    authUrl.searchParams.set('nonce', nonce);
    authUrl.searchParams.set('code_challenge', codeChallenge);
    authUrl.searchParams.set('code_challenge_method', 'S256');

    return {
      redirectUrl: authUrl.toString(),
      state,
    };
  }

  async handleCallback(code: string, state: string, origin: SessionOrigin) {
    return this.tenantContext.runWithBypass('authentication', {}, async () => {
      const rawState = await this.redis.client.get(`sso:state:${state}`);
      if (!rawState) {
        throw AppException.badRequest('SSO state parameter is invalid or has expired.');
      }

      await this.redis.client.del(`sso:state:${state}`);
      const statePayload: SsoStatePayload = JSON.parse(rawState);

      const provider = await this.db.client.ssoProvider.findUnique({
        where: { id: statePayload.providerId },
      });

      if (!provider || !provider.enabled || !provider.tokenEndpoint) {
        throw AppException.badRequest('SSO provider configuration is invalid or disabled.');
      }

      const clientSecret = provider.clientSecretEncrypted
        ? openSecret(provider.clientSecretEncrypted, this.config.encryptionKey)
        : '';

      const redirectUri = `${this.config.urls.console}/api/v1/auth/sso/callback`;

      // Code exchange with IdP
      const tokenRes = await fetch(provider.tokenEndpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: provider.clientId ?? '',
          client_secret: clientSecret,
          code_verifier: statePayload.codeVerifier,
        }),
      });

      if (!tokenRes.ok) {
        const text = await tokenRes.text();
        this.logger.error({ status: tokenRes.status, body: text }, 'IdP token exchange failed');
        throw AppException.badRequest(
          'Failed to exchange authorization code with Identity Provider.',
        );
      }

      const tokenData = (await tokenRes.json()) as { access_token?: string; id_token?: string };

      let userEmail: string | undefined;
      let userName: string | undefined;
      let externalSub: string | undefined;

      if (provider.userinfoEndpoint && tokenData.access_token) {
        const userinfoRes = await fetch(provider.userinfoEndpoint, {
          headers: { authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userinfoRes.ok) {
          const userInfo = (await userinfoRes.json()) as Record<string, unknown>;
          userEmail = (userInfo.email as string) ?? undefined;
          userName = (userInfo.name as string) ?? undefined;
          externalSub = (userInfo.sub as string) ?? undefined;
        }
      }

      if (!userEmail && tokenData.id_token) {
        try {
          const [, payloadB64] = tokenData.id_token.split('.');
          const payload = JSON.parse(Buffer.from(payloadB64!, 'base64url').toString('utf8'));
          userEmail = payload.email;
          userName = payload.name;
          externalSub = payload.sub;
        } catch {
          // ignore
        }
      }

      if (!userEmail) {
        throw AppException.badRequest('Identity Provider did not provide an email address.');
      }

      userEmail = userEmail.toLowerCase();

      // Strict domain matching validation for security
      const emailDomain = userEmail.split('@')[1];
      if (!emailDomain || !provider.emailDomains.includes(emailDomain)) {
        throw AppException.permissionDenied(
          `Authenticated email domain '${emailDomain}' is not authorized for this SSO provider.`,
        );
      }

      const tenantId = provider.tenantId;

      // Resolve or JIT-provision user
      let user = await this.db.client.user.findFirst({
        where: { tenantId, email: userEmail, deletedAt: null },
      });

      if (!user) {
        if (!provider.jitProvisioning) {
          throw AppException.permissionDenied(
            'User does not exist and JIT provisioning is disabled.',
          );
        }

        // Resolve default role for JIT user
        let roleId = provider.defaultRoleId;
        if (!roleId) {
          const defaultRole = await this.db.client.role.findFirst({
            where: { key: 'GUEST_CUSTOMER' as RoleKey },
          });
          roleId = defaultRole?.id ?? null;
        }

        user = await this.db.client.user.create({
          data: {
            tenantId,
            email: userEmail,
            fullName: userName ?? userEmail.split('@')[0]!,
            kind: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            ...(roleId
              ? {
                  roles: {
                    create: {
                      tenantId,
                      roleId,
                    },
                  },
                }
              : {}),
          },
        });

        this.logger.info(
          { userId: user.id, email: user.email, tenantId },
          'User JIT-provisioned via SSO',
        );
      }

      // Upsert UserIdentity link
      if (externalSub) {
        const existingIdentity = await this.db.client.userIdentity.findFirst({
          where: { providerRef: provider.id, subject: externalSub },
        });

        if (!existingIdentity) {
          await this.db.client.userIdentity.create({
            data: {
              tenantId,
              userId: user.id,
              provider: 'OIDC',
              providerRef: provider.id,
              subject: externalSub,
              email: userEmail,
            },
          });
        } else {
          await this.db.client.userIdentity.update({
            where: { id: existingIdentity.id },
            data: { lastLoginAt: new Date(), email: userEmail },
          });
        }
      }

      // Create session in transaction
      const createdSession = await this.db.run(async (tx) => {
        return this.sessions.create(tx, {
          userId: user!.id,
          tenantId,
          origin,
        });
      });

      const roles = await this.db.client.userRole.findMany({
        where: { userId: user.id, tenantId },
        include: { role: true },
      });

      const roleKeys = roles.map((r) => r.role.key as RoleKey);
      const primaryRole = roleKeys[0] ?? ('GUEST_CUSTOMER' as RoleKey);

      const { token: accessToken, expiresIn } = await this.tokens.signAccessToken({
        sub: user.id,
        tid: tenantId,
        sid: createdSession.sessionId,
        fid: createdSession.familyId,
        knd: user.kind as 'STAFF' | 'CUSTOMER',
        rls: roleKeys.length > 0 ? roleKeys : [primaryRole],
      });

      return {
        tokens: {
          accessToken,
          refreshToken: createdSession.refreshToken,
          expiresIn,
          tokenType: 'Bearer' as const,
        },
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          role: primaryRole,
        },
        redirectUrl: statePayload.redirectUrl,
      };
    });
  }
}

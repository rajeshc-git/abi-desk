import { randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { Algorithm, hash } from '@node-rs/argon2';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { type CreateApiKeyDto } from './api-key.dto';

const ARGON2_API_KEY_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class ApiKeyService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'ApiKeyService' });
  }

  /**
   * Generates a new tenant-scoped API key.
   */
  async createKey(principal: AuthenticatedPrincipal, dto: CreateApiKeyDto) {
    const tenantId = this.tenantContext.requireTenantId();

    // Generate high entropy random key: abidesk_live_<32-chars>
    const randomHex = randomBytes(24).toString('hex');
    const fullKey = `abidesk_live_${randomHex}`;
    const prefix = fullKey.slice(0, 20); // abidesk_live_abcd1234

    const keyHash = await hash(fullKey, ARGON2_API_KEY_OPTIONS);

    const expiresAt = dto.expiresInDays
      ? new Date(Date.now() + dto.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    const apiKey = await this.db.client.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        prefix,
        keyHash,
        scopes: dto.scopes,
        createdById: principal.userId,
        expiresAt,
      },
    });

    this.logger.info({ apiKeyId: apiKey.id, tenantId, prefix }, 'API key generated');

    return {
      id: apiKey.id,
      name: apiKey.name,
      prefix: apiKey.prefix,
      scopes: apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      secretKey: fullKey, // returned once to the caller
    };
  }

  /**
   * Lists API keys for the current tenant.
   */
  async listKeys(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();

    const keys = await this.db.client.apiKey.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        prefix: true,
        scopes: true,
        createdById: true,
        lastUsedAt: true,
        lastUsedIp: true,
        useCount: true,
        expiresAt: true,
        revokedAt: true,
        revokedById: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map((k) => ({
      ...k,
      useCount: Number(k.useCount),
      isActive: k.revokedAt === null && (k.expiresAt === null || k.expiresAt > new Date()),
    }));
  }

  /**
   * Revokes an API key.
   */
  async revokeKey(principal: AuthenticatedPrincipal, keyId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.apiKey.findFirst({
      where: { id: keyId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`API key '${keyId}' not found.`);
    }

    if (existing.revokedAt) {
      return { success: true, alreadyRevoked: true };
    }

    await this.db.client.apiKey.update({
      where: { id: keyId },
      data: {
        revokedAt: new Date(),
        revokedById: principal.userId,
      },
    });

    this.logger.info({ keyId, tenantId }, 'API key revoked');
    return { success: true, keyId };
  }

  /**
   * Rotates an existing API key, creating a new one and revoking the old one.
   */
  async rotateKey(principal: AuthenticatedPrincipal, keyId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.apiKey.findFirst({
      where: { id: keyId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`API key '${keyId}' not found.`);
    }

    const randomHex = randomBytes(24).toString('hex');
    const fullKey = `abidesk_live_${randomHex}`;
    const prefix = fullKey.slice(0, 20);

    const keyHash = await hash(fullKey, ARGON2_API_KEY_OPTIONS);

    return this.db.run(async (tx) => {
      await tx.apiKey.update({
        where: { id: keyId },
        data: {
          revokedAt: new Date(),
          revokedById: principal.userId,
        },
      });

      const newKey = await tx.apiKey.create({
        data: {
          tenantId,
          name: `${existing.name} (Rotated)`,
          prefix,
          keyHash,
          scopes: existing.scopes,
          createdById: principal.userId,
          rotatedFromId: existing.id,
          expiresAt: existing.expiresAt,
        },
      });

      return {
        id: newKey.id,
        name: newKey.name,
        prefix: newKey.prefix,
        scopes: newKey.scopes,
        expiresAt: newKey.expiresAt,
        createdAt: newKey.createdAt,
        secretKey: fullKey,
      };
    });
  }
}

import { Inject, Injectable } from '@nestjs/common';
import { type RoleKey } from '@abi-desk/rbac';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { RedisService } from '../../infra/redis/redis.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';

export interface ResolvedAuthority {
  roles: RoleKey[];
  permissions: string[];
  /** Brand the user is restricted to, if any. */
  brandId: string | null;
  isPlatformAdmin: boolean;
}

/** Cache lifetime for a resolved permission set. */
const CACHE_TTL_SECONDS = 60;

/**
 * Resolves a user's effective permissions.
 *
 * ## Effective grant = tenant override, else product default
 *
 * `role_permission` holds what the product ships. `tenant_role_permission_override`
 * holds what a Tenant Admin changed. The resolution is a single SQL statement with a
 * `LEFT JOIN` and `COALESCE`, which keeps the precedence rule in one place instead of
 * spread across application branches.
 *
 * ## Why this is not in the JWT
 *
 * Embedding 60-odd permission strings would add roughly a kilobyte to every request
 * header, and worse, a token minted before an admin revoked a permission would keep
 * asserting it for the rest of its lifetime. Resolving per request means a
 * permission change takes effect within the cache TTL rather than within the token
 * TTL.
 *
 * ## Cache invalidation
 *
 * 60 seconds, plus explicit invalidation whenever roles or overrides change. The
 * short TTL is the safety net for any invalidation path that gets missed; the
 * explicit bust is what makes an admin's change feel immediate.
 */
@Injectable()
export class PermissionResolverService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly redis: RedisService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'PermissionResolverService' });
  }

  async resolve(userId: string, tenantId: string | null): Promise<ResolvedAuthority> {
    const cacheKey = authorityKey(userId, tenantId);

    const cached = await this.readCache(cacheKey);
    if (cached) return cached;

    const authority = await this.query(userId, tenantId);
    await this.writeCache(cacheKey, authority);

    return authority;
  }

  /**
   * Drops the cached authority for a user. Call after any change to their roles, or
   * after a tenant override is written.
   */
  async invalidateUser(userId: string, tenantId: string | null): Promise<void> {
    try {
      await this.redis.client.del(authorityKey(userId, tenantId));
    } catch (error: unknown) {
      this.logger.warn({ err: error, userId }, 'Failed to invalidate authority cache');
    }
  }

  /**
   * Drops every cached authority in a tenant.
   *
   * Needed when a tenant-wide override changes, which affects every holder of the
   * role. Uses SCAN rather than KEYS so a large keyspace does not block Redis.
   */
  async invalidateTenant(tenantId: string): Promise<number> {
    let cursor = '0';
    let removed = 0;

    try {
      do {
        const [next, keys] = await this.redis.client.scan(
          cursor,
          'MATCH',
          `auth:authority:${tenantId}:*`,
          'COUNT',
          200,
        );
        cursor = next;

        if (keys.length > 0) {
          removed += await this.redis.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch (error: unknown) {
      this.logger.warn({ err: error, tenantId }, 'Failed to invalidate tenant authority cache');
    }

    return removed;
  }

  // -------------------------------------------------------------------------

  private async query(userId: string, tenantId: string | null): Promise<ResolvedAuthority> {
    // Runs under whatever context the caller established. The auth guard uses an
    // explicit bypass, because at this point the tenant is known but the request has
    // not yet entered tenant scope.
    const assignments = await this.prisma.client.userRole.findMany({
      where: { userId },
      select: {
        brandId: true,
        role: { select: { key: true, scope: true } },
      },
    });

    const roles = assignments.map((assignment) => assignment.role.key as RoleKey);
    const isPlatformAdmin = assignments.some((assignment) => assignment.role.scope === 'PLATFORM');

    // A brand restriction only applies when *every* assignment is brand-scoped;
    // one tenant-wide role means the user sees the whole tenant.
    const brandIds = assignments.map((assignment) => assignment.brandId);
    const brandId =
      brandIds.length > 0 && brandIds.every((id) => id !== null && id === brandIds[0])
        ? (brandIds[0] ?? null)
        : null;

    if (roles.length === 0) {
      return { roles: [], permissions: [], brandId: null, isPlatformAdmin: false };
    }

    const rows = await this.prisma.client.$queryRaw<Array<{ key: string }>>`
      SELECT DISTINCT p.key
      FROM user_role ur
      JOIN role_permission rp ON rp."roleId" = ur."roleId"
      JOIN permission p       ON p.id = rp."permissionId"
      LEFT JOIN tenant_role_permission_override o
             ON o."roleId" = ur."roleId"
            AND o."permissionId" = rp."permissionId"
            AND o."tenantId" IS NOT DISTINCT FROM ${tenantId}::uuid
      WHERE ur."userId" = ${userId}::uuid
        AND COALESCE(o.granted, rp.granted) = true
      ORDER BY p.key
    `;

    return {
      roles: [...new Set(roles)],
      permissions: rows.map((row) => row.key),
      brandId,
      isPlatformAdmin,
    };
  }

  private async readCache(key: string): Promise<ResolvedAuthority | null> {
    try {
      const raw = await this.redis.client.get(key);
      return raw ? (JSON.parse(raw) as ResolvedAuthority) : null;
    } catch (error: unknown) {
      // A cache miss and a cache failure are the same thing here: query the source.
      this.logger.debug({ err: error }, 'Authority cache read failed');
      return null;
    }
  }

  private async writeCache(key: string, authority: ResolvedAuthority): Promise<void> {
    try {
      await this.redis.client.set(key, JSON.stringify(authority), 'EX', CACHE_TTL_SECONDS);
    } catch (error: unknown) {
      this.logger.debug({ err: error }, 'Authority cache write failed');
    }
  }
}

function authorityKey(userId: string, tenantId: string | null): string {
  return `auth:authority:${tenantId ?? 'platform'}:${userId}`;
}

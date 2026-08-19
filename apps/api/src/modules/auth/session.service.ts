import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, type Session } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { RedisService } from '../../infra/redis/redis.service';
import {
  type TenantTransaction,
  TenantPrismaService,
} from '../../infra/tenancy/tenant-prisma.service';
import { TokenService } from './token.service';

export interface SessionOrigin {
  ipAddress?: string;
  userAgent?: string;
}

export interface CreatedSession {
  sessionId: string;
  familyId: string;
  refreshToken: string;
  expiresAt: Date;
}

export interface RotationOutcome {
  session: Session;
  refreshToken: string;
}

/** Reason strings recorded on revocation. Stable enough to query. */
export const REVOCATION_REASON = {
  ROTATED: 'rotated',
  LOGOUT: 'logout',
  LOGOUT_ALL: 'logout-all',
  TOKEN_REUSE: 'token-reuse-detected',
  PASSWORD_CHANGED: 'password-changed',
  ADMIN_REVOKED: 'admin-revoked',
  USER_REVOKED: 'user-revoked',
} as const;

/**
 * Refresh-token sessions, with rotation and replay detection.
 *
 * ## The model
 *
 * One sign-in creates a *family*. Every refresh mints a new row in that family and
 * revokes its predecessor, linked by `rotatedFromId`. So a family is a chain, and
 * at most one link in it is live.
 *
 * ## Why rotation
 *
 * A long-lived refresh token that never changes is a bearer credential with a
 * 30-day window: steal it once and you have a month of access, with nothing to
 * detect. Rotating on every use means a stolen token is only useful until the
 * legitimate client next refreshes.
 *
 * ## Why replay detection matters more than rotation
 *
 * Rotation alone does not tell you that theft happened - it just narrows the
 * window. But once each token is single-use, presenting an *already-rotated* token
 * is proof that two parties hold the chain. At that point we cannot tell the thief
 * from the victim, so the only safe response is to revoke the whole family and make
 * both re-authenticate. This is the standard OAuth 2.1 guidance for public clients.
 *
 * ## Why access tokens check the family, not the session
 *
 * Rotation revokes individual sessions constantly, and an access token issued
 * seconds before a refresh must keep working for its remaining lifetime. Checking
 * the *family* gives immediate logout (which revokes every row) without breaking
 * in-flight requests during a normal rotation.
 */
@Injectable()
export class SessionService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly tokens: TokenService,
    private readonly redis: RedisService,
    private readonly config: AppConfig,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'SessionService' });
  }

  // -- Creation ------------------------------------------------------------

  /**
   * Creates a session row and returns the raw refresh token.
   *
   * The raw token is returned exactly once and never persisted - only its keyed
   * digest is stored.
   */
  async create(
    tx: TenantTransaction,
    input: {
      userId: string;
      tenantId: string | null;
      origin: SessionOrigin;
      /** Continue an existing family (rotation) rather than starting a new one. */
      familyId?: string;
      rotatedFromId?: string;
    },
  ): Promise<CreatedSession> {
    const { token, digest } = this.tokens.createRefreshToken();
    const familyId = input.familyId ?? randomUUID();
    const expiresAt = new Date(Date.now() + this.config.auth.refreshTtl * 1000);

    const session = await tx.session.create({
      data: {
        userId: input.userId,
        tenantId: input.tenantId,
        refreshTokenHash: digest,
        familyId,
        rotatedFromId: input.rotatedFromId ?? null,
        ipAddress: input.origin.ipAddress ?? null,
        userAgent: input.origin.userAgent?.slice(0, 512) ?? null,
        device: describeDevice(input.origin.userAgent),
        expiresAt,
      },
      select: { id: true, familyId: true, expiresAt: true },
    });

    return {
      sessionId: session.id,
      familyId: session.familyId,
      refreshToken: token,
      expiresAt: session.expiresAt,
    };
  }

  // -- Rotation ------------------------------------------------------------

  /**
   * Consumes a refresh token and issues its successor.
   *
   * Concurrency is handled with a conditional update rather than a lock: revoking
   * the presented row is expressed as `updateMany({ where: { id, revokedAt: null }})`
   * and the caller checks the affected count. Two simultaneous refreshes with the
   * same token therefore produce exactly one winner, and the loser is correctly
   * treated as reuse - a `SELECT` followed by an `UPDATE` would let both through.
   */
  async rotate(
    rawToken: string,
    origin: SessionOrigin,
  ): Promise<{ outcome: RotationOutcome; userId: string; tenantId: string | null }> {
    const digest = this.tokens.digestRefreshToken(rawToken);

    // The inspection transaction *returns* its verdict rather than throwing.
    //
    // This is not stylistic. Revoking the family and then throwing from inside the
    // same transaction rolls the revocation back with it, so the compromised chain
    // stays alive - a reused token would be rejected while every other token in the
    // family kept working. The revocation therefore has to commit separately, which
    // means the failure paths cannot throw until the transaction has closed.
    const verdict = await this.prisma.run(async (tx) => {
      const existing = await tx.session.findUnique({
        where: { refreshTokenHash: digest },
        select: {
          id: true,
          userId: true,
          tenantId: true,
          familyId: true,
          revokedAt: true,
          expiresAt: true,
        },
      });

      if (!existing) {
        return { kind: 'unknown' } as const;
      }

      if (existing.revokedAt) {
        return {
          kind: 'reused',
          familyId: existing.familyId,
          sessionId: existing.id,
          userId: existing.userId,
        } as const;
      }

      if (existing.expiresAt.getTime() <= Date.now()) {
        return { kind: 'expired' } as const;
      }

      // Atomic claim: only the transaction that flips revokedAt may proceed. A
      // `SELECT` then `UPDATE` would let two concurrent refreshes both succeed.
      const claimed = await tx.session.updateMany({
        where: { id: existing.id, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: REVOCATION_REASON.ROTATED },
      });

      if (claimed.count !== 1) {
        // Lost the race. Treated as reuse, because from here the two cases are
        // indistinguishable and the safe reading is the pessimistic one.
        return {
          kind: 'reused',
          familyId: existing.familyId,
          sessionId: existing.id,
          userId: existing.userId,
        } as const;
      }

      const created = await this.create(tx, {
        userId: existing.userId,
        tenantId: existing.tenantId,
        origin,
        familyId: existing.familyId,
        rotatedFromId: existing.id,
      });

      const session = await tx.session.findUniqueOrThrow({ where: { id: created.sessionId } });

      return {
        kind: 'rotated',
        session,
        refreshToken: created.refreshToken,
        userId: existing.userId,
        tenantId: existing.tenantId,
      } as const;
    });

    if (verdict.kind === 'rotated') {
      return {
        outcome: { session: verdict.session, refreshToken: verdict.refreshToken },
        userId: verdict.userId,
        tenantId: verdict.tenantId,
      };
    }

    if (verdict.kind === 'unknown') {
      throw AppException.unauthenticated(
        'Refresh token is not recognised.',
        ErrorCode.TOKEN_INVALID,
      );
    }

    if (verdict.kind === 'expired') {
      throw AppException.unauthenticated('Refresh token has expired.', ErrorCode.TOKEN_EXPIRED);
    }

    // Reuse: a spent token was presented, so two parties hold this chain. We cannot
    // tell the thief from the victim, so the entire family is revoked and both are
    // made to re-authenticate. This commits in its own transaction.
    await this.revokeFamily(verdict.familyId, REVOCATION_REASON.TOKEN_REUSE);

    this.logger.warn(
      {
        userId: verdict.userId,
        familyId: verdict.familyId,
        sessionId: verdict.sessionId,
        ip: origin.ipAddress,
      },
      'Refresh token reuse detected - revoked entire session family',
    );

    throw new AppException(
      ErrorCode.SESSION_REVOKED,
      401,
      'This session has been signed out because an already-used token was presented.',
      { logContext: { familyId: verdict.familyId, reason: 'token-reuse' } },
    );
  }

  // -- Revocation ----------------------------------------------------------

  /** Revokes every live session in a family and denylists it for access tokens. */
  async revokeFamily(familyId: string, reason: string): Promise<number> {
    const revoked = await this.prisma.run((tx) => this.revokeFamilyWithin(tx, familyId, reason));
    return revoked;
  }

  /** Revokes every session belonging to a user. Used on password change. */
  async revokeAllForUser(userId: string, reason: string): Promise<number> {
    const families = await this.prisma.run(async (tx) => {
      const live = await tx.session.findMany({
        where: { userId, revokedAt: null },
        select: { familyId: true },
        distinct: ['familyId'],
      });

      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: reason },
      });

      return live.map((row) => row.familyId);
    });

    await Promise.all(families.map((familyId) => this.denylistFamily(familyId)));
    return families.length;
  }

  /** Revokes one session by id, scoped to its owner so users cannot revoke others'. */
  async revokeSessionForUser(sessionId: string, userId: string): Promise<void> {
    const result = await this.prisma.run(async (tx) => {
      const session = await tx.session.findFirst({
        where: { id: sessionId, userId },
        select: { id: true, familyId: true, revokedAt: true },
      });

      if (!session) return null;

      await tx.session.updateMany({
        where: { familyId: session.familyId, revokedAt: null },
        data: { revokedAt: new Date(), revokedReason: REVOCATION_REASON.USER_REVOKED },
      });

      return session.familyId;
    });

    if (!result) {
      throw AppException.notFound('Session', sessionId);
    }

    await this.denylistFamily(result);
  }

  private async revokeFamilyWithin(
    tx: TenantTransaction,
    familyId: string,
    reason: string,
  ): Promise<number> {
    const result = await tx.session.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date(), revokedReason: reason },
    });

    await this.denylistFamily(familyId);
    return result.count;
  }

  // -- Denylist ------------------------------------------------------------

  /**
   * Records a revoked family in Redis so access-token validation costs one O(1)
   * lookup instead of a database query per request.
   *
   * TTL matches the refresh window: after that, every access token descended from
   * the family has long since expired, so the entry has no further value.
   */
  private async denylistFamily(familyId: string): Promise<void> {
    try {
      await this.redis.client.set(denylistKey(familyId), '1', 'EX', this.config.auth.refreshTtl);
    } catch (error: unknown) {
      // Not fatal: `isFamilyRevoked` falls back to the database, so a Redis outage
      // degrades performance rather than correctness.
      this.logger.warn({ err: error, familyId }, 'Failed to denylist session family in Redis');
    }
  }

  /**
   * True when a session family has been revoked.
   *
   * Redis first, database on Redis failure. Failing open on a cache error would let
   * revoked sessions back in, so the fallback is a real query rather than `false`.
   */
  async isFamilyRevoked(familyId: string): Promise<boolean> {
    try {
      const hit = await this.redis.client.exists(denylistKey(familyId));
      if (hit === 1) return true;
    } catch (error: unknown) {
      this.logger.warn(
        { err: error, familyId },
        'Redis denylist unavailable - falling back to database',
      );

      const live = await this.prisma.client.session.count({
        where: { familyId, revokedAt: null },
      });
      return live === 0;
    }

    return false;
  }

  // -- Listing -------------------------------------------------------------

  /**
   * Live sessions for a user, newest first.
   *
   * Collapsed to one entry per family, because a user thinks in devices and a
   * family is a device. Showing every rotation would list dozens of "sessions" that
   * are all the same browser.
   */
  async listActiveForUser(userId: string): Promise<
    Array<{
      id: string;
      familyId: string;
      device: string | null;
      ipAddress: string | null;
      userAgent: string | null;
      issuedAt: Date;
      lastUsedAt: Date | null;
      expiresAt: Date;
      isCurrent: boolean;
    }>
  > {
    const sessions = await this.prisma.client.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { issuedAt: 'desc' },
      select: {
        id: true,
        familyId: true,
        device: true,
        ipAddress: true,
        userAgent: true,
        issuedAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });

    return sessions.map((session) => ({ ...session, isCurrent: false }));
  }

  /** Records that a session was used, for the device list. Fire-and-forget. */
  async touch(sessionId: string): Promise<void> {
    try {
      await this.prisma.client.session.update({
        where: { id: sessionId },
        data: { lastUsedAt: new Date() },
      });
    } catch (error: unknown) {
      this.logger.debug({ err: error, sessionId }, 'Failed to update session lastUsedAt');
    }
  }

  /** Removes long-expired rows. Called by the retention job. */
  async pruneExpired(olderThan: Date): Promise<number> {
    const result = await this.prisma.client.session.deleteMany({
      where: { expiresAt: { lt: olderThan } },
    });
    return result.count;
  }
}

function denylistKey(familyId: string): string {
  return `auth:revoked-family:${familyId}`;
}

/**
 * Best-effort device label from a User-Agent string.
 *
 * Intentionally crude and dependency-free. This is a human-readable hint in a
 * "your devices" list, not a security control, so the cost of a UA-parsing library
 * (and its monthly signature updates) is not justified.
 */
export function describeDevice(userAgent?: string): string | null {
  if (!userAgent) return null;

  const ua = userAgent.toLowerCase();

  const browser = ua.includes('edg/')
    ? 'Edge'
    : ua.includes('opr/') || ua.includes('opera')
      ? 'Opera'
      : ua.includes('chrome/') && !ua.includes('chromium')
        ? 'Chrome'
        : ua.includes('firefox/')
          ? 'Firefox'
          : ua.includes('safari/') && !ua.includes('chrome')
            ? 'Safari'
            : ua.includes('curl/')
              ? 'curl'
              : ua.includes('postman')
                ? 'Postman'
                : 'Unknown browser';

  const platform = ua.includes('windows nt')
    ? 'Windows'
    : ua.includes('iphone')
      ? 'iPhone'
      : ua.includes('ipad')
        ? 'iPad'
        : ua.includes('android')
          ? 'Android'
          : ua.includes('mac os x')
            ? 'macOS'
            : ua.includes('linux')
              ? 'Linux'
              : 'Unknown OS';

  return `${browser} on ${platform}`.slice(0, 120);
}

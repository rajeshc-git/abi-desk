import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infra/redis/redis.service';
import { TokenService } from './token.service';

/** What a one-time token is for. Namespaces the Redis keyspace. */
export type OneTimeTokenPurpose = 'magic-link' | 'password-reset';

export interface MagicLinkPayload {
  purpose: 'magic-link';
  email: string;
  tenantId: string;
  brandId: string;
}

export interface PasswordResetPayload {
  purpose: 'password-reset';
  userId: string;
  email: string;
  tenantId: string | null;
}

export type OneTimeTokenPayload = MagicLinkPayload | PasswordResetPayload;

/**
 * Short-lived, single-use tokens for magic-link sign-in and password reset.
 *
 * Held in Redis rather than PostgreSQL. The reasoning:
 *
 *  - They live for 15-30 minutes and are consumed once, so they are cache-shaped
 *    data, not records.
 *  - Expiry is the hard part, and Redis TTL handles it without a sweeper job. A
 *    table needs a scheduled purge, and a purge that silently stops running leaves
 *    valid reset tokens lying around indefinitely.
 *  - Single-use is `GETDEL`, which is atomic. In PostgreSQL the equivalent is a
 *    conditional UPDATE plus a re-read, and getting it wrong means a reset link
 *    that works twice.
 *
 * The trade-off is accepted deliberately: a Redis flush invalidates outstanding
 * links, and the user simply requests another. Issuance and consumption are both
 * written to the audit log, so the compliance trail lives in PostgreSQL even though
 * the token does not.
 *
 * Only the SHA-256 digest is used as the key, so the raw token exists solely inside
 * the email that carried it.
 */
@Injectable()
export class OneTimeTokenService {
  constructor(
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Issues a token and stores its payload under the digest.
   *
   * @returns the raw token, to be embedded in a link. Never store it.
   */
  async issue(
    payload: OneTimeTokenPayload,
    ttlSeconds: number,
  ): Promise<{ token: string; expiresAt: Date }> {
    const { token, digest } = this.tokens.createOneTimeToken();

    await this.redis.client.set(
      this.key(payload.purpose, digest),
      JSON.stringify(payload),
      'EX',
      ttlSeconds,
    );

    return { token, expiresAt: new Date(Date.now() + ttlSeconds * 1000) };
  }

  /**
   * Consumes a token, returning its payload, or null if it is unknown, expired or
   * already used.
   *
   * `GETDEL` makes read-and-invalidate a single atomic operation, so two
   * simultaneous submissions of the same link cannot both succeed.
   */
  async consume<T extends OneTimeTokenPayload>(
    purpose: OneTimeTokenPurpose,
    rawToken: string,
  ): Promise<T | null> {
    const digest = this.tokens.digestOneTimeToken(rawToken);
    const raw = await this.redis.client.getdel(this.key(purpose, digest));

    if (!raw) return null;

    try {
      const payload = JSON.parse(raw) as T;
      // Defensive: a key in the magic-link namespace must not carry a reset payload.
      return payload.purpose === purpose ? payload : null;
    } catch {
      return null;
    }
  }

  /**
   * Rate limit for token issuance, keyed by purpose and subject.
   *
   * Stops a magic-link or reset endpoint from being used to flood someone's inbox,
   * and blunts enumeration attempts. Uses INCR with an expiry on first increment,
   * so the window is fixed rather than sliding - adequate, and one round trip.
   *
   * @returns true when the caller is within the limit.
   */
  async consumeRateLimit(
    purpose: OneTimeTokenPurpose,
    subject: string,
    limit: number,
    windowSeconds: number,
  ): Promise<boolean> {
    const key = `auth:otp-rate:${purpose}:${subject.toLowerCase()}`;

    const count = await this.redis.client.incr(key);

    if (count === 1) {
      await this.redis.client.expire(key, windowSeconds);
    }

    return count <= limit;
  }

  private key(purpose: OneTimeTokenPurpose, digest: string): string {
    return `auth:ott:${purpose}:${digest}`;
  }
}

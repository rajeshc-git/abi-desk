import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { jwtVerify, SignJWT } from 'jose';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AppConfig } from '../../config/app-config';
import { type AccessTokenClaims } from './auth.types';

/**
 * Token minting and verification.
 *
 * Two very different kinds of token, on purpose:
 *
 *  - **Access token**: a signed JWT (HS512). Stateless and short-lived, so the hot
 *    path needs no database round trip. Revocation is handled by a family denylist
 *    rather than by looking the session up every request.
 *
 *  - **Refresh token**: an opaque 32-byte random string. *Not* a JWT. It is stored
 *    only as a SHA-256 digest, so a database disclosure does not yield usable
 *    tokens, and it is looked up on every use, which is what makes rotation and
 *    replay detection possible. A self-validating JWT refresh token cannot be
 *    revoked without the same lookup, so it buys nothing and leaks its payload.
 */
@Injectable()
export class TokenService {
  private readonly accessKey: Uint8Array;
  private readonly refreshPepper: Uint8Array;

  constructor(private readonly config: AppConfig) {
    this.accessKey = new TextEncoder().encode(config.auth.accessSecret);
    // The refresh secret is used as a keyed-hash pepper rather than a signing key,
    // since refresh tokens are opaque. A stolen database still cannot reverse the
    // digests without this value, which lives only in configuration.
    this.refreshPepper = new TextEncoder().encode(config.auth.refreshSecret);
  }

  // -- Access tokens -------------------------------------------------------

  async signAccessToken(claims: AccessTokenClaims): Promise<{ token: string; expiresIn: number }> {
    const expiresIn = this.config.auth.accessTtl;
    const now = Math.floor(Date.now() / 1000);

    const token = await new SignJWT({ ...claims })
      .setProtectedHeader({ alg: 'HS512', typ: 'JWT' })
      .setIssuer(this.config.auth.issuer)
      .setAudience(`${this.config.auth.issuer}:api`)
      .setSubject(claims.sub)
      .setIssuedAt(now)
      .setNotBefore(now)
      .setExpirationTime(now + expiresIn)
      // Unique per token, so an access token can be individually denylisted if that
      // ever becomes necessary.
      .setJti(randomBytes(16).toString('hex'))
      .sign(this.accessKey);

    return { token, expiresIn };
  }

  /**
   * Verifies an access token's signature, issuer, audience and expiry.
   *
   * Distinguishes expiry from tampering: a client that sees TOKEN_EXPIRED knows to
   * refresh, whereas TOKEN_INVALID means stop and re-authenticate.
   */
  async verifyAccessToken(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, {
        issuer: this.config.auth.issuer,
        audience: `${this.config.auth.issuer}:api`,
        algorithms: ['HS512'],
        // No leeway. Clock skew between our own containers is not a real problem,
        // and tolerance here extends the life of a revoked token.
        clockTolerance: 0,
      });

      const claims = payload as unknown as AccessTokenClaims;

      if (!claims.sub || !claims.sid || !claims.fid || !Array.isArray(claims.rls)) {
        throw AppException.unauthenticated(
          'Access token is missing required claims.',
          ErrorCode.TOKEN_INVALID,
        );
      }

      return claims;
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;

      const code = (error as { code?: string }).code;

      if (code === 'ERR_JWT_EXPIRED') {
        throw AppException.unauthenticated('Access token has expired.', ErrorCode.TOKEN_EXPIRED);
      }

      throw AppException.unauthenticated('Access token is invalid.', ErrorCode.TOKEN_INVALID);
    }
  }

  // -- Refresh tokens ------------------------------------------------------

  /**
   * Mints an opaque refresh token and returns it alongside the digest to store.
   *
   * 256 bits of entropy from the CSPRNG. base64url so it survives cookies, headers
   * and JSON without escaping.
   */
  createRefreshToken(): { token: string; digest: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, digest: this.digestRefreshToken(token) };
  }

  /**
   * Keyed SHA-256 of a refresh token.
   *
   * Fast by design, unlike a password hash: refresh tokens are already full-entropy
   * random values, so there is nothing to brute-force and no reason to pay Argon2's
   * cost on every refresh. The pepper is what stops an attacker with database
   * access from precomputing digests.
   */
  digestRefreshToken(token: string): string {
    return createHash('sha256')
      .update(this.refreshPepper)
      .update(':')
      .update(token, 'utf8')
      .digest('hex');
  }

  // -- One-time tokens (magic link, password reset, invitations) -----------

  /**
   * Mints a single-use token for an out-of-band flow.
   *
   * Same shape as a refresh token: opaque, high entropy, stored as a digest. The
   * raw value only ever exists in the email.
   */
  createOneTimeToken(): { token: string; digest: string } {
    const token = randomBytes(32).toString('base64url');
    return { token, digest: this.digestOneTimeToken(token) };
  }

  /** Unkeyed digest: these tokens are short-lived and single-use. */
  digestOneTimeToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  /** Constant-time digest comparison, for paths that compare rather than look up. */
  digestsEqual(a: string, b: string): boolean {
    const bufferA = Buffer.from(a, 'utf8');
    const bufferB = Buffer.from(b, 'utf8');
    if (bufferA.length !== bufferB.length) return false;
    return timingSafeEqual(bufferA, bufferB);
  }

  /** CSRF token for cookie-mode sessions (double-submit pattern). */
  createCsrfToken(): string {
    return randomBytes(24).toString('base64url');
  }

  // -- Widget user tokens (OTP-verified guest customers) -------------------

  async signWidgetToken(email: string): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    // Verified widget user email session lasts for 30 days.
    const expiresIn = 30 * 24 * 60 * 60;

    return await new SignJWT({ email })
      .setProtectedHeader({ alg: 'HS512', typ: 'JWT' })
      .setIssuer(this.config.auth.issuer)
      .setAudience(`${this.config.auth.issuer}:widget`)
      .setIssuedAt(now)
      .setExpirationTime(now + expiresIn)
      .sign(this.accessKey);
  }

  async verifyWidgetToken(token: string): Promise<{ email: string }> {
    try {
      const { payload } = await jwtVerify(token, this.accessKey, {
        issuer: this.config.auth.issuer,
        audience: `${this.config.auth.issuer}:widget`,
        algorithms: ['HS512'],
        clockTolerance: 0,
      });

      const emailStr = payload.email;
      if (typeof emailStr !== 'string' || !emailStr) {
        throw AppException.unauthenticated('Widget token is missing email claim.');
      }

      return { email: emailStr };
    } catch (error: unknown) {
      if (error instanceof AppException) throw error;
      throw AppException.unauthenticated('Widget token is invalid or expired.');
    }
  }
}

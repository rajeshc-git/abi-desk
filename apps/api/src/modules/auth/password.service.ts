import { randomBytes } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Algorithm, hash, verify } from '@node-rs/argon2';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { AppConfig } from '../../config/app-config';

/**
 * Argon2id parameters, per the OWASP Password Storage Cheat Sheet: 19 MiB of
 * memory, 2 iterations, 1 lane.
 *
 * Argon2id rather than 2i or 2d because it resists both side-channel and
 * GPU-cracking attacks. Memory cost is the parameter that actually defeats custom
 * cracking hardware, and it is the one most often left at a token value.
 */
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

/**
 * A pre-computed hash of a random value, used to burn the same CPU time when the
 * account does not exist.
 *
 * Without this, "unknown email" returns in ~1 ms while "wrong password" takes
 * ~50 ms, and that difference is a reliable account-enumeration oracle.
 */
let dummyHashPromise: Promise<string> | undefined;

function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hash(randomBytes(32).toString('hex'), ARGON2_OPTIONS);
  return dummyHashPromise;
}

/**
 * The 20 most-abused passwords. A full breach corpus belongs behind a service
 * (k-anonymity range query against Pwned Passwords); this catches the worst of it
 * with no network dependency.
 */
const OBVIOUS_PASSWORDS = new Set([
  'password',
  'password1',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'qwerty123',
  'abc123',
  'letmein',
  'welcome',
  'welcome1',
  'admin',
  'admin123',
  'iloveyou',
  'monkey',
  'dragon',
  'football',
  'changeme',
  'passw0rd',
]);

@Injectable()
export class PasswordService {
  constructor(private readonly config: AppConfig) {}

  /**
   * Validates a candidate password.
   *
   * Length only, plus a blocklist - no composition rules. NIST SP 800-63B
   * explicitly recommends against forced character classes: they push users toward
   * predictable substitutions without adding real entropy.
   */
  assertAcceptable(password: string, context: { email?: string; fullName?: string } = {}): void {
    const minLength = this.config.auth.passwordMinLength;
    const problems: string[] = [];

    if (password.length < minLength) {
      problems.push(`must be at least ${minLength} characters`);
    }

    const hasLetter = /[a-zA-Z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    if (!hasLetter || !hasNumber) {
      problems.push('must be alphanumeric (contain both letters and numbers)');
    }

    const hasSpecial = /[^a-zA-Z0-9]/.test(password);
    if (!hasSpecial) {
      problems.push('must contain at least one special character');
    }

    // Bcrypt's 72-byte ceiling does not apply to Argon2, but an unbounded password
    // is a cheap denial-of-service vector against a memory-hard hash.
    if (Buffer.byteLength(password, 'utf8') > 1024) {
      problems.push('must be at most 1024 bytes');
    }

    const normalized = password.trim().toLowerCase();

    if (OBVIOUS_PASSWORDS.has(normalized)) {
      problems.push('is among the most commonly used passwords');
    }

    if (context.email) {
      const localPart = context.email.split('@')[0]?.toLowerCase();
      if (localPart && localPart.length >= 4 && normalized.includes(localPart)) {
        problems.push('must not contain your email address');
      }
    }

    if (context.fullName) {
      for (const part of context.fullName.toLowerCase().split(/\s+/)) {
        if (part.length >= 4 && normalized.includes(part)) {
          problems.push('must not contain your name');
          break;
        }
      }
    }

    if (problems.length > 0) {
      throw AppException.unprocessable(
        'The password does not meet the minimum requirements.',
        problems.map((message) => ({ path: 'password', message })),
        ErrorCode.VALIDATION_FAILED,
      );
    }
  }

  hash(password: string): Promise<string> {
    return hash(password, ARGON2_OPTIONS);
  }

  /**
   * Verifies a password against a stored hash.
   *
   * Pass `null` for accounts with no password (SSO-only, or an invitation that has
   * not been accepted). The comparison still runs against a dummy hash so the
   * response time does not reveal which case it was.
   */
  async verify(storedHash: string | null, candidate: string): Promise<boolean> {
    if (!storedHash) {
      await verify(await getDummyHash(), candidate, ARGON2_OPTIONS).catch(() => false);
      return false;
    }

    try {
      return await verify(storedHash, candidate, ARGON2_OPTIONS);
    } catch {
      // A malformed or foreign hash string. Treat as a failed attempt rather than
      // a 500: it means the row predates a migration, not that the request is bad.
      return false;
    }
  }

  /** Burns equivalent CPU time when no account matched. */
  async burnTimingBudget(candidate: string): Promise<void> {
    await verify(await getDummyHash(), candidate, ARGON2_OPTIONS).catch(() => false);
  }

  /**
   * True when a stored hash was produced with weaker parameters than current
   * policy, so it should be re-hashed on the next successful sign-in.
   */
  needsRehash(storedHash: string): boolean {
    const params = /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$/.exec(storedHash);

    if (!params) return true;

    const [, memory, time, lanes] = params;

    return (
      Number(memory) < ARGON2_OPTIONS.memoryCost ||
      Number(time) < ARGON2_OPTIONS.timeCost ||
      Number(lanes) < ARGON2_OPTIONS.parallelism
    );
  }
}

import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Authenticated encryption for secrets stored in this database.
 *
 * Used for values the platform must be able to *reproduce*, not merely compare:
 *   - widget handoff signing secrets (needed to verify tenant-issued JWTs)
 *   - SSO client secrets
 *   - webhook signing secrets
 *   - integration tokens (GitHub / Jira / Azure DevOps)
 *   - TOTP seeds
 *
 * Passwords and API keys deliberately do *not* go through here: those are only
 * ever compared, so they are hashed with Argon2id instead. Encrypting a
 * credential you only need to compare is a downgrade, because it keeps a
 * reversible copy for no reason.
 *
 * Envelope format: `v1:<iv-b64>:<tag-b64>:<ciphertext-b64>`
 * The version prefix exists so the key or algorithm can be rotated later without
 * guessing how old rows were written.
 */

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12; // 96 bits, the value GCM is specified for
const KEY_BYTES = 32; // AES-256
const TAG_BYTES = 16;

export class SecretBoxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

/**
 * Decodes and validates the application encryption key.
 *
 * Rejecting a short key loudly at boot is the point: a 16-byte key silently
 * padded to 32 would look like it worked.
 */
export function parseEncryptionKey(base64Key: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(base64Key, 'base64');
  } catch {
    throw new SecretBoxError('Encryption key is not valid base64.');
  }

  if (key.length !== KEY_BYTES) {
    throw new SecretBoxError(
      `Encryption key must decode to exactly ${KEY_BYTES} bytes, got ${key.length}. ` +
        'Generate one with: openssl rand -base64 32',
    );
  }

  return key;
}

/** Encrypts a UTF-8 string into a self-describing envelope. */
export function sealSecret(plaintext: string, key: Buffer): string {
  if (key.length !== KEY_BYTES) {
    throw new SecretBoxError(`Encryption key must be ${KEY_BYTES} bytes.`);
  }

  // A fresh random IV per message. Reusing an IV under GCM is catastrophic - it
  // leaks the XOR of plaintexts and the authentication key.
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

/** Decrypts an envelope produced by `sealSecret`. Throws if it was tampered with. */
export function openSecret(envelope: string, key: Buffer): string {
  const parts = envelope.split(':');

  if (parts.length !== 4) {
    throw new SecretBoxError('Malformed secret envelope.');
  }

  const [version, ivB64, tagB64, ciphertextB64] = parts as [string, string, string, string];

  if (version !== VERSION) {
    throw new SecretBoxError(`Unsupported secret envelope version: ${version}`);
  }

  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new SecretBoxError('Secret envelope has an invalid IV or authentication tag.');
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  try {
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextB64, 'base64')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    // GCM authentication failure: wrong key, or the ciphertext was modified.
    throw new SecretBoxError('Secret failed authentication; it may have been tampered with.');
  }
}

/** Last 4 characters of a secret, for identifying it in a UI without decrypting. */
export function secretFingerprint(plaintext: string): string {
  return plaintext.slice(-4);
}

/**
 * Constant-time comparison for secrets compared in application code (for example
 * a webhook signature).
 *
 * `a === b` on strings short-circuits at the first differing byte, which leaks
 * how much of a guess was correct.
 */
export function secretsEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

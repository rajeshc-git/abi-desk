/**
 * Single entry point for database access across the monorepo.
 *
 * Application code should import from `@abi-desk/db` rather than
 * `@prisma/client` directly, so the tenant-scoping client extension added in the
 * tenancy layer cannot be bypassed by accident.
 */
export * from '@prisma/client';

export { buildPrismaOptions, createPrismaClient, type PrismaClientOptions } from './client';

export {
  TENANT_SESSION_VARIABLE,
  BYPASS_RLS_SESSION_VARIABLE,
  RETENTION_PURGE_SESSION_VARIABLE,
} from './constants';

export {
  SecretBoxError,
  openSecret,
  parseEncryptionKey,
  sealSecret,
  secretFingerprint,
  secretsEqual,
} from './secret-box';

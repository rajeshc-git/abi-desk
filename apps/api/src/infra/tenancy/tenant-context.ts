import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request tenancy and identity context.
 *
 * Carried in AsyncLocalStorage rather than threaded through every function
 * signature, because it must reach the Prisma layer - which sits many calls below
 * the controller - without every intermediate service having to know about it.
 */
export interface TenantContext {
  /**
   * Tenant the current work belongs to. Null for platform-level actors and for
   * pre-authentication work (a login has to find the user before their tenant is
   * known).
   */
  tenantId: string | null;

  /** Authenticated principal, when there is one. */
  userId?: string;

  /** Set when the caller authenticated with an API key rather than a session. */
  apiKeyId?: string;

  /** Correlation id, so a database warning can be traced to a request. */
  requestId?: string;

  /**
   * Explicit opt-out of tenant filtering.
   *
   * Only three things may set this, and each is a deliberate decision:
   *   - authentication, looking up a user by email before tenant is known
   *   - platform administration acting across tenants
   *   - background jobs that legitimately span tenants (retention, outbox)
   *
   * Never derived from a request parameter, a header, or a JWT claim.
   */
  bypassRls: boolean;

  /**
   * True while inside `TenantPrismaService.run()`.
   *
   * The Prisma extension checks this to avoid opening a nested transaction: the
   * enclosing transaction has already established the session variable, and
   * PostgreSQL has no nested transactions to open.
   */
  insideScopedTransaction: boolean;
}

/**
 * Process-wide storage. A single instance, because AsyncLocalStorage identity is
 * what links a `run()` to the `getStore()` calls beneath it.
 */
export const tenantContextStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantContext(): TenantContext | undefined {
  return tenantContextStorage.getStore();
}

/**
 * Shape check so a malformed id fails with a clear message instead of surfacing a
 * PostgreSQL cast error from inside an RLS policy.
 *
 * Deliberately matches what the `uuid` column type accepts - 32 hex digits in the
 * canonical grouping - rather than enforcing RFC 4122 version and variant bits.
 * Being stricter than the database would reject identifiers PostgreSQL is perfectly
 * happy to store, which is a validation bug rather than extra safety.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function createTenantContext(partial: Partial<TenantContext> = {}): TenantContext {
  return {
    tenantId: partial.tenantId ?? null,
    ...(partial.userId ? { userId: partial.userId } : {}),
    ...(partial.apiKeyId ? { apiKeyId: partial.apiKeyId } : {}),
    ...(partial.requestId ? { requestId: partial.requestId } : {}),
    bypassRls: partial.bypassRls ?? false,
    insideScopedTransaction: partial.insideScopedTransaction ?? false,
  };
}

/**
 * PostgreSQL session variables read by Row Level Security policies and triggers.
 *
 * All three are set with `SET LOCAL`, so they are scoped to a transaction and can
 * never leak across a pooled connection into the next request.
 */

/**
 * Tenant scope for the current transaction. When unset, policies compare against
 * NULL and no rows are visible - the fail-safe default.
 */
export const TENANT_SESSION_VARIABLE = 'app.tenant_id';

/**
 * Opts a transaction out of tenant filtering.
 *
 * Legitimate uses are narrow and each is deliberate: authentication (which must
 * find a user before their tenant is known), platform administration, and
 * background jobs that span tenants. Never derived from user input.
 */
export const BYPASS_RLS_SESSION_VARIABLE = 'app.bypass_rls';

/**
 * Announces a lawful retention purge, the only condition under which the
 * append-only audit log permits DELETE.
 */
export const RETENTION_PURGE_SESSION_VARIABLE = 'app.retention_purge';

-- =========================================================================
-- BASELINE PART 1 of 3 - prerequisites (01-schema.sql)
--
-- Runs before any table exists. Establishes extensions, the `app` helper schema,
-- the functions Row Level Security policies call, and the privileges the runtime
-- role needs.
--
-- Order matters: `ALTER DEFAULT PRIVILEGES` must run BEFORE the tables are created,
-- because it only applies to objects created afterwards. That is why grants live
-- here rather than at the end, and why this part cannot simply be appended.
--
-- Do not edit the assembled migration directly. Edit this file and re-run
-- `pnpm --filter @abi-desk/db run baseline:build`.
-- =========================================================================

-- -------------------------------------------------------------------------
-- Extensions
--
-- All three are "trusted" in PostgreSQL 13+, so the database owner can install them
-- without superuser rights. That matters for managed PostgreSQL (RDS, Cloud SQL,
-- Neon) where you are never superuser.
-- -------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() for server-side ids
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- trigram indexes for fuzzy search
CREATE EXTENSION IF NOT EXISTS "btree_gin";  -- composite GIN indexes

-- -------------------------------------------------------------------------
-- `app` schema: helpers used by RLS policies and triggers.
--
-- Kept out of `public` so it can never be confused with application data.
-- -------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS app;

COMMENT ON SCHEMA app IS
  'Internal helpers for tenant isolation and integrity enforcement. Not application data.';

-- Tenant scope of the current transaction.
--
-- `current_setting(..., true)` returns NULL when unset, and `"tenantId" = NULL` is
-- NULL, which RLS treats as "not visible". The fail-safe default is therefore NO
-- ROWS: a connection that forgot to establish tenant context sees nothing rather
-- than everything.
CREATE OR REPLACE FUNCTION app.current_tenant_id()
  RETURNS uuid
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
AS $$
  SELECT nullif(current_setting('app.tenant_id', true), '')::uuid
$$;

COMMENT ON FUNCTION app.current_tenant_id() IS
  'Tenant scope of the current transaction, set via SET LOCAL app.tenant_id.';

-- Escape hatch for trusted, tenant-agnostic work: authentication (which must find a
-- user before their tenant is known), platform administration, and background jobs
-- that legitimately span tenants.
--
-- Set with SET LOCAL so it cannot outlive its transaction or leak across a pooled
-- connection, and never derived from user input.
CREATE OR REPLACE FUNCTION app.rls_bypassed()
  RETURNS boolean
  LANGUAGE sql
  STABLE
  PARALLEL SAFE
AS $$
  SELECT coalesce(current_setting('app.bypass_rls', true), 'off') = 'on'
$$;

COMMENT ON FUNCTION app.rls_bypassed() IS
  'True when the current transaction has explicitly opted out of tenant filtering.';

-- -------------------------------------------------------------------------
-- Runtime role privileges.
--
-- The application connects as a role that owns nothing, which is what makes Row
-- Level Security enforceable against it. An owner or superuser bypasses RLS
-- entirely, so connecting as one would silently disable every policy below.
--
-- Guarded: if the role is absent this raises a loud EXCEPTION rather than skipping
-- quietly. A deployment whose runtime role never received its grants fails at the
-- first query with an opaque permission error, which is far worse to diagnose than a
-- migration that refuses to proceed and says why.
-- -------------------------------------------------------------------------
DO $$
DECLARE
  app_role text := 'abidesk_app';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    RAISE EXCEPTION
      'Runtime role "%" does not exist.', app_role
      USING HINT =
        'Create it before migrating. Docker Compose does this via '
        'docker/postgres/init/01-init-roles.sh. On managed PostgreSQL run '
        'docker/postgres/init/managed-setup.sql once as a superuser.';
  END IF;

  EXECUTE format('GRANT USAGE ON SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT USAGE ON SCHEMA app TO %I', app_role);

  -- Applies to every table this migration is about to create.
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
    'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO %I', app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public '
    'GRANT USAGE, SELECT ON SEQUENCES TO %I', app_role);
  EXECUTE format(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA app GRANT EXECUTE ON FUNCTIONS TO %I', app_role);

  -- And to anything that already exists, so re-running on a partially built
  -- database converges instead of leaving a gap.
  EXECUTE format(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
  EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO %I', app_role);

  -- The runtime role must never create objects: no CREATE on public, and it is not
  -- the owner. Both are required for RLS to actually bind to it.
  EXECUTE format('REVOKE CREATE ON SCHEMA public FROM %I', app_role);
END
$$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;


-- =========================================================================
-- BASELINE PART 2 of 3 - schema, generated by
-- `prisma migrate diff --from-empty --to-schema-datamodel`
--
-- Everything below this line up to PART 3 is machine-generated. Do not hand-edit it;
-- change the Prisma schema and rebuild the baseline instead.
-- =========================================================================

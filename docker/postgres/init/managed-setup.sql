-- =========================================================================
-- One-time setup for MANAGED PostgreSQL (RDS, Cloud SQL, Azure, Neon, Supabase).
--
-- Docker Compose runs docker/postgres/init/01-init-roles.sh automatically on first
-- start. A managed instance has no such hook, so run this once, as a superuser or as
-- the instance's master role, BEFORE the first `prisma migrate deploy`.
--
--   psql "$ADMIN_URL" -v ON_ERROR_STOP=1 \
--        -v owner_password="'...'" -v app_password="'...'" \
--        -f docker/postgres/init/managed-setup.sql
--
-- Why two roles rather than one: the application connects as a role that owns nothing,
-- which is what makes PostgreSQL Row Level Security enforceable against it. An owner
-- or superuser bypasses every policy, so connecting as one would silently disable
-- tenant isolation across the entire system.
--
-- The baseline migration REFUSES TO RUN if abidesk_app is absent, rather than skipping
-- its grants quietly - a deployment that came up without them would fail later with an
-- opaque permission error instead of here, with an explanation.
-- =========================================================================

\set ON_ERROR_STOP on

-- Supply these on the command line, e.g. -v owner_password="'s3cret'"
\if :{?owner_password}
\else
  \echo 'ERROR: pass -v owner_password="''...''"'
  \quit 1
\endif

\if :{?app_password}
\else
  \echo 'ERROR: pass -v app_password="''...''"'
  \quit 1
\endif

-- -------------------------------------------------------------------------
-- Roles
-- -------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abidesk_owner') THEN
    EXECUTE format('CREATE ROLE abidesk_owner LOGIN PASSWORD %L', :'owner_password');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'abidesk_app') THEN
    EXECUTE format('CREATE ROLE abidesk_app LOGIN PASSWORD %L', :'app_password');
  END IF;
END
$$;

-- On managed providers the master role is not a true superuser, so it must be granted
-- membership in the new roles to be able to hand ownership over.
DO $$
BEGIN
  IF NOT pg_has_role(current_user, 'abidesk_owner', 'MEMBER') THEN
    EXECUTE format('GRANT abidesk_owner TO %I', current_user);
  END IF;
END
$$;

-- -------------------------------------------------------------------------
-- Ownership
--
-- The owner role must own the schema so Prisma Migrate can issue DDL without
-- superuser rights.
-- -------------------------------------------------------------------------
ALTER SCHEMA public OWNER TO abidesk_owner;

GRANT CONNECT ON DATABASE :"DBNAME" TO abidesk_app;
GRANT USAGE ON SCHEMA public TO abidesk_app;

-- Tables created later by migrations must be reachable by the runtime role
-- automatically, or every migration would need a manual GRANT.
ALTER DEFAULT PRIVILEGES FOR ROLE abidesk_owner IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO abidesk_app;
ALTER DEFAULT PRIVILEGES FOR ROLE abidesk_owner IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO abidesk_app;
ALTER DEFAULT PRIVILEGES FOR ROLE abidesk_owner IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO abidesk_app;

-- The runtime role must never create objects: required for RLS to bind to it.
REVOKE CREATE ON SCHEMA public FROM abidesk_app;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

-- -------------------------------------------------------------------------
-- Shadow database privilege.
--
-- Only needed if you intend to run `prisma migrate dev` against this instance, which
-- you should not do in production. `prisma migrate deploy` never creates a shadow
-- database, so this can be omitted for a production deployment.
-- -------------------------------------------------------------------------
-- ALTER ROLE abidesk_owner CREATEDB;

-- -------------------------------------------------------------------------
-- Extensions.
--
-- pgcrypto, pg_trgm and btree_gin are trusted extensions in PostgreSQL 13+, so the
-- baseline migration installs them itself as the owner. Uncomment here only if your
-- provider restricts extension creation to the master role.
-- -------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- CREATE EXTENSION IF NOT EXISTS "btree_gin";

\echo ''
\echo 'Roles ready. Next: set MIGRATION_DATABASE_URL to the abidesk_owner connection'
\echo 'and DATABASE_URL to the abidesk_app connection, then run prisma migrate deploy.'

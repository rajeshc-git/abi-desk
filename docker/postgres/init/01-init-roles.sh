#!/bin/sh
# ---------------------------------------------------------------------------
# Creates the two-role setup that makes tenant isolation a database guarantee.
#
#   abidesk_owner : owns the schema. Prisma Migrate connects as this role because
#                   DDL requires ownership. Bypasses RLS (owners always do).
#   abidesk_app   : the runtime role used by the API and worker. Owns nothing,
#                   so Row Level Security policies are ENFORCED against it.
#
# If the application connected as the owner (or as a superuser), every RLS policy
# in the system would be silently skipped. That is the single most common way
# multi-tenant isolation gets defeated, so the split is set up here, once, at
# database initialization time.
#
# Runs automatically on first container start (docker-entrypoint-initdb.d).
# ---------------------------------------------------------------------------
set -euo pipefail

DB="${POSTGRES_DB:-abidesk}"
OWNER_USER="${POSTGRES_OWNER_USER:-abidesk_owner}"
APP_USER="${POSTGRES_APP_USER:-abidesk_app}"

: "${POSTGRES_OWNER_PASSWORD:?POSTGRES_OWNER_PASSWORD must be set}"
: "${POSTGRES_APP_PASSWORD:?POSTGRES_APP_PASSWORD must be set}"

echo "[init] creating roles '${OWNER_USER}' and '${APP_USER}' in database '${DB}'"

psql -v ON_ERROR_STOP=1 --username "${POSTGRES_USER}" --dbname "${DB}" <<-EOSQL
	DO \$\$
	BEGIN
	  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${OWNER_USER}') THEN
	    CREATE ROLE ${OWNER_USER} LOGIN PASSWORD '${POSTGRES_OWNER_PASSWORD}';
	  END IF;

	  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${APP_USER}') THEN
	    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${POSTGRES_APP_PASSWORD}';
	  END IF;
	END
	\$\$;

	-- The owner role must own the database and schema so Prisma Migrate can
	-- create, alter and drop objects without superuser rights.
	ALTER DATABASE ${DB} OWNER TO ${OWNER_USER};
	ALTER SCHEMA public OWNER TO ${OWNER_USER};

	-- `prisma migrate dev` diffs the schema inside a throwaway "shadow database"
	-- that it creates and drops itself, so the owner needs CREATEDB. This is a
	-- development-time need only: `prisma migrate deploy`, which is what runs in
	-- the containers and in CI, never creates a shadow database. Deliberately
	-- granted to the owner and never to the runtime role.
	ALTER ROLE ${OWNER_USER} CREATEDB;

	-- The runtime role gets data access only: no CREATE, no ownership.
	GRANT CONNECT ON DATABASE ${DB} TO ${APP_USER};
	GRANT USAGE ON SCHEMA public TO ${APP_USER};

	-- Tables created later by migrations must be reachable by the app role
	-- automatically, otherwise every migration would need a manual GRANT.
	ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_USER} IN SCHEMA public
	  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${APP_USER};
	ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_USER} IN SCHEMA public
	  GRANT USAGE, SELECT ON SEQUENCES TO ${APP_USER};
	ALTER DEFAULT PRIVILEGES FOR ROLE ${OWNER_USER} IN SCHEMA public
	  GRANT EXECUTE ON FUNCTIONS TO ${APP_USER};

	-- Defence in depth: nobody creates objects in public except the owner.
	REVOKE CREATE ON SCHEMA public FROM PUBLIC;

	-- Extensions used across the schema: UUID generation and trigram search for
	-- the knowledge base / ticket search. Created here because CREATE EXTENSION
	-- requires superuser.
	CREATE EXTENSION IF NOT EXISTS "pgcrypto";
	CREATE EXTENSION IF NOT EXISTS "pg_trgm";
	CREATE EXTENSION IF NOT EXISTS "btree_gin";
EOSQL

echo "[init] role setup complete"

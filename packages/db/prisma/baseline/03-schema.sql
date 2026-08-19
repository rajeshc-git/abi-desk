-- =========================================================================
-- BASELINE PART 3 of 3 - enforcement: guarantees Prisma cannot express (03-schema.sql)
--
-- Row Level Security, partial unique constraints, append-only enforcement,
-- full-text search maintenance, and gap-free ticket numbering.
--
-- Everything here is a rule the application cannot opt out of. It lives in the
-- database on purpose: an isolation rule enforced only in TypeScript is one
-- forgotten `where` clause away from a cross-tenant data leak.
--
-- Do not edit the assembled migration directly. Edit this file and re-run
-- `pnpm --filter @abi-desk/db run baseline:build`.
-- =========================================================================


-- =========================================================================
-- 1. Row Level Security, applied by introspection
--
-- The table list is DERIVED from the catalogue - every table in `public` carrying a
-- `tenantId` column - rather than hand-maintained.
--
-- This is deliberate and it is the most important design decision in this file. A
-- hardcoded list is one omission away from an unprotected table, and that omission
-- is invisible: the table works perfectly in every test while leaking across
-- tenants. Deriving the list means a table added six months from now is protected
-- the moment it is created, without anyone remembering to come back here.
--
-- Nullability decides the policy shape:
--   tenantId NOT NULL  -> strict equality with the current tenant.
--   tenantId NULLABLE  -> still strict. These tables hold platform-level rows with a
--                         NULL tenantId (platform administrators, platform audit
--                         entries), and a tenant must never see them. NULL = NULL is
--                         NULL in SQL, so such rows are invisible without a bypass,
--                         which is exactly right.
--
-- `workflow_transition` is the single documented exception and is overridden below.
-- =========================================================================

DO $$
DECLARE
  tbl text;
  applied int := 0;
BEGIN
  FOR tbl IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = c.oid
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND a.attname = 'tenantId'
      AND NOT a.attisdropped
    ORDER BY c.relname
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON public.%I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON public.%I
         USING (app.rls_bypassed() OR "tenantId" = app.current_tenant_id())
         WITH CHECK (app.rls_bypassed() OR "tenantId" = app.current_tenant_id())',
      tbl);
    applied := applied + 1;
  END LOOP;

  RAISE NOTICE 'Row Level Security applied to % tenant-scoped tables', applied;
END
$$;

-- The tenant row itself is keyed on `id`, not `tenantId`, so the loop above misses it.
ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON public.tenant;
CREATE POLICY tenant_isolation ON public.tenant
  USING (app.rls_bypassed() OR id = app.current_tenant_id())
  WITH CHECK (app.rls_bypassed() OR id = app.current_tenant_id());

-- Workflow transitions are the one shared-defaults table. Rows with a NULL tenantId
-- are the product's default pipeline and every tenant must be able to READ them.
-- WITH CHECK stays strict, so a tenant can add its own overrides but cannot write a
-- new global default.
DROP POLICY IF EXISTS tenant_isolation ON public.workflow_transition;
CREATE POLICY tenant_isolation ON public.workflow_transition
  USING (
    app.rls_bypassed()
    OR "tenantId" IS NULL
    OR "tenantId" = app.current_tenant_id()
  )
  WITH CHECK (app.rls_bypassed() OR "tenantId" = app.current_tenant_id());

-- `role`, `permission` and `role_permission` are a global, read-only catalogue shipped
-- with the product. No RLS: every tenant legitimately reads the same rows, and only
-- migrations and the seed write them.
REVOKE INSERT, UPDATE, DELETE ON public.role FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.permission FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.role_permission FROM PUBLIC;


-- =========================================================================
-- 2. Constraints Prisma cannot express
--
-- All partial unique indexes. PostgreSQL treats NULLs as distinct, so a plain
-- composite unique over a nullable column does not actually enforce uniqueness -
-- which is the precise trap each of these avoids.
-- =========================================================================

-- Email uniqueness, split by tenancy. Emails are normalised to lowercase by the
-- application, so no expression index is needed.
CREATE UNIQUE INDEX IF NOT EXISTS user_tenant_email_unique
  ON public."user" ("tenantId", email)
  WHERE "deletedAt" IS NULL AND "tenantId" IS NOT NULL;

-- Platform users (PLATFORM_ADMIN) have a NULL tenantId; without this a composite
-- unique would permit unlimited duplicates of the same vendor account.
CREATE UNIQUE INDEX IF NOT EXISTS user_platform_email_unique
  ON public."user" (email)
  WHERE "deletedAt" IS NULL AND "tenantId" IS NULL;

-- Exactly one default brand / queue / business-hours / SLA policy per tenant.
CREATE UNIQUE INDEX IF NOT EXISTS brand_single_default_per_tenant
  ON public.brand ("tenantId") WHERE "isDefault" AND "deletedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS queue_single_default_per_tenant
  ON public.queue ("tenantId") WHERE "isDefault";

CREATE UNIQUE INDEX IF NOT EXISTS business_hours_single_default_per_tenant
  ON public.business_hours ("tenantId") WHERE "isDefault";

CREATE UNIQUE INDEX IF NOT EXISTS sla_policy_single_default_per_tenant
  ON public.sla_policy ("tenantId") WHERE "isDefault";

-- One role assignment per (user, role) tenant-wide, and one per brand when the
-- assignment is brand-scoped. Two indexes, because `brandId` is nullable.
CREATE UNIQUE INDEX IF NOT EXISTS user_role_unique_tenant_wide
  ON public.user_role ("userId", "roleId") WHERE "brandId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_role_unique_per_brand
  ON public.user_role ("userId", "roleId", "brandId") WHERE "brandId" IS NOT NULL;

-- At most one live invitation per email per tenant. Re-inviting after acceptance or
-- revocation stays possible.
CREATE UNIQUE INDEX IF NOT EXISTS invitation_single_pending_per_email
  ON public.invitation ("tenantId", email)
  WHERE "acceptedAt" IS NULL AND "revokedAt" IS NULL;

-- Workflow transitions: one row per status pair, per tenant and globally.
CREATE UNIQUE INDEX IF NOT EXISTS workflow_transition_unique_per_tenant
  ON public.workflow_transition ("tenantId", "fromStatus", "toStatus")
  WHERE "tenantId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS workflow_transition_unique_global
  ON public.workflow_transition ("fromStatus", "toStatus")
  WHERE "tenantId" IS NULL;

-- One open approval per ticket per status pair; resolved ones may repeat, which is
-- what lets a rejected handover be requested again.
CREATE UNIQUE INDEX IF NOT EXISTS approval_request_single_pending
  ON public.approval_request ("ticketId", "fromStatus", "toStatus")
  WHERE status = 'PENDING';

-- Sanity checks that belong next to the data rather than in a service.
ALTER TABLE public.csat_response DROP CONSTRAINT IF EXISTS csat_rating_range;
ALTER TABLE public.csat_response
  ADD CONSTRAINT csat_rating_range CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE public.business_hours_day DROP CONSTRAINT IF EXISTS business_hours_day_valid_window;
ALTER TABLE public.business_hours_day
  ADD CONSTRAINT business_hours_day_valid_window
  CHECK (weekday BETWEEN 0 AND 6
         AND "startMinute" >= 0 AND "endMinute" <= 1440
         AND "startMinute" < "endMinute");

ALTER TABLE public.ticket_link DROP CONSTRAINT IF EXISTS ticket_link_no_self_reference;
ALTER TABLE public.ticket_link
  ADD CONSTRAINT ticket_link_no_self_reference CHECK ("sourceId" <> "targetId");


-- =========================================================================
-- 3. Append-only enforcement
--
-- The requirements list Audit Logs and SOC 2 / ISO 27001 compliance. An audit trail
-- that an administrator - or a compromised application account - can rewrite is not
-- evidence.
--
-- UPDATE is refused unconditionally. DELETE is refused unless the retention job
-- explicitly announces itself, which keeps lawful data-retention purges possible
-- without leaving a general-purpose delete path open.
-- =========================================================================

CREATE OR REPLACE FUNCTION app.reject_audit_mutation()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND coalesce(current_setting('app.retention_purge', true), 'off') = 'on'
  THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION
    'audit_log is append-only; % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege',
          HINT = 'Retention purges must set app.retention_purge = ''on''.';
END
$$;

DROP TRIGGER IF EXISTS audit_log_reject_update ON public.audit_log;
CREATE TRIGGER audit_log_reject_update
  BEFORE UPDATE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION app.reject_audit_mutation();

DROP TRIGGER IF EXISTS audit_log_reject_delete ON public.audit_log;
CREATE TRIGGER audit_log_reject_delete
  BEFORE DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION app.reject_audit_mutation();

-- Ticket events are the customer-visible timeline and are equally append-only.
DROP TRIGGER IF EXISTS ticket_event_reject_update ON public.ticket_event;
CREATE TRIGGER ticket_event_reject_update
  BEFORE UPDATE ON public.ticket_event
  FOR EACH ROW EXECUTE FUNCTION app.reject_audit_mutation();


-- =========================================================================
-- 4. Full-text search maintenance
--
-- A trigger rather than a generated column: Prisma cannot model
-- `GENERATED ALWAYS AS`, but it is perfectly happy with a plain `tsvector` column
-- whose contents are maintained for it. This keeps search inside PostgreSQL - no
-- separate search cluster to operate - and stops `migrate dev` proposing to drop the
-- column on every run.
--
-- Weights: A = number and subject (what people actually search), B = category,
-- C = body. `ts_rank` then orders sensibly without hand-tuning.
-- =========================================================================

CREATE OR REPLACE FUNCTION app.ticket_search_vector_refresh()
  RETURNS trigger
  LANGUAGE plpgsql
AS $$
BEGIN
  NEW."searchVector" :=
      setweight(to_tsvector('english', coalesce(NEW.number, '')), 'A')
   || setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A')
   || setweight(to_tsvector('english', coalesce(NEW.category, '')), 'B')
   || setweight(to_tsvector('english', coalesce(NEW.subcategory, '')), 'B')
   || setweight(to_tsvector('english', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS ticket_search_vector_trigger ON public.ticket;
CREATE TRIGGER ticket_search_vector_trigger
  BEFORE INSERT OR UPDATE OF number, subject, description, category, subcategory
  ON public.ticket
  FOR EACH ROW EXECUTE FUNCTION app.ticket_search_vector_refresh();


-- =========================================================================
-- 5. Ticket number allocation
--
-- Gap-free, race-free, per tenant. `INSERT ... ON CONFLICT DO UPDATE ... RETURNING`
-- takes a row lock, so concurrent callers serialise on it. `MAX(sequence) + 1` would
-- hand the same number to two transactions, and a PostgreSQL sequence is global
-- rather than per tenant.
-- =========================================================================

CREATE OR REPLACE FUNCTION app.next_ticket_sequence(p_tenant_id uuid)
  RETURNS integer
  LANGUAGE plpgsql
AS $$
DECLARE
  next_value integer;
BEGIN
  INSERT INTO public.ticket_sequence ("tenantId", "lastValue", "updatedAt")
  VALUES (p_tenant_id, 1, now())
  ON CONFLICT ("tenantId") DO UPDATE
    SET "lastValue" = public.ticket_sequence."lastValue" + 1,
        "updatedAt" = now()
  RETURNING "lastValue" INTO next_value;

  RETURN next_value;
END
$$;

COMMENT ON FUNCTION app.next_ticket_sequence(uuid) IS
  'Atomically allocates the next per-tenant ticket number.';


-- =========================================================================
-- 6. Grants on everything created above
--
-- `ALTER DEFAULT PRIVILEGES` in part 1 covers tables, but functions created
-- here need an explicit grant, and re-granting tables is harmless and makes this
-- section self-sufficient.
-- =========================================================================

DO $$
DECLARE
  app_role text := 'abidesk_app';
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = app_role) THEN
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO %I', app_role);
    EXECUTE format('GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO %I', app_role);
    EXECUTE format('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO %I', app_role);
  END IF;
END
$$;


-- =========================================================================
-- 7. Self-check - fail the migration rather than deploy unprotected
--
-- The single most valuable thing in this file. Every guarantee above is asserted, and
-- a violation aborts the transaction so a fresh deployment CANNOT come up with a
-- tenant-scoped table missing its policy.
--
-- Without this, a mistake here produces a database that passes every functional test
-- and quietly serves one tenant's data to another.
-- =========================================================================

DO $$
DECLARE
  unprotected text[];
  missing_policy text[];
  problem text;
BEGIN
  -- Every table with a tenantId must have RLS enabled.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO unprotected
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attname = 'tenantId'
    AND NOT a.attisdropped
    AND NOT c.relrowsecurity;

  IF unprotected IS NOT NULL THEN
    RAISE EXCEPTION
      'Row Level Security is NOT enabled on tenant-scoped table(s): %',
      array_to_string(unprotected, ', ')
      USING HINT = 'The baseline RLS loop did not cover these. Do not deploy.';
  END IF;

  -- ...and a tenant_isolation policy attached.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO missing_policy
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND a.attname = 'tenantId'
    AND NOT a.attisdropped
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename = c.relname
        AND p.policyname = 'tenant_isolation'
    );

  IF missing_policy IS NOT NULL THEN
    RAISE EXCEPTION
      'tenant_isolation policy missing on: %', array_to_string(missing_policy, ', ')
      USING HINT = 'Do not deploy.';
  END IF;

  -- The tenant table itself.
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'tenant' AND policyname = 'tenant_isolation'
  ) THEN
    RAISE EXCEPTION 'tenant_isolation policy missing on the tenant table';
  END IF;

  -- Append-only enforcement.
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'public.audit_log'::regclass AND NOT tgisinternal) < 2 THEN
    RAISE EXCEPTION 'audit_log is missing its append-only triggers';
  END IF;

  -- Search maintenance.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.ticket'::regclass
      AND tgname = 'ticket_search_vector_trigger'
  ) THEN
    RAISE EXCEPTION 'ticket search vector trigger is missing';
  END IF;

  -- Ticket numbering.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app' AND p.proname = 'next_ticket_sequence'
  ) THEN
    RAISE EXCEPTION 'app.next_ticket_sequence is missing';
  END IF;

  -- The runtime role must NOT be able to create objects, or RLS would not bind to it.
  IF has_schema_privilege('abidesk_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION
      'Runtime role abidesk_app has CREATE on schema public'
      USING HINT = 'It must own nothing for Row Level Security to be enforced against it.';
  END IF;

  IF NOT has_table_privilege('abidesk_app', 'public.ticket', 'SELECT') THEN
    RAISE EXCEPTION 'Runtime role abidesk_app cannot read public.ticket - grants did not apply';
  END IF;

  RAISE NOTICE 'Baseline self-check passed: tenant isolation, append-only audit, search and numbering all verified.';
END
$$;

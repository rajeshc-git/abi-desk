-- =========================================================================
-- Row Level Security smoke check.
--
--   docker compose exec -T postgres psql -U abidesk_app -d abidesk \
--     -v ON_ERROR_STOP=1 -f /checks/rls-smoke.sql
--
-- Run as the RUNTIME role (abidesk_app). Running it as the owner proves nothing:
-- owners bypass RLS, which is exactly why the application never connects as one.
--
-- Expectations are asserted, not eyeballed - every check RAISEs on failure so a
-- regression fails loudly instead of printing a wrong number nobody reads.
-- =========================================================================

\set ACME '11111111-1111-1111-1111-111111111111'
\set GLOBEX '22222222-2222-2222-2222-222222222222'

-- -------------------------------------------------------------------------
-- 1. No tenant context => no rows. The fail-safe default.
-- -------------------------------------------------------------------------
DO $$
DECLARE visible int;
BEGIN
  SELECT count(*) INTO visible FROM tenant;
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL: % tenant rows visible without tenant context (expected 0)', visible;
  END IF;
  RAISE NOTICE 'PASS  no tenant context -> 0 rows visible';
END
$$;

-- -------------------------------------------------------------------------
-- 2. With tenant context => exactly that tenant.
-- -------------------------------------------------------------------------
BEGIN;
SET LOCAL app.tenant_id = '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE visible int; slug_seen text;
BEGIN
  SELECT count(*), min(slug) INTO visible, slug_seen FROM tenant;
  IF visible <> 1 OR slug_seen <> 'acme' THEN
    RAISE EXCEPTION 'FAIL: expected only acme visible, saw % rows (%)', visible, slug_seen;
  END IF;
  RAISE NOTICE 'PASS  tenant context acme -> only acme visible';
END
$$;
COMMIT;

-- -------------------------------------------------------------------------
-- 3. The other tenant's rows are unreachable even when named explicitly.
--    This is the check that matters: an attacker supplies a known id directly.
-- -------------------------------------------------------------------------
BEGIN;
SET LOCAL app.tenant_id = '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE visible int;
BEGIN
  SELECT count(*) INTO visible FROM tenant
   WHERE id = '22222222-2222-2222-2222-222222222222';
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL: cross-tenant row reachable by explicit id';
  END IF;
  RAISE NOTICE 'PASS  explicit cross-tenant id -> 0 rows';
END
$$;
COMMIT;

-- -------------------------------------------------------------------------
-- 4. Writing a row for another tenant is refused by the policy's WITH CHECK.
-- -------------------------------------------------------------------------
BEGIN;
SET LOCAL app.tenant_id = '11111111-1111-1111-1111-111111111111';
DO $$
BEGIN
  BEGIN
    INSERT INTO tag ("tenantId", name, slug, "createdAt", "updatedAt")
    VALUES ('22222222-2222-2222-2222-222222222222', 'smuggled', 'smuggled', now(), now());
    RAISE EXCEPTION 'FAIL: insert for another tenant succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  cross-tenant INSERT rejected by RLS WITH CHECK';
  END;
END
$$;
ROLLBACK;

-- -------------------------------------------------------------------------
-- 5. Tenant context does not survive the transaction (SET LOCAL semantics),
--    so a pooled connection cannot leak scope into the next request.
-- -------------------------------------------------------------------------
DO $$
DECLARE visible int;
BEGIN
  SELECT count(*) INTO visible FROM tenant;
  IF visible <> 0 THEN
    RAISE EXCEPTION 'FAIL: tenant context leaked past transaction (% rows)', visible;
  END IF;
  RAISE NOTICE 'PASS  tenant context does not outlive its transaction';
END
$$;

-- -------------------------------------------------------------------------
-- 6. Audit log is append-only.
-- -------------------------------------------------------------------------
-- `id` is omitted deliberately: UUID defaults live in the database
-- (`gen_random_uuid()`), not only in the Prisma client, so raw SQL works too.
BEGIN;
SET LOCAL app.tenant_id = '11111111-1111-1111-1111-111111111111';
INSERT INTO audit_log ("tenantId", action, "resourceType", "createdAt")
VALUES ('11111111-1111-1111-1111-111111111111', 'test.write', 'test', now());

DO $$
BEGIN
  BEGIN
    UPDATE audit_log SET action = 'tampered' WHERE action = 'test.write';
    RAISE EXCEPTION 'FAIL: audit_log UPDATE succeeded';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  audit_log UPDATE rejected';
  END;

  BEGIN
    DELETE FROM audit_log WHERE action = 'test.write';
    RAISE EXCEPTION 'FAIL: audit_log DELETE succeeded without purge flag';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  audit_log DELETE rejected without retention flag';
  END;
END
$$;
ROLLBACK;

-- -------------------------------------------------------------------------
-- 7. The retention job's explicit opt-in does permit deletion.
-- -------------------------------------------------------------------------
BEGIN;
SET LOCAL app.tenant_id = '11111111-1111-1111-1111-111111111111';
SET LOCAL app.retention_purge = 'on';
INSERT INTO audit_log ("tenantId", action, "resourceType", "createdAt")
VALUES ('11111111-1111-1111-1111-111111111111', 'purge.probe', 'test', now());
DO $$
DECLARE removed int;
BEGIN
  DELETE FROM audit_log WHERE action = 'purge.probe';
  GET DIAGNOSTICS removed = ROW_COUNT;
  IF removed <> 1 THEN
    RAISE EXCEPTION 'FAIL: retention purge deleted % rows (expected 1)', removed;
  END IF;
  RAISE NOTICE 'PASS  retention purge flag permits DELETE';
END
$$;
ROLLBACK;

-- -------------------------------------------------------------------------
-- 8. Bypass reaches every tenant - used by authentication and platform admin.
-- -------------------------------------------------------------------------
BEGIN;
SET LOCAL app.bypass_rls = 'on';
DO $$
DECLARE visible int;
BEGIN
  SELECT count(*) INTO visible FROM tenant;
  IF visible < 2 THEN
    RAISE EXCEPTION 'FAIL: bypass saw only % tenants', visible;
  END IF;
  RAISE NOTICE 'PASS  explicit bypass sees all % tenants', visible;
END
$$;
COMMIT;

-- -------------------------------------------------------------------------
-- 9. The runtime role still cannot create objects.
-- -------------------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    EXECUTE 'CREATE TABLE rls_smoke_should_fail (id int)';
    EXECUTE 'DROP TABLE rls_smoke_should_fail';
    RAISE EXCEPTION 'FAIL: runtime role was able to create a table';
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'PASS  runtime role cannot create objects';
  END;
END
$$;

\echo ''
\echo 'RLS smoke check complete - all assertions passed.'

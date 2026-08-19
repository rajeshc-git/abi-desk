-- =========================================================================
-- Negative test: does the deployment guard actually bite?
--
-- A verification script that can never fail is worse than none, because it manufactures
-- confidence. This deliberately breaks tenant isolation on one table, confirms the guard
-- detects it, then restores the correct state.
--
-- Wrapped in a transaction and rolled back, so it cannot leave the database degraded even
-- if it aborts partway.
-- =========================================================================

BEGIN;

\echo '=== breaking RLS on public.ticket on purpose ==='
ALTER TABLE public.ticket DISABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  offenders text[];
  detected boolean := false;
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO offenders
  FROM pg_class c
  JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE nsp.nspname = 'public' AND c.relkind = 'r'
    AND a.attname = 'tenantId' AND NOT a.attisdropped
    AND NOT c.relrowsecurity;

  IF offenders IS NOT NULL AND 'ticket' = ANY(offenders) THEN
    detected := true;
  END IF;

  IF NOT detected THEN
    RAISE EXCEPTION
      'FAIL: the guard did NOT notice RLS was disabled on public.ticket'
      USING HINT = 'The deployment verification is vacuous and must be fixed.';
  END IF;

  RAISE NOTICE 'PASS  the guard detects a table with RLS disabled (%)', array_to_string(offenders, ', ');
END
$$;

\echo '=== dropping the policy on purpose ==='
ALTER TABLE public.ticket ENABLE ROW LEVEL SECURITY;
DROP POLICY tenant_isolation ON public.ticket;

DO $$
DECLARE
  offenders text[];
BEGIN
  SELECT array_agg(c.relname ORDER BY c.relname) INTO offenders
  FROM pg_class c
  JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE nsp.nspname = 'public' AND c.relkind = 'r'
    AND a.attname = 'tenantId' AND NOT a.attisdropped
    AND NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = c.relname
        AND p.policyname = 'tenant_isolation');

  IF offenders IS NULL OR NOT ('ticket' = ANY(offenders)) THEN
    RAISE EXCEPTION 'FAIL: the guard did NOT notice the missing tenant_isolation policy';
  END IF;

  RAISE NOTICE 'PASS  the guard detects a missing tenant_isolation policy';
END
$$;

-- Nothing above is kept: the whole point is to prove detection, not to change state.
ROLLBACK;

\echo ''
\echo '=== confirming the rollback restored protection ==='
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.ticket'::regclass) THEN
    RAISE EXCEPTION 'public.ticket still has RLS disabled after rollback';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='ticket' AND policyname='tenant_isolation') THEN
    RAISE EXCEPTION 'public.ticket policy was not restored by the rollback';
  END IF;

  RAISE NOTICE 'PASS  rollback restored RLS and the policy on public.ticket';
  RAISE NOTICE '';
  RAISE NOTICE 'Negative test passed: the deployment guard is not vacuous.';
END
$$;

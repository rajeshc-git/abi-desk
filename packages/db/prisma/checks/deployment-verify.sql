-- =========================================================================
-- Post-deployment verification.
--
--   docker compose exec -T postgres psql -U postgres -d abidesk \
--     -v ON_ERROR_STOP=1 -f /checks/deployment-verify.sql
--
-- Independently re-asserts everything the baseline's self-check asserted, from the
-- outside. The self-check runs inside the migration transaction and proves the
-- migration built what it intended; this proves the deployed database is actually in
-- that state afterwards. Both are cheap, and they fail for different reasons.
--
-- Every check RAISEs on failure, so a non-zero exit means do not ship.
-- =========================================================================

\echo '=== object counts ==='
SELECT
  (SELECT count(*) FROM pg_tables WHERE schemaname = 'public')                       AS tables,
  (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relrowsecurity)                                 AS rls_enabled,
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public')                     AS policies,
  (SELECT count(*) FROM pg_trigger WHERE NOT tgisinternal)                           AS triggers,
  (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'app')                                                         AS app_functions,
  (SELECT count(*) FROM pg_indexes
    WHERE schemaname = 'public' AND indexdef LIKE '%WHERE%')                          AS partial_indexes,
  (SELECT count(*) FROM pg_extension)                                                AS extensions,
  (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL)             AS migrations_applied;

DO $$
DECLARE
  offenders text[];
  n int;
BEGIN
  -- 1. Exactly one migration should have been applied on a fresh deploy.
  SELECT count(*) INTO n FROM _prisma_migrations;
  IF n <> 1 THEN
    RAISE EXCEPTION 'Expected exactly 1 migration on a fresh database, found %', n
      USING HINT = 'The history was not squashed, or the image carries stale migrations.';
  END IF;
  RAISE NOTICE 'PASS  single baseline migration applied';

  -- 2. No failed migration.
  IF EXISTS (SELECT 1 FROM _prisma_migrations WHERE finished_at IS NULL) THEN
    RAISE EXCEPTION 'A migration is recorded as started but never finished';
  END IF;
  RAISE NOTICE 'PASS  migration finished cleanly';

  -- 3. Every tenant-scoped table has RLS enabled.
  SELECT array_agg(c.relname ORDER BY c.relname) INTO offenders
  FROM pg_class c
  JOIN pg_namespace nsp ON nsp.oid = c.relnamespace
  JOIN pg_attribute a ON a.attrelid = c.oid
  WHERE nsp.nspname = 'public' AND c.relkind = 'r'
    AND a.attname = 'tenantId' AND NOT a.attisdropped
    AND NOT c.relrowsecurity;

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'RLS not enabled on: %', array_to_string(offenders, ', ');
  END IF;
  RAISE NOTICE 'PASS  every tenant-scoped table has RLS enabled';

  -- 4. ...and a tenant_isolation policy.
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

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'tenant_isolation policy missing on: %', array_to_string(offenders, ', ');
  END IF;
  RAISE NOTICE 'PASS  every tenant-scoped table has a tenant_isolation policy';

  -- 5. The removed features left nothing behind.
  SELECT array_agg(tablename ORDER BY tablename) INTO offenders
  FROM pg_tables
  WHERE schemaname = 'public'
    AND (tablename LIKE 'kb_%' OR tablename LIKE 'integration_%'
         OR tablename IN ('ticket_ai_suggestion', 'ticket_external_link'));

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'Removed features still present: %', array_to_string(offenders, ', ');
  END IF;
  RAISE NOTICE 'PASS  no Knowledge Base, AI or tracker tables exist';

  -- 6. No AI-derived columns.
  SELECT array_agg(table_name || '.' || column_name) INTO offenders
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN ('aiRoutingEnabled', 'aiAutoApplyThreshold', 'sentimentScore');

  IF offenders IS NOT NULL THEN
    RAISE EXCEPTION 'AI columns still present: %', array_to_string(offenders, ', ');
  END IF;
  RAISE NOTICE 'PASS  no AI-derived columns exist';

  -- 7. Webhooks retained (still a required feature).
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='webhook_endpoint')
     OR NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='outbox_event')
  THEN
    RAISE EXCEPTION 'Webhook or outbox tables are missing';
  END IF;
  RAISE NOTICE 'PASS  webhook and outbox tables retained';

  -- 8. Privilege separation: the runtime role must own nothing.
  IF has_schema_privilege('abidesk_app', 'public', 'CREATE') THEN
    RAISE EXCEPTION 'Runtime role has CREATE on public - RLS would not bind to it';
  END IF;
  IF NOT has_table_privilege('abidesk_app', 'public.ticket', 'SELECT') THEN
    RAISE EXCEPTION 'Runtime role cannot read public.ticket - grants did not apply';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tableowner='abidesk_app') THEN
    RAISE EXCEPTION 'Runtime role owns tables - it would bypass RLS';
  END IF;
  RAISE NOTICE 'PASS  runtime role owns nothing and cannot create objects';

  -- 9. Append-only enforcement present.
  IF (SELECT count(*) FROM pg_trigger
      WHERE tgrelid = 'public.audit_log'::regclass AND NOT tgisinternal) < 2 THEN
    RAISE EXCEPTION 'audit_log append-only triggers missing';
  END IF;
  RAISE NOTICE 'PASS  audit_log is append-only';

  -- 10. Search and numbering.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid='public.ticket'::regclass
                   AND tgname='ticket_search_vector_trigger') THEN
    RAISE EXCEPTION 'ticket search trigger missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace nsp ON nsp.oid=p.pronamespace
                 WHERE nsp.nspname='app' AND p.proname='next_ticket_sequence') THEN
    RAISE EXCEPTION 'app.next_ticket_sequence missing';
  END IF;
  RAISE NOTICE 'PASS  search trigger and ticket numbering present';

  -- 11. Extensions.
  FOR n IN SELECT 1 LOOP END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pgcrypto')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_trgm')
     OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname='btree_gin') THEN
    RAISE EXCEPTION 'Required extensions are missing';
  END IF;
  RAISE NOTICE 'PASS  pgcrypto, pg_trgm and btree_gin installed';

  RAISE NOTICE '';
  RAISE NOTICE 'Deployment verification passed.';
END
$$;

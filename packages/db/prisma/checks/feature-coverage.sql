-- =========================================================================
-- Feature coverage: does the single baseline migration carry every database
-- object that each *completed* feature actually depends on?
--
--   docker compose exec -T postgres psql -U postgres -d abidesk \
--     -v ON_ERROR_STOP=1 -f /checks/feature-coverage.sql
--
-- Why this exists separately from deployment-verify.sql
-- ----------------------------------------------------
-- Squashing six migrations into one baseline raises an obvious risk: something a
-- shipped feature relies on gets dropped on the floor during reassembly, and nobody
-- notices until that code path runs in production.
--
-- `prisma migrate diff --exit-code` does NOT close this gap. It compares the Prisma
-- *datamodel* to the database, so it sees tables, columns, enums, foreign keys and
-- indexes Prisma knows about - and is blind to every hand-written object in
-- baseline part 03: RLS policies, triggers, functions, partial unique indexes and
-- CHECK constraints. Those are exactly the objects that enforce correctness rather
-- than merely storing data, and exactly the ones a squash could silently lose.
--
-- So this script walks feature by feature and asserts the objects that feature's
-- code calls. Grouped by feature, not by object type, so a failure names the thing
-- that would break rather than an anonymous missing index.
-- =========================================================================

\echo ''
\echo '=== feature coverage against the applied baseline ==='

DO $$
DECLARE
  -- Every check appends to `missing` rather than raising immediately, so one run
  -- reports everything that is wrong instead of one thing per run.
  feature text;
  missing text[] := '{}';
BEGIN
  -- ============ Feature: multi-tenancy and RLS isolation ================
  feature := 'tenancy/RLS';

  IF to_regnamespace('app') IS NULL THEN
    missing := missing || (feature || ': schema app');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname='app' AND p.proname='current_tenant_id') THEN
    missing := missing || (feature || ': app.current_tenant_id() - every RLS policy calls this');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                 WHERE n.nspname='app' AND p.proname='rls_bypassed') THEN
    missing := missing || (feature || ': app.rls_bypassed() - platform-admin escape hatch');
  END IF;

  IF (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname='tenant_isolation') < 40 THEN
    missing := missing || (feature || ': too few tenant_isolation policies');
  END IF;

  -- ============ Feature: authentication =================================
  feature := 'authentication';

  IF to_regclass('public.session') IS NULL THEN
    missing := missing || (feature || ': session');
  END IF;
  IF to_regclass('public.invitation') IS NULL THEN
    missing := missing || (feature || ': invitation');
  END IF;
  IF to_regclass('public.user_identity') IS NULL THEN
    missing := missing || (feature || ': user_identity');
  END IF;

  -- Email uniqueness is partial (scoped to non-deleted rows). A plain unique
  -- constraint would block re-inviting a soft-deleted address forever.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='user_tenant_email_unique') THEN
    missing := missing || (feature || ': user_tenant_email_unique partial index');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='user_platform_email_unique') THEN
    missing := missing || (feature || ': user_platform_email_unique partial index');
  END IF;
  -- One outstanding invitation per address; NULLs are distinct in PostgreSQL so
  -- this has to be a partial unique index, not a table constraint.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='invitation_single_pending_per_email') THEN
    missing := missing || (feature || ': invitation_single_pending_per_email partial index');
  END IF;

  -- ============ Feature: RBAC and audit log =============================
  feature := 'RBAC/audit';

  IF to_regclass('public.role') IS NULL
     OR to_regclass('public.permission') IS NULL
     OR to_regclass('public.role_permission') IS NULL
     OR to_regclass('public.user_role') IS NULL THEN
    missing := missing || (feature || ': role/permission catalogue tables');
  END IF;

  IF to_regclass('public.tenant_role_permission_override') IS NULL THEN
    missing := missing || (feature || ': tenant_role_permission_override');
  END IF;

  -- A role assignment is unique per brand *or* tenant-wide. Two partial indexes,
  -- because brandId is nullable and NULL defeats a single composite unique.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='user_role_unique_per_brand') THEN
    missing := missing || (feature || ': user_role_unique_per_brand partial index');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='user_role_unique_tenant_wide') THEN
    missing := missing || (feature || ': user_role_unique_tenant_wide partial index');
  END IF;

  -- The audit log is only evidence if it cannot be edited.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.audit_log')
                 AND tgname='audit_log_reject_update') THEN
    missing := missing || (feature || ': audit_log_reject_update trigger');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.audit_log')
                 AND tgname='audit_log_reject_delete') THEN
    missing := missing || (feature || ': audit_log_reject_delete trigger');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='app' AND p.proname='reject_audit_mutation') THEN
    missing := missing || (feature || ': app.reject_audit_mutation()');
  END IF;

  -- ============ Feature: ticket core ====================================
  feature := 'ticket core';

  IF to_regclass('public.ticket') IS NULL
     OR to_regclass('public.ticket_comment') IS NULL
     OR to_regclass('public.ticket_event') IS NULL
     OR to_regclass('public.ticket_watcher') IS NULL
     OR to_regclass('public.ticket_tag') IS NULL
     OR to_regclass('public.tag') IS NULL
     OR to_regclass('public.ticket_link') IS NULL THEN
    missing := missing || (feature || ': core ticket tables');
  END IF;

  -- Gap-free per-tenant numbering (ACME-73 -> ACME-74).
  IF to_regclass('public.ticket_sequence') IS NULL THEN
    missing := missing || (feature || ': ticket_sequence');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='app' AND p.proname='next_ticket_sequence') THEN
    missing := missing || (feature || ': app.next_ticket_sequence() - ticket numbering');
  END IF;

  -- Full-text search: the tsvector is maintained by trigger, not by application
  -- code, so a comment written by a background job is searchable too.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.ticket')
                 AND tgname='ticket_search_vector_trigger') THEN
    missing := missing || (feature || ': ticket_search_vector_trigger');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
                 WHERE n.nspname='app' AND p.proname='ticket_search_vector_refresh') THEN
    missing := missing || (feature || ': app.ticket_search_vector_refresh()');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid=to_regclass('public.ticket')
                 AND attname='searchVector' AND NOT attisdropped) THEN
    missing := missing || (feature || ': ticket.searchVector column');
  END IF;

  -- The timeline is evidence as well: events may be inserted, never rewritten.
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.ticket_event')
                 AND tgname='ticket_event_reject_update') THEN
    missing := missing || (feature || ': ticket_event_reject_update trigger');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='ticket_link_no_self_reference') THEN
    missing := missing || (feature || ': ticket_link_no_self_reference CHECK');
  END IF;

  -- ============ Feature: workflow / assignment / escalation =============
  feature := 'workflow';

  IF to_regclass('public.workflow_transition') IS NULL THEN
    missing := missing || (feature || ': workflow_transition - transitions are data, not code');
  END IF;
  IF to_regclass('public.escalation_policy') IS NULL THEN
    missing := missing || (feature || ': escalation_policy');
  END IF;
  IF to_regclass('public.queue') IS NULL OR to_regclass('public.team') IS NULL
     OR to_regclass('public.team_member') IS NULL THEN
    missing := missing || (feature || ': queue/team assignment tables');
  END IF;

  -- A tenant override and the global default must be separately unique, or a
  -- tenant could not shadow a global transition.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='workflow_transition_unique_global') THEN
    missing := missing || (feature || ': workflow_transition_unique_global partial index');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='workflow_transition_unique_per_tenant') THEN
    missing := missing || (feature || ': workflow_transition_unique_per_tenant partial index');
  END IF;

  -- ============ Feature: approvals ======================================
  feature := 'approvals';

  IF to_regclass('public.approval_request') IS NULL
     OR to_regclass('public.approval_decision') IS NULL THEN
    missing := missing || (feature || ': approval tables');
  END IF;

  -- Stops a double-click opening two gates on the same transition.
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public'
                 AND indexname='approval_request_single_pending') THEN
    missing := missing || (feature || ': approval_request_single_pending partial index');
  END IF;

  -- ============ Feature: media and diagnostics (schema ahead of code) ===
  feature := 'media/diagnostics';

  IF to_regclass('public.media_asset') IS NULL THEN
    missing := missing || (feature || ': media_asset');
  END IF;
  IF to_regclass('public.diagnostic_bundle') IS NULL THEN
    missing := missing || (feature || ': diagnostic_bundle');
  END IF;

  -- ============ Feature: CSAT (retained - in-house, no third party) =====
  feature := 'CSAT';

  IF to_regclass('public.csat_response') IS NULL THEN
    missing := missing || (feature || ': csat_response');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='csat_rating_range') THEN
    missing := missing || (feature || ': csat_rating_range CHECK');
  END IF;

  -- ============ Feature: webhooks / outbox ==============================
  feature := 'webhooks';

  IF to_regclass('public.webhook_endpoint') IS NULL
     OR to_regclass('public.webhook_delivery') IS NULL
     OR to_regclass('public.outbox_event') IS NULL THEN
    missing := missing || (feature || ': webhook/outbox tables');
  END IF;

  -- ============ Feature: SLA (schema ahead of code) =====================
  feature := 'SLA';

  IF to_regclass('public.sla_policy') IS NULL
     OR to_regclass('public.sla_target') IS NULL
     OR to_regclass('public.ticket_sla_state') IS NULL
     OR to_regclass('public.sla_event') IS NULL
     OR to_regclass('public.business_hours') IS NULL
     OR to_regclass('public.business_hours_day') IS NULL
     OR to_regclass('public.holiday') IS NULL THEN
    missing := missing || (feature || ': SLA tables');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='business_hours_day_valid_window') THEN
    missing := missing || (feature || ': business_hours_day_valid_window CHECK');
  END IF;

  -- ============ Feature: compliance / DSAR ==============================
  feature := 'compliance';

  IF to_regclass('public.data_subject_request') IS NULL
     OR to_regclass('public.retention_policy') IS NULL THEN
    missing := missing || (feature || ': DSAR/retention tables');
  END IF;

  -- ============ Verdict =================================================
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION E'The baseline is missing objects shipped features depend on:\n  - %',
      array_to_string(missing, E'\n  - ');
  END IF;

  RAISE NOTICE 'PASS  tenancy/RLS       schema, both policy functions, % policies',
    (SELECT count(*) FROM pg_policies WHERE schemaname='public' AND policyname='tenant_isolation');
  RAISE NOTICE 'PASS  authentication    session, invitation, identity + 3 partial uniques';
  RAISE NOTICE 'PASS  RBAC/audit        catalogue, overrides, 2 partial uniques, append-only triggers';
  RAISE NOTICE 'PASS  ticket core       7 tables, numbering fn, search trigger, append-only timeline';
  RAISE NOTICE 'PASS  workflow          transitions as data, escalation, queues/teams, 2 partial uniques';
  RAISE NOTICE 'PASS  approvals         request/decision + single-pending guard';
  RAISE NOTICE 'PASS  media/diagnostics media_asset, diagnostic_bundle';
  RAISE NOTICE 'PASS  CSAT              csat_response + rating CHECK';
  RAISE NOTICE 'PASS  webhooks          endpoint, delivery, outbox';
  RAISE NOTICE 'PASS  SLA               7 tables + business-hours window CHECK';
  RAISE NOTICE 'PASS  compliance        DSAR + retention policy';
  RAISE NOTICE '';
  RAISE NOTICE 'Every completed feature''s database objects survived the squash.';
END
$$;

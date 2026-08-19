-- =========================================================================
-- ABI Desk - baseline migration
--
-- ASSEMBLED FILE. DO NOT EDIT.
--
-- Built by packages/db/prisma/baseline/build.mjs by concatenating, in order:
--   prisma/baseline/01-schema.sql  (hand-written: extensions, app schema, grants)
--   prisma/baseline/02-schema.sql  (generated: prisma migrate diff --from-empty)
--   prisma/baseline/03-schema.sql  (hand-written: RLS, triggers, constraints)
--
-- To change it, edit the relevant source and run:
--   pnpm --filter @abi-desk/db run baseline:rebuild
--
-- This single file replaces the six incremental migrations produced during initial
-- development. Those were squashed because they contained pure churn: a fresh database
-- would have created the Knowledge Base, AI-routing and issue-tracker tables together
-- with their triggers and indexes, only to drop them again in the final step. Squashing
-- before first release is standard practice (Prisma calls it baselining) and is safe
-- precisely because there is no deployed data to preserve.
--
-- Generated 2026-08-09T16:00:08.790Z
-- =========================================================================

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

-- =========================================================================
-- BASELINE PART 2 of 3 - schema (02-schema.sql)
--
-- GENERATED FILE. DO NOT EDIT. NOT COMMITTED.
--
-- Every table, enum, index and foreign key, derived from the Prisma schema by:
--   prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema
--
-- Edit prisma/schema/*.prisma instead, then run:
--   pnpm --filter @abi-desk/db run baseline:rebuild
--
-- This file is gitignored on purpose. Committing it would create a second source of
-- truth for DDL that the Prisma schema already defines, and the copy is always the one
-- that drifts. The assembled migration.sql is the committed artifact.
-- =========================================================================

-- =========================================================================
-- BASELINE PART 2 of 3 - schema (02-schema.sql)
--
-- GENERATED FILE. DO NOT EDIT. NOT COMMITTED.
--
-- Every table, enum, index and foreign key, derived from the Prisma schema by:
--   prisma migrate diff --from-empty --to-schema-datamodel ./prisma/schema
--
-- Edit prisma/schema/*.prisma instead, then run:
--   pnpm --filter @abi-desk/db run baseline:rebuild
--
-- This file is gitignored on purpose. Committing it would create a second source of
-- truth for DDL that the Prisma schema already defines, and the copy is always the one
-- that drifts. The assembled migration.sql is the committed artifact.
-- =========================================================================

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SupportTier" AS ENUM ('L1', 'L2', 'L3', 'DEV', 'QA');

-- CreateEnum
CREATE TYPE "ActorType" AS ENUM ('USER', 'API_KEY', 'AUTOMATION', 'AI', 'SYSTEM', 'INTEGRATION');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WidgetLauncherPosition" AS ENUM ('BOTTOM_RIGHT', 'BOTTOM_LEFT', 'TOP_RIGHT', 'TOP_LEFT');

-- CreateEnum
CREATE TYPE "ChatConversationStatus" AS ENUM ('OPEN', 'QUEUED', 'WAITING', 'CLOSED');

-- CreateEnum
CREATE TYPE "ChatParticipantRole" AS ENUM ('CUSTOMER', 'AGENT', 'OBSERVER');

-- CreateEnum
CREATE TYPE "ChatMessageKind" AS ENUM ('TEXT', 'ATTACHMENT', 'SYSTEM', 'TICKET_LINK');

-- CreateEnum
CREATE TYPE "WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'EXHAUSTED');

-- CreateEnum
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PUBLISHED', 'FAILED', 'DEAD');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('IN_APP', 'EMAIL', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'READ');

-- CreateEnum
CREATE TYPE "DataSubjectRequestType" AS ENUM ('EXPORT', 'ERASURE');

-- CreateEnum
CREATE TYPE "DataSubjectRequestStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "RetentionScope" AS ENUM ('TICKET', 'MEDIA', 'DIAGNOSTIC', 'AUDIT', 'CHAT', 'WEBHOOK_DELIVERY');

-- CreateEnum
CREATE TYPE "UserKind" AS ENUM ('STAFF', 'CUSTOMER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "AuthProviderKind" AS ENUM ('PASSWORD', 'OIDC', 'SAML', 'MAGIC_LINK', 'WIDGET_HANDOFF');

-- CreateEnum
CREATE TYPE "SsoProtocol" AS ENUM ('OIDC', 'SAML');

-- CreateEnum
CREATE TYPE "QueueRoutingStrategy" AS ENUM ('MANUAL', 'ROUND_ROBIN', 'LEAST_LOADED');

-- CreateEnum
CREATE TYPE "RoleKey" AS ENUM ('GUEST_CUSTOMER', 'TENANT_ADMIN', 'L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM', 'QA_TEAM', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "RoleScope" AS ENUM ('PLATFORM', 'TENANT');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('NEW', 'TRIAGE', 'OPEN', 'PENDING_CUSTOMER', 'ON_HOLD', 'ESCALATED_L2', 'ESCALATED_L3', 'IN_DEVELOPMENT', 'IN_QA', 'PENDING_RELEASE', 'RELEASED', 'PENDING_VERIFICATION', 'AWAITING_CUSTOMER_CONFIRMATION', 'RESOLVED', 'CLOSED', 'REOPENED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL');

-- CreateEnum
CREATE TYPE "TicketType" AS ENUM ('QUESTION', 'INCIDENT', 'BUG', 'FEATURE_REQUEST', 'TASK');

-- CreateEnum
CREATE TYPE "TicketChannel" AS ENUM ('WIDGET', 'PORTAL', 'EMAIL', 'API', 'CHAT', 'PHONE');

-- CreateEnum
CREATE TYPE "CommentVisibility" AS ENUM ('PUBLIC', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CommentFormat" AS ENUM ('MARKDOWN', 'HTML', 'PLAIN');

-- CreateEnum
CREATE TYPE "TicketLinkType" AS ENUM ('RELATED', 'DUPLICATE_OF', 'BLOCKS', 'BLOCKED_BY', 'CAUSED_BY', 'MERGED_INTO');

-- CreateEnum
CREATE TYPE "TicketEventType" AS ENUM ('CREATED', 'STATUS_CHANGED', 'TIER_CHANGED', 'PRIORITY_CHANGED', 'CATEGORY_CHANGED', 'ASSIGNED', 'UNASSIGNED', 'QUEUE_CHANGED', 'TEAM_CHANGED', 'COMMENT_ADDED', 'INTERNAL_NOTE_ADDED', 'ATTACHMENT_ADDED', 'DIAGNOSTICS_ATTACHED', 'ESCALATED', 'DEESCALATED', 'REOPENED', 'RESOLVED', 'CLOSED', 'CANCELLED', 'CONFIRMATION_REQUESTED', 'CUSTOMER_CONFIRMED', 'CUSTOMER_REJECTED', 'SLA_TARGET_STARTED', 'SLA_WARNING', 'SLA_BREACHED', 'SLA_MET', 'APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'AUTOMATION_APPLIED', 'AI_SUGGESTION_APPLIED', 'AI_SUGGESTION_REJECTED', 'EXTERNAL_ISSUE_LINKED', 'EXTERNAL_ISSUE_UPDATED', 'TAG_ADDED', 'TAG_REMOVED', 'WATCHER_ADDED', 'WATCHER_REMOVED', 'LINKED', 'MERGED', 'CSAT_SUBMITTED', 'SPAM_MARKED');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('SCREENSHOT', 'SCREEN_CAPTURE', 'ANNOTATED_SCREENSHOT', 'SCREEN_RECORDING', 'VOICE_RECORDING', 'ATTACHMENT', 'CHAT_ATTACHMENT');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'PROCESSING', 'READY', 'QUARANTINED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "MediaScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('ANY', 'ALL', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ApprovalDecisionType" AS ENUM ('APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SlaTargetType" AS ENUM ('FIRST_RESPONSE', 'NEXT_RESPONSE', 'RESOLUTION');

-- CreateEnum
CREATE TYPE "SlaClockStatus" AS ENUM ('RUNNING', 'PAUSED', 'MET', 'BREACHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SlaEventType" AS ENUM ('STARTED', 'PAUSED', 'RESUMED', 'WARNING', 'BREACHED', 'MET', 'RECALCULATED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('TICKET_CREATED', 'TICKET_UPDATED', 'TICKET_STATUS_CHANGED', 'TICKET_ASSIGNED', 'TICKET_COMMENTED', 'TICKET_REOPENED', 'SLA_WARNING', 'SLA_BREACHED', 'SCHEDULE');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('SUCCESS', 'SKIPPED', 'FAILED', 'LOOP_BLOCKED');

-- CreateTable
CREATE TABLE "tenant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'TRIAL',
    "ticketPrefix" VARCHAR(12) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
    "locale" VARCHAR(16) NOT NULL DEFAULT 'en',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_setting" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "autoCloseAfterDays" INTEGER NOT NULL DEFAULT 7,
    "allowCustomerReopen" BOOLEAN NOT NULL DEFAULT true,
    "reopenWindowDays" INTEGER NOT NULL DEFAULT 14,
    "requireCategoryOnCreate" BOOLEAN NOT NULL DEFAULT false,
    "ticketRetentionDays" INTEGER NOT NULL DEFAULT 1095,
    "mediaRetentionDays" INTEGER NOT NULL DEFAULT 365,
    "diagnosticRetentionDays" INTEGER NOT NULL DEFAULT 180,
    "auditRetentionDays" INTEGER NOT NULL DEFAULT 2555,
    "extra" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_setting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "primaryColor" VARCHAR(9) NOT NULL DEFAULT '#2563EB',
    "accentColor" VARCHAR(9) NOT NULL DEFAULT '#1E40AF',
    "logoUrl" VARCHAR(2048),
    "faviconUrl" VARCHAR(2048),
    "supportEmail" VARCHAR(320),
    "portalDomain" VARCHAR(253),
    "timezone" VARCHAR(64),
    "locale" VARCHAR(16),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "brand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "widget_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "publicKey" VARCHAR(64) NOT NULL,
    "signingSecretEncrypted" TEXT NOT NULL,
    "signingSecretLast4" VARCHAR(4) NOT NULL,
    "signingSecretRotatedAt" TIMESTAMPTZ(6),
    "allowedOrigins" TEXT[],
    "screenshotEnabled" BOOLEAN NOT NULL DEFAULT true,
    "annotationEnabled" BOOLEAN NOT NULL DEFAULT true,
    "screenRecordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "voiceRecordingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "attachmentsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "consoleCaptureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "networkCaptureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "errorCaptureEnabled" BOOLEAN NOT NULL DEFAULT true,
    "performanceCapture" BOOLEAN NOT NULL DEFAULT true,
    "liveChatEnabled" BOOLEAN NOT NULL DEFAULT true,
    "ticketTrackingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "kbDeflectionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "anonymousTicketsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "maxRecordingSeconds" INTEGER NOT NULL DEFAULT 120,
    "maxAttachmentBytes" INTEGER NOT NULL DEFAULT 26214400,
    "maxAttachmentsPerTicket" INTEGER NOT NULL DEFAULT 10,
    "maxConsoleEntries" INTEGER NOT NULL DEFAULT 200,
    "maxNetworkEntries" INTEGER NOT NULL DEFAULT 100,
    "launcherPosition" "WidgetLauncherPosition" NOT NULL DEFAULT 'BOTTOM_RIGHT',
    "launcherLabel" VARCHAR(40) NOT NULL DEFAULT 'Support',
    "welcomeMessage" VARCHAR(500),
    "privacyNotice" VARCHAR(1000),
    "requireConsent" BOOLEAN NOT NULL DEFAULT true,
    "theme" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "widget_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_conversation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID,
    "ticketId" UUID,
    "status" "ChatConversationStatus" NOT NULL DEFAULT 'QUEUED',
    "subject" VARCHAR(300),
    "pageUrl" VARCHAR(2048),
    "lastMessageAt" TIMESTAMPTZ(6),
    "lastMessagePreview" VARCHAR(200),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "firstAgentReplyAt" TIMESTAMPTZ(6),
    "queuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "closedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "chat_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_participant" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "ChatParticipantRole" NOT NULL,
    "joinedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(6),
    "lastReadAt" TIMESTAMPTZ(6),
    "isTyping" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMPTZ(6),

    CONSTRAINT "chat_participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_message" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "conversationId" UUID NOT NULL,
    "senderId" UUID,
    "kind" "ChatMessageKind" NOT NULL DEFAULT 'TEXT',
    "body" TEXT,
    "clientMessageId" VARCHAR(64),
    "editedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_endpoint" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "events" TEXT[],
    "secretEncrypted" TEXT NOT NULL,
    "secretLast4" VARCHAR(4) NOT NULL,
    "headers" JSONB NOT NULL DEFAULT '{}',
    "maxRetries" INTEGER NOT NULL DEFAULT 5,
    "timeoutMs" INTEGER NOT NULL DEFAULT 10000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMPTZ(6),
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lastSuccessAt" TIMESTAMPTZ(6),
    "lastFailureAt" TIMESTAMPTZ(6),
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_endpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_delivery" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "endpointId" UUID NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "eventId" UUID NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "requestBody" TEXT NOT NULL,
    "requestHeaders" JSONB,
    "responseStatus" INTEGER,
    "responseBody" TEXT,
    "responseHeaders" JSONB,
    "error" TEXT,
    "durationMs" INTEGER,
    "nextAttemptAt" TIMESTAMPTZ(6),
    "deliveredAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "webhook_delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL DEFAULT 'USER',
    "actorEmail" VARCHAR(320),
    "actorLabel" VARCHAR(200),
    "action" VARCHAR(80) NOT NULL,
    "resourceType" VARCHAR(60) NOT NULL,
    "resourceId" VARCHAR(120),
    "resourceLabel" VARCHAR(200),
    "changes" JSONB,
    "ipAddress" INET,
    "userAgent" VARCHAR(512),
    "requestId" VARCHAR(120),
    "apiKeyId" UUID,
    "succeeded" BOOLEAN NOT NULL DEFAULT true,
    "failureCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "eventType" VARCHAR(80) NOT NULL,
    "aggregateType" VARCHAR(60) NOT NULL,
    "aggregateId" UUID NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 0,
    "causationId" UUID,
    "correlationId" VARCHAR(120),
    "availableAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "publishedAt" TIMESTAMPTZ(6),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "outbox_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
    "eventType" VARCHAR(80) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" VARCHAR(2000) NOT NULL,
    "linkUrl" VARCHAR(2048),
    "resourceType" VARCHAR(60),
    "resourceId" UUID,
    "sentAt" TIMESTAMPTZ(6),
    "readAt" TIMESTAMPTZ(6),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preference" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "eventType" VARCHAR(80) NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "notification_preference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "type" "DataSubjectRequestType" NOT NULL,
    "status" "DataSubjectRequestStatus" NOT NULL DEFAULT 'PENDING',
    "subjectUserId" UUID NOT NULL,
    "subjectEmail" VARCHAR(320) NOT NULL,
    "requestedById" UUID NOT NULL,
    "reason" VARCHAR(1000),
    "exportStorageKey" VARCHAR(512),
    "exportExpiresAt" TIMESTAMPTZ(6),
    "affectedCounts" JSONB,
    "startedAt" TIMESTAMPTZ(6),
    "completedAt" TIMESTAMPTZ(6),
    "error" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "data_subject_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "scope" "RetentionScope" NOT NULL,
    "retentionDays" INTEGER NOT NULL,
    "anonymizeInsteadOfDelete" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMPTZ(6),
    "lastRunCount" INTEGER,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "retention_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "kind" "UserKind" NOT NULL DEFAULT 'STAFF',
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "email" VARCHAR(320) NOT NULL,
    "emailVerifiedAt" TIMESTAMPTZ(6),
    "passwordHash" VARCHAR(255),
    "passwordUpdatedAt" TIMESTAMPTZ(6),
    "fullName" VARCHAR(200) NOT NULL,
    "displayName" VARCHAR(100),
    "avatarUrl" VARCHAR(2048),
    "phone" VARCHAR(32),
    "jobTitle" VARCHAR(120),
    "timezone" VARCHAR(64),
    "locale" VARCHAR(16),
    "externalId" VARCHAR(200),
    "externalMetadata" JSONB,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "maxConcurrentTickets" INTEGER,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMPTZ(6),
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecretEncrypted" TEXT,
    "lastLoginAt" TIMESTAMPTZ(6),
    "lastSeenAt" TIMESTAMPTZ(6),
    "anonymizedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_identity" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "userId" UUID NOT NULL,
    "provider" "AuthProviderKind" NOT NULL,
    "providerRef" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "email" VARCHAR(320),
    "rawProfile" JSONB,
    "lastLoginAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "user_identity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "userId" UUID NOT NULL,
    "refreshTokenHash" VARCHAR(64) NOT NULL,
    "familyId" UUID NOT NULL,
    "rotatedFromId" UUID,
    "userAgent" VARCHAR(512),
    "ipAddress" INET,
    "device" VARCHAR(120),
    "location" VARCHAR(120),
    "issuedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "revokedReason" VARCHAR(120),

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invitation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID,
    "email" VARCHAR(320) NOT NULL,
    "roleId" UUID NOT NULL,
    "invitedById" UUID NOT NULL,
    "tokenHash" VARCHAR(64) NOT NULL,
    "message" VARCHAR(1000),
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "acceptedAt" TIMESTAMPTZ(6),
    "acceptedUserId" UUID,
    "revokedAt" TIMESTAMPTZ(6),
    "remindedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_key" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "prefix" VARCHAR(32) NOT NULL,
    "keyHash" VARCHAR(255) NOT NULL,
    "scopes" TEXT[],
    "createdById" UUID NOT NULL,
    "lastUsedAt" TIMESTAMPTZ(6),
    "lastUsedIp" INET,
    "useCount" BIGINT NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(6),
    "revokedAt" TIMESTAMPTZ(6),
    "revokedById" UUID,
    "rotatedFromId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sso_provider" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "protocol" "SsoProtocol" NOT NULL,
    "displayName" VARCHAR(120) NOT NULL,
    "issuer" VARCHAR(512) NOT NULL,
    "clientId" VARCHAR(255),
    "clientSecretEncrypted" TEXT,
    "authorizationEndpoint" VARCHAR(512),
    "tokenEndpoint" VARCHAR(512),
    "userinfoEndpoint" VARCHAR(512),
    "jwksUri" VARCHAR(512),
    "endSessionEndpoint" VARCHAR(512),
    "samlMetadataXml" TEXT,
    "samlCertificate" TEXT,
    "scopes" TEXT[] DEFAULT ARRAY['openid', 'profile', 'email']::TEXT[],
    "claimMappings" JSONB NOT NULL DEFAULT '{}',
    "roleMappings" JSONB NOT NULL DEFAULT '{}',
    "emailDomains" TEXT[],
    "jitProvisioning" BOOLEAN NOT NULL DEFAULT true,
    "defaultRoleId" UUID,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "lastTestedAt" TIMESTAMPTZ(6),
    "lastTestSucceeded" BOOLEAN,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sso_provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" VARCHAR(500),
    "tier" "SupportTier",
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "teamId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "queue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" VARCHAR(500),
    "tier" "SupportTier" NOT NULL DEFAULT 'L1',
    "teamId" UUID,
    "routing" "QueueRoutingStrategy" NOT NULL DEFAULT 'LEAST_LOADED',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" "RoleKey" NOT NULL,
    "scope" "RoleScope" NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "rank" INTEGER NOT NULL,
    "tier" "SupportTier",
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "isStaff" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "module" VARCHAR(40) NOT NULL,
    "action" VARCHAR(40) NOT NULL,
    "scope" VARCHAR(20),
    "description" VARCHAR(500) NOT NULL,
    "tenantConfigurable" BOOLEAN NOT NULL DEFAULT false,
    "category" VARCHAR(40) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permission" (
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "configurable" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "tenant_role_permission_override" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "permissionId" UUID NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "reason" VARCHAR(500),
    "updatedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tenant_role_permission_override_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_role" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "brandId" UUID,
    "assignedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sequence" (
    "tenantId" UUID NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ticket_sequence_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "ticket" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "number" VARCHAR(32) NOT NULL,
    "sequence" INTEGER NOT NULL,
    "subject" VARCHAR(300) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'NEW',
    "tier" "SupportTier" NOT NULL DEFAULT 'L1',
    "priority" "TicketPriority" NOT NULL DEFAULT 'NORMAL',
    "type" "TicketType" NOT NULL DEFAULT 'INCIDENT',
    "channel" "TicketChannel" NOT NULL DEFAULT 'WIDGET',
    "category" VARCHAR(120),
    "subcategory" VARCHAR(120),
    "requesterId" UUID NOT NULL,
    "assigneeId" UUID,
    "queueId" UUID,
    "teamId" UUID,
    "escalationCount" INTEGER NOT NULL DEFAULT 0,
    "reopenCount" INTEGER NOT NULL DEFAULT 0,
    "publicCommentCount" INTEGER NOT NULL DEFAULT 0,
    "internalNoteCount" INTEGER NOT NULL DEFAULT 0,
    "attachmentCount" INTEGER NOT NULL DEFAULT 0,
    "firstResponseAt" TIMESTAMPTZ(6),
    "lastCustomerReplyAt" TIMESTAMPTZ(6),
    "lastAgentReplyAt" TIMESTAMPTZ(6),
    "lastActivityAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMPTZ(6),
    "closedAt" TIMESTAMPTZ(6),
    "reopenedAt" TIMESTAMPTZ(6),
    "confirmationRequestedAt" TIMESTAMPTZ(6),
    "confirmedAt" TIMESTAMPTZ(6),
    "dueAt" TIMESTAMPTZ(6),
    "isSpam" BOOLEAN NOT NULL DEFAULT false,
    "customFields" JSONB NOT NULL DEFAULT '{}',
    "searchVector" tsvector,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_comment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "authorId" UUID,
    "visibility" "CommentVisibility" NOT NULL DEFAULT 'PUBLIC',
    "body" TEXT NOT NULL,
    "bodyFormat" "CommentFormat" NOT NULL DEFAULT 'MARKDOWN',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "systemLabel" VARCHAR(120),
    "editedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "ticket_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "type" "TicketEventType" NOT NULL,
    "actorId" UUID,
    "actorType" "ActorType" NOT NULL DEFAULT 'USER',
    "actorLabel" VARCHAR(160),
    "fromValue" VARCHAR(120),
    "toValue" VARCHAR(120),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_watcher" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "isImplicit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_watcher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "color" VARCHAR(9) NOT NULL DEFAULT '#64748B',
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_tag" (
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "tagId" UUID NOT NULL,
    "addedById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_tag_pkey" PRIMARY KEY ("ticketId","tagId")
);

-- CreateTable
CREATE TABLE "ticket_link" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "sourceId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "type" "TicketLinkType" NOT NULL,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "csat_response" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" VARCHAR(2000),
    "agentId" UUID,
    "tier" "SupportTier",
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "csat_response_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID,
    "commentId" UUID,
    "chatMessageId" UUID,
    "uploadedById" UUID,
    "kind" "MediaKind" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "storageKey" VARCHAR(512) NOT NULL,
    "bucket" VARCHAR(120) NOT NULL,
    "originalFilename" VARCHAR(255),
    "mimeType" VARCHAR(160) NOT NULL,
    "declaredMimeType" VARCHAR(160),
    "sizeBytes" BIGINT NOT NULL,
    "checksumSha256" VARCHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "durationMs" INTEGER,
    "thumbnailKey" VARCHAR(512),
    "annotations" JSONB,
    "hasRedactions" BOOLEAN NOT NULL DEFAULT false,
    "scanStatus" "MediaScanStatus" NOT NULL DEFAULT 'PENDING',
    "uploadExpiresAt" TIMESTAMPTZ(6),
    "uploadedAt" TIMESTAMPTZ(6),
    "retainUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "deletedAt" TIMESTAMPTZ(6),

    CONSTRAINT "media_asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnostic_bundle" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "capturedAt" TIMESTAMPTZ(6) NOT NULL,
    "pageUrl" VARCHAR(2048) NOT NULL,
    "pageTitle" VARCHAR(500),
    "referrerUrl" VARCHAR(2048),
    "hostSessionId" VARCHAR(200),
    "hostUserId" VARCHAR(200),
    "hostAccountId" VARCHAR(200),
    "userAgent" TEXT NOT NULL,
    "browserName" VARCHAR(80),
    "browserVersion" VARCHAR(40),
    "engineName" VARCHAR(80),
    "osName" VARCHAR(80),
    "osVersion" VARCHAR(40),
    "deviceType" VARCHAR(40),
    "deviceModel" VARCHAR(120),
    "viewportWidth" INTEGER,
    "viewportHeight" INTEGER,
    "screenWidth" INTEGER,
    "screenHeight" INTEGER,
    "devicePixelRatio" DOUBLE PRECISION,
    "colorScheme" VARCHAR(20),
    "timezone" VARCHAR(64),
    "locale" VARCHAR(16),
    "connectionType" VARCHAR(20),
    "deviceMemoryGb" DOUBLE PRECISION,
    "hardwareConcurrency" INTEGER,
    "consoleEntries" JSONB NOT NULL DEFAULT '[]',
    "consoleErrorCount" INTEGER NOT NULL DEFAULT 0,
    "consoleWarnCount" INTEGER NOT NULL DEFAULT 0,
    "networkEntries" JSONB NOT NULL DEFAULT '[]',
    "networkFailureCount" INTEGER NOT NULL DEFAULT 0,
    "jsErrors" JSONB NOT NULL DEFAULT '[]',
    "jsErrorCount" INTEGER NOT NULL DEFAULT 0,
    "performanceMetrics" JSONB NOT NULL DEFAULT '{}',
    "featureFlags" JSONB,
    "customContext" JSONB,
    "payloadBytes" INTEGER NOT NULL DEFAULT 0,
    "redactionsApplied" TEXT[],
    "retainUntil" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "diagnostic_bundle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workflow_transition" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "requiredPermission" VARCHAR(80) NOT NULL,
    "requiredTier" "SupportTier",
    "targetTier" "SupportTier",
    "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
    "approverRoleKey" "RoleKey",
    "approvalMode" "ApprovalMode" NOT NULL DEFAULT 'ANY',
    "label" VARCHAR(80) NOT NULL,
    "requiresComment" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "workflow_transition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "escalation_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "fromTier" "SupportTier" NOT NULL,
    "toTier" "SupportTier" NOT NULL,
    "afterMinutes" INTEGER NOT NULL,
    "onSlaBreach" BOOLEAN NOT NULL DEFAULT true,
    "targetQueueId" UUID,
    "targetTeamId" UUID,
    "bumpPriority" INTEGER NOT NULL DEFAULT 0,
    "notifyRoleKeys" "RoleKey"[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "escalation_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_request" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "fromStatus" "TicketStatus" NOT NULL,
    "toStatus" "TicketStatus" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "mode" "ApprovalMode" NOT NULL DEFAULT 'ANY',
    "approverRoleKey" "RoleKey",
    "approverUserIds" UUID[],
    "requestedById" UUID NOT NULL,
    "reason" VARCHAR(1000),
    "requiredCount" INTEGER NOT NULL DEFAULT 1,
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMPTZ(6),
    "remindedAt" TIMESTAMPTZ(6),
    "resolvedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "approval_request_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_decision" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "requestId" UUID NOT NULL,
    "approverId" UUID NOT NULL,
    "decision" "ApprovalDecisionType" NOT NULL,
    "comment" VARCHAR(1000),
    "sequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_decision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policy" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "businessHoursId" UUID,
    "warningThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.75,
    "escalateOnBreach" BOOLEAN NOT NULL DEFAULT true,
    "notifyRoleKeys" "RoleKey"[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sla_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_target" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "type" "SlaTargetType" NOT NULL,
    "minutes" INTEGER NOT NULL,
    "priorityOverrides" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sla_target_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "brandId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "isAlwaysOpen" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours_day" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "businessHoursId" UUID NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startMinute" INTEGER NOT NULL,
    "endMinute" INTEGER NOT NULL,

    CONSTRAINT "business_hours_day_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "businessHoursId" UUID,
    "name" VARCHAR(120) NOT NULL,
    "date" DATE NOT NULL,
    "recursAnnually" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_sla_state" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "targetId" UUID NOT NULL,
    "type" "SlaTargetType" NOT NULL,
    "status" "SlaClockStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(6) NOT NULL,
    "dueAt" TIMESTAMPTZ(6) NOT NULL,
    "warnAt" TIMESTAMPTZ(6),
    "elapsedMs" BIGINT NOT NULL DEFAULT 0,
    "pausedAt" TIMESTAMPTZ(6),
    "pausedMs" BIGINT NOT NULL DEFAULT 0,
    "pauseCount" INTEGER NOT NULL DEFAULT 0,
    "warnedAt" TIMESTAMPTZ(6),
    "breachedAt" TIMESTAMPTZ(6),
    "metAt" TIMESTAMPTZ(6),
    "breachMs" BIGINT,
    "warnJobId" VARCHAR(120),
    "breachJobId" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ticket_sla_state_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_event" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "stateId" UUID,
    "type" "SlaEventType" NOT NULL,
    "targetType" "SlaTargetType" NOT NULL,
    "dueAt" TIMESTAMPTZ(6),
    "reason" VARCHAR(300),
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rule" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(500),
    "trigger" "AutomationTrigger" NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '[]',
    "schedule" VARCHAR(120),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "stopOnMatch" BOOLEAN NOT NULL DEFAULT false,
    "maxRunsPerTicket" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMPTZ(6),
    "runCount" BIGINT NOT NULL DEFAULT 0,
    "matchCount" BIGINT NOT NULL DEFAULT 0,
    "createdById" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_run" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenantId" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "ticketId" UUID,
    "status" "AutomationRunStatus" NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "conditionTrace" JSONB,
    "actionResults" JSONB,
    "error" TEXT,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "causationId" UUID,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_run_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_slug_key" ON "tenant"("slug");

-- CreateIndex
CREATE INDEX "tenant_status_idx" ON "tenant"("status");

-- CreateIndex
CREATE INDEX "tenant_deletedAt_idx" ON "tenant"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_setting_tenantId_key" ON "tenant_setting"("tenantId");

-- CreateIndex
CREATE INDEX "brand_tenantId_isActive_idx" ON "brand"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "brand_portalDomain_idx" ON "brand"("portalDomain");

-- CreateIndex
CREATE UNIQUE INDEX "brand_tenantId_slug_key" ON "brand"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "widget_config_brandId_key" ON "widget_config"("brandId");

-- CreateIndex
CREATE UNIQUE INDEX "widget_config_publicKey_key" ON "widget_config"("publicKey");

-- CreateIndex
CREATE INDEX "widget_config_tenantId_idx" ON "widget_config"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_conversation_ticketId_key" ON "chat_conversation"("ticketId");

-- CreateIndex
CREATE INDEX "chat_conversation_tenantId_status_lastMessageAt_idx" ON "chat_conversation"("tenantId", "status", "lastMessageAt");

-- CreateIndex
CREATE INDEX "chat_conversation_tenantId_brandId_idx" ON "chat_conversation"("tenantId", "brandId");

-- CreateIndex
CREATE INDEX "chat_participant_tenantId_userId_idx" ON "chat_participant"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "chat_participant_conversationId_userId_key" ON "chat_participant"("conversationId", "userId");

-- CreateIndex
CREATE INDEX "chat_message_tenantId_conversationId_createdAt_idx" ON "chat_message"("tenantId", "conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "chat_message_conversationId_clientMessageId_key" ON "chat_message"("conversationId", "clientMessageId");

-- CreateIndex
CREATE INDEX "webhook_endpoint_tenantId_isActive_idx" ON "webhook_endpoint"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "webhook_delivery_tenantId_endpointId_createdAt_idx" ON "webhook_delivery"("tenantId", "endpointId", "createdAt");

-- CreateIndex
CREATE INDEX "webhook_delivery_status_nextAttemptAt_idx" ON "webhook_delivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "webhook_delivery_eventId_idx" ON "webhook_delivery"("eventId");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_createdAt_idx" ON "audit_log"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_actorId_createdAt_idx" ON "audit_log"("tenantId", "actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_resourceType_resourceId_idx" ON "audit_log"("tenantId", "resourceType", "resourceId");

-- CreateIndex
CREATE INDEX "audit_log_tenantId_action_createdAt_idx" ON "audit_log"("tenantId", "action", "createdAt");

-- CreateIndex
CREATE INDEX "audit_log_succeeded_createdAt_idx" ON "audit_log"("succeeded", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_event_status_availableAt_idx" ON "outbox_event"("status", "availableAt");

-- CreateIndex
CREATE INDEX "outbox_event_tenantId_aggregateType_aggregateId_idx" ON "outbox_event"("tenantId", "aggregateType", "aggregateId");

-- CreateIndex
CREATE INDEX "outbox_event_causationId_idx" ON "outbox_event"("causationId");

-- CreateIndex
CREATE INDEX "notification_tenantId_userId_readAt_idx" ON "notification"("tenantId", "userId", "readAt");

-- CreateIndex
CREATE INDEX "notification_tenantId_userId_createdAt_idx" ON "notification"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "notification_status_createdAt_idx" ON "notification"("status", "createdAt");

-- CreateIndex
CREATE INDEX "notification_preference_tenantId_idx" ON "notification_preference"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preference_userId_eventType_key" ON "notification_preference"("userId", "eventType");

-- CreateIndex
CREATE INDEX "data_subject_request_tenantId_status_idx" ON "data_subject_request"("tenantId", "status");

-- CreateIndex
CREATE INDEX "data_subject_request_tenantId_subjectUserId_idx" ON "data_subject_request"("tenantId", "subjectUserId");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policy_tenantId_scope_key" ON "retention_policy"("tenantId", "scope");

-- CreateIndex
CREATE INDEX "user_tenantId_status_idx" ON "user"("tenantId", "status");

-- CreateIndex
CREATE INDEX "user_tenantId_kind_idx" ON "user"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "user_tenantId_isAvailable_idx" ON "user"("tenantId", "isAvailable");

-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_externalId_idx" ON "user"("externalId");

-- CreateIndex
CREATE INDEX "user_deletedAt_idx" ON "user"("deletedAt");

-- CreateIndex
CREATE INDEX "user_identity_userId_idx" ON "user_identity"("userId");

-- CreateIndex
CREATE INDEX "user_identity_tenantId_idx" ON "user_identity"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "user_identity_providerRef_subject_key" ON "user_identity"("providerRef", "subject");

-- CreateIndex
CREATE UNIQUE INDEX "session_refreshTokenHash_key" ON "session"("refreshTokenHash");

-- CreateIndex
CREATE INDEX "session_userId_revokedAt_idx" ON "session"("userId", "revokedAt");

-- CreateIndex
CREATE INDEX "session_familyId_idx" ON "session"("familyId");

-- CreateIndex
CREATE INDEX "session_expiresAt_idx" ON "session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "invitation_tokenHash_key" ON "invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "invitation_tenantId_email_idx" ON "invitation"("tenantId", "email");

-- CreateIndex
CREATE INDEX "invitation_expiresAt_idx" ON "invitation"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "api_key_prefix_key" ON "api_key"("prefix");

-- CreateIndex
CREATE INDEX "api_key_tenantId_revokedAt_idx" ON "api_key"("tenantId", "revokedAt");

-- CreateIndex
CREATE INDEX "sso_provider_tenantId_enabled_idx" ON "sso_provider"("tenantId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "sso_provider_tenantId_protocol_issuer_key" ON "sso_provider"("tenantId", "protocol", "issuer");

-- CreateIndex
CREATE INDEX "team_tenantId_tier_idx" ON "team"("tenantId", "tier");

-- CreateIndex
CREATE UNIQUE INDEX "team_tenantId_slug_key" ON "team"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "team_member_tenantId_userId_idx" ON "team_member"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "team_member_teamId_userId_key" ON "team_member"("teamId", "userId");

-- CreateIndex
CREATE INDEX "queue_tenantId_tier_isActive_idx" ON "queue"("tenantId", "tier", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "queue_tenantId_slug_key" ON "queue"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE INDEX "role_scope_idx" ON "role"("scope");

-- CreateIndex
CREATE UNIQUE INDEX "permission_key_key" ON "permission"("key");

-- CreateIndex
CREATE INDEX "permission_module_idx" ON "permission"("module");

-- CreateIndex
CREATE INDEX "permission_tenantConfigurable_idx" ON "permission"("tenantConfigurable");

-- CreateIndex
CREATE INDEX "role_permission_permissionId_idx" ON "role_permission"("permissionId");

-- CreateIndex
CREATE INDEX "tenant_role_permission_override_tenantId_idx" ON "tenant_role_permission_override"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_role_permission_override_tenantId_roleId_permissionI_key" ON "tenant_role_permission_override"("tenantId", "roleId", "permissionId");

-- CreateIndex
CREATE INDEX "user_role_userId_idx" ON "user_role"("userId");

-- CreateIndex
CREATE INDEX "user_role_tenantId_roleId_idx" ON "user_role"("tenantId", "roleId");

-- CreateIndex
CREATE INDEX "user_role_roleId_idx" ON "user_role"("roleId");

-- CreateIndex
CREATE INDEX "ticket_searchVector_idx" ON "ticket" USING GIN ("searchVector");

-- CreateIndex
CREATE INDEX "ticket_tenantId_status_priority_idx" ON "ticket"("tenantId", "status", "priority");

-- CreateIndex
CREATE INDEX "ticket_tenantId_assigneeId_status_idx" ON "ticket"("tenantId", "assigneeId", "status");

-- CreateIndex
CREATE INDEX "ticket_tenantId_requesterId_createdAt_idx" ON "ticket"("tenantId", "requesterId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_tenantId_tier_status_idx" ON "ticket"("tenantId", "tier", "status");

-- CreateIndex
CREATE INDEX "ticket_tenantId_queueId_status_idx" ON "ticket"("tenantId", "queueId", "status");

-- CreateIndex
CREATE INDEX "ticket_tenantId_brandId_createdAt_idx" ON "ticket"("tenantId", "brandId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_tenantId_status_lastActivityAt_idx" ON "ticket"("tenantId", "status", "lastActivityAt");

-- CreateIndex
CREATE INDEX "ticket_tenantId_category_idx" ON "ticket"("tenantId", "category");

-- CreateIndex
CREATE INDEX "ticket_deletedAt_idx" ON "ticket"("deletedAt");

-- CreateIndex
CREATE INDEX "ticket_subject_idx" ON "ticket" USING GIN ("subject" gin_trgm_ops);

-- CreateIndex
CREATE UNIQUE INDEX "ticket_tenantId_number_key" ON "ticket"("tenantId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_tenantId_sequence_key" ON "ticket"("tenantId", "sequence");

-- CreateIndex
CREATE INDEX "ticket_comment_tenantId_ticketId_createdAt_idx" ON "ticket_comment"("tenantId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_comment_tenantId_ticketId_visibility_idx" ON "ticket_comment"("tenantId", "ticketId", "visibility");

-- CreateIndex
CREATE INDEX "ticket_comment_authorId_idx" ON "ticket_comment"("authorId");

-- CreateIndex
CREATE INDEX "ticket_event_tenantId_ticketId_createdAt_idx" ON "ticket_event"("tenantId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_event_tenantId_type_createdAt_idx" ON "ticket_event"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_watcher_tenantId_userId_idx" ON "ticket_watcher"("tenantId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_watcher_ticketId_userId_key" ON "ticket_watcher"("ticketId", "userId");

-- CreateIndex
CREATE INDEX "tag_tenantId_usageCount_idx" ON "tag"("tenantId", "usageCount");

-- CreateIndex
CREATE UNIQUE INDEX "tag_tenantId_slug_key" ON "tag"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "ticket_tag_tenantId_tagId_idx" ON "ticket_tag"("tenantId", "tagId");

-- CreateIndex
CREATE INDEX "ticket_link_tenantId_targetId_idx" ON "ticket_link"("tenantId", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_link_sourceId_targetId_type_key" ON "ticket_link"("sourceId", "targetId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "csat_response_ticketId_key" ON "csat_response"("ticketId");

-- CreateIndex
CREATE INDEX "csat_response_tenantId_rating_idx" ON "csat_response"("tenantId", "rating");

-- CreateIndex
CREATE INDEX "csat_response_tenantId_agentId_idx" ON "csat_response"("tenantId", "agentId");

-- CreateIndex
CREATE INDEX "csat_response_tenantId_createdAt_idx" ON "csat_response"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "media_asset_storageKey_key" ON "media_asset"("storageKey");

-- CreateIndex
CREATE INDEX "media_asset_tenantId_ticketId_idx" ON "media_asset"("tenantId", "ticketId");

-- CreateIndex
CREATE INDEX "media_asset_tenantId_status_idx" ON "media_asset"("tenantId", "status");

-- CreateIndex
CREATE INDEX "media_asset_tenantId_kind_idx" ON "media_asset"("tenantId", "kind");

-- CreateIndex
CREATE INDEX "media_asset_retainUntil_idx" ON "media_asset"("retainUntil");

-- CreateIndex
CREATE INDEX "media_asset_uploadExpiresAt_idx" ON "media_asset"("uploadExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "diagnostic_bundle_ticketId_key" ON "diagnostic_bundle"("ticketId");

-- CreateIndex
CREATE INDEX "diagnostic_bundle_tenantId_capturedAt_idx" ON "diagnostic_bundle"("tenantId", "capturedAt");

-- CreateIndex
CREATE INDEX "diagnostic_bundle_retainUntil_idx" ON "diagnostic_bundle"("retainUntil");

-- CreateIndex
CREATE INDEX "workflow_transition_tenantId_fromStatus_enabled_idx" ON "workflow_transition"("tenantId", "fromStatus", "enabled");

-- CreateIndex
CREATE INDEX "escalation_policy_tenantId_isActive_fromTier_idx" ON "escalation_policy"("tenantId", "isActive", "fromTier");

-- CreateIndex
CREATE INDEX "approval_request_tenantId_status_idx" ON "approval_request"("tenantId", "status");

-- CreateIndex
CREATE INDEX "approval_request_tenantId_ticketId_idx" ON "approval_request"("tenantId", "ticketId");

-- CreateIndex
CREATE INDEX "approval_request_expiresAt_idx" ON "approval_request"("expiresAt");

-- CreateIndex
CREATE INDEX "approval_decision_tenantId_approverId_idx" ON "approval_decision"("tenantId", "approverId");

-- CreateIndex
CREATE UNIQUE INDEX "approval_decision_requestId_approverId_key" ON "approval_decision"("requestId", "approverId");

-- CreateIndex
CREATE INDEX "sla_policy_tenantId_isActive_priority_idx" ON "sla_policy"("tenantId", "isActive", "priority");

-- CreateIndex
CREATE INDEX "sla_target_tenantId_idx" ON "sla_target"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "sla_target_policyId_type_key" ON "sla_target"("policyId", "type");

-- CreateIndex
CREATE INDEX "business_hours_tenantId_isDefault_idx" ON "business_hours"("tenantId", "isDefault");

-- CreateIndex
CREATE INDEX "business_hours_day_tenantId_idx" ON "business_hours_day"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_day_businessHoursId_weekday_startMinute_key" ON "business_hours_day"("businessHoursId", "weekday", "startMinute");

-- CreateIndex
CREATE INDEX "holiday_tenantId_date_idx" ON "holiday"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_businessHoursId_date_key" ON "holiday"("businessHoursId", "date");

-- CreateIndex
CREATE INDEX "ticket_sla_state_tenantId_status_dueAt_idx" ON "ticket_sla_state"("tenantId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "ticket_sla_state_tenantId_ticketId_idx" ON "ticket_sla_state"("tenantId", "ticketId");

-- CreateIndex
CREATE INDEX "ticket_sla_state_status_warnAt_idx" ON "ticket_sla_state"("status", "warnAt");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_sla_state_ticketId_type_key" ON "ticket_sla_state"("ticketId", "type");

-- CreateIndex
CREATE INDEX "sla_event_tenantId_ticketId_createdAt_idx" ON "sla_event"("tenantId", "ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "sla_event_tenantId_type_createdAt_idx" ON "sla_event"("tenantId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "automation_rule_tenantId_trigger_isActive_priority_idx" ON "automation_rule"("tenantId", "trigger", "isActive", "priority");

-- CreateIndex
CREATE INDEX "automation_run_tenantId_ruleId_createdAt_idx" ON "automation_run"("tenantId", "ruleId", "createdAt");

-- CreateIndex
CREATE INDEX "automation_run_tenantId_ticketId_idx" ON "automation_run"("tenantId", "ticketId");

-- CreateIndex
CREATE INDEX "automation_run_causationId_idx" ON "automation_run"("causationId");

-- AddForeignKey
ALTER TABLE "tenant_setting" ADD CONSTRAINT "tenant_setting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand" ADD CONSTRAINT "brand_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "widget_config" ADD CONSTRAINT "widget_config_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_conversation" ADD CONSTRAINT "chat_conversation_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_participant" ADD CONSTRAINT "chat_participant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "chat_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_message" ADD CONSTRAINT "chat_message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_endpoint" ADD CONSTRAINT "webhook_endpoint_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webhook_delivery" ADD CONSTRAINT "webhook_delivery_endpointId_fkey" FOREIGN KEY ("endpointId") REFERENCES "webhook_endpoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbox_event" ADD CONSTRAINT "outbox_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_request" ADD CONSTRAINT "data_subject_request_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_policy" ADD CONSTRAINT "retention_policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identity" ADD CONSTRAINT "user_identity_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_identity" ADD CONSTRAINT "user_identity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_key" ADD CONSTRAINT "api_key_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sso_provider" ADD CONSTRAINT "sso_provider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team" ADD CONSTRAINT "team_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue" ADD CONSTRAINT "queue_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue" ADD CONSTRAINT "queue_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "queue" ADD CONSTRAINT "queue_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_role_permission_override" ADD CONSTRAINT "tenant_role_permission_override_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_role_permission_override" ADD CONSTRAINT "tenant_role_permission_override_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_role_permission_override" ADD CONSTRAINT "tenant_role_permission_override_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sequence" ADD CONSTRAINT "ticket_sequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "queue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comment" ADD CONSTRAINT "ticket_comment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comment" ADD CONSTRAINT "ticket_comment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_comment" ADD CONSTRAINT "ticket_comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_event" ADD CONSTRAINT "ticket_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_event" ADD CONSTRAINT "ticket_event_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_watcher" ADD CONSTRAINT "ticket_watcher_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_watcher" ADD CONSTRAINT "ticket_watcher_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_watcher" ADD CONSTRAINT "ticket_watcher_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tag" ADD CONSTRAINT "tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tag" ADD CONSTRAINT "ticket_tag_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tag" ADD CONSTRAINT "ticket_tag_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_tag" ADD CONSTRAINT "ticket_tag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_link" ADD CONSTRAINT "ticket_link_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_link" ADD CONSTRAINT "ticket_link_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_link" ADD CONSTRAINT "ticket_link_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_response" ADD CONSTRAINT "csat_response_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_response" ADD CONSTRAINT "csat_response_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "csat_response" ADD CONSTRAINT "csat_response_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "ticket_comment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_chatMessageId_fkey" FOREIGN KEY ("chatMessageId") REFERENCES "chat_message"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_asset" ADD CONSTRAINT "media_asset_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_bundle" ADD CONSTRAINT "diagnostic_bundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnostic_bundle" ADD CONSTRAINT "diagnostic_bundle_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transition" ADD CONSTRAINT "workflow_transition_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "escalation_policy" ADD CONSTRAINT "escalation_policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_request" ADD CONSTRAINT "approval_request_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "approval_request"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_decision" ADD CONSTRAINT "approval_decision_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy" ADD CONSTRAINT "sla_policy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy" ADD CONSTRAINT "sla_policy_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policy" ADD CONSTRAINT "sla_policy_businessHoursId_fkey" FOREIGN KEY ("businessHoursId") REFERENCES "business_hours"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_target" ADD CONSTRAINT "sla_target_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_target" ADD CONSTRAINT "sla_target_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "sla_policy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours" ADD CONSTRAINT "business_hours_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brand"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_hours_day" ADD CONSTRAINT "business_hours_day_businessHoursId_fkey" FOREIGN KEY ("businessHoursId") REFERENCES "business_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday" ADD CONSTRAINT "holiday_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday" ADD CONSTRAINT "holiday_businessHoursId_fkey" FOREIGN KEY ("businessHoursId") REFERENCES "business_hours"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_state" ADD CONSTRAINT "ticket_sla_state_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_state" ADD CONSTRAINT "ticket_sla_state_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_state" ADD CONSTRAINT "ticket_sla_state_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "sla_policy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_sla_state" ADD CONSTRAINT "ticket_sla_state_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "sla_target"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_event" ADD CONSTRAINT "sla_event_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_event" ADD CONSTRAINT "sla_event_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule" ADD CONSTRAINT "automation_rule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "automation_rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_run" ADD CONSTRAINT "automation_run_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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

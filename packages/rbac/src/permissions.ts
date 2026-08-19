/**
 * The permission catalogue: every capability the platform can grant.
 *
 * This file is the single source of truth. The database is seeded from it, the API
 * guards resolve against it, and the console renders its admin toggles from it.
 * Nothing else may invent a permission string.
 *
 * Key format: `module:action[:scope]`
 *   `ticket:read:own`     - only rows the caller reported
 *   `ticket:read:tenant`  - every row in the caller's tenant
 *
 * The `:own` / `:tenant` split is what separates "View Own Tickets" from "View All
 * Tenant Tickets" in the requirements matrix, and it is enforced as a query filter
 * rather than only as an endpoint guard - a guard alone would still let a caller
 * fetch someone else's ticket by id.
 */

export type PermissionCategory =
  | 'Tickets'
  | 'Capture & Diagnostics'
  | 'Live Chat'
  | 'Knowledge Base'
  | 'Approvals'
  | 'Reporting'
  | 'Audit'
  | 'Administration'
  | 'Integrations'
  | 'Platform';

export interface PermissionDefinition {
  key: string;
  module: string;
  action: string;
  scope?: 'own' | 'tenant' | 'all';
  description: string;
  category: PermissionCategory;
}

/**
 * Helper so each entry reads as one line and the module/action columns cannot
 * drift out of sync with the key.
 */
function define(
  key: string,
  category: PermissionCategory,
  description: string,
): PermissionDefinition {
  const [module, action, scope] = key.split(':') as [string, string, string | undefined];
  return {
    key,
    module,
    action,
    ...(scope ? { scope: scope as 'own' | 'tenant' | 'all' } : {}),
    description,
    category,
  };
}

export const PERMISSIONS: readonly PermissionDefinition[] = [
  // ---- Tickets ------------------------------------------------------------
  define('ticket:create', 'Tickets', 'Raise a new support ticket.'),
  define('ticket:read:own', 'Tickets', 'View tickets the user reported.'),
  define('ticket:read:tenant', 'Tickets', 'View every ticket in the tenant.'),
  define('ticket:update:own', 'Tickets', 'Edit a ticket the user reported.'),
  define('ticket:update:tenant', 'Tickets', 'Edit any ticket in the tenant.'),
  define('ticket:delete', 'Tickets', 'Soft-delete a ticket.'),
  define('ticket:note:internal', 'Tickets', 'Read and write staff-only internal notes.'),
  define('ticket:assign:agent', 'Tickets', 'Assign a ticket to a specific agent.'),
  define('ticket:assign:queue', 'Tickets', 'Route a ticket to a queue or team.'),
  define('ticket:escalate', 'Tickets', 'Move a ticket up the support tiers.'),
  define('ticket:close', 'Tickets', 'Close a ticket.'),
  define('ticket:reopen', 'Tickets', 'Reopen a resolved or closed ticket.'),
  define('ticket:bulk_update', 'Tickets', 'Apply a change to many tickets at once.'),
  define(
    'ticket:confirm_resolution',
    'Tickets',
    'Confirm or reject a proposed resolution as the reporter.',
  ),
  define('ticket:merge', 'Tickets', 'Merge duplicate tickets.'),
  define('ticket:link', 'Tickets', 'Relate tickets to one another.'),
  define('ticket:tag', 'Tickets', 'Add and remove tags.'),
  define('ticket:watch', 'Tickets', 'Follow a ticket for notifications.'),
  define('ticket:spam', 'Tickets', 'Mark a ticket as spam.'),
  define('ticket:transition:development', 'Tickets', 'Hand a ticket to the development team.'),
  define('ticket:transition:qa', 'Tickets', 'Move a ticket into QA verification.'),
  define('ticket:transition:release', 'Tickets', 'Promote a fix to release.'),

  // ---- Capture & diagnostics ---------------------------------------------
  define('capture:screenshot', 'Capture & Diagnostics', 'Capture a screenshot.'),
  define('capture:annotate', 'Capture & Diagnostics', 'Annotate and redact a screenshot.'),
  define('capture:screen_recording', 'Capture & Diagnostics', 'Record the screen.'),
  define('capture:voice_recording', 'Capture & Diagnostics', 'Record a voice note.'),
  define('capture:attachment', 'Capture & Diagnostics', 'Upload file attachments.'),
  define(
    'capture:diagnostics',
    'Capture & Diagnostics',
    'Submit automatically captured browser, device and console diagnostics.',
  ),
  define(
    'capture:diagnostics:read',
    'Capture & Diagnostics',
    'Inspect a diagnostics bundle, including console and network traces.',
  ),

  // ---- Live chat ----------------------------------------------------------
  define('chat:start', 'Live Chat', 'Start a live chat conversation.'),
  define('chat:participate', 'Live Chat', 'Take part in a conversation.'),
  define('chat:respond', 'Live Chat', 'Answer customer chats as support staff.'),

  // ---- Knowledge base ----------------------------------------------------
  define('kb:read', 'Knowledge Base', 'Read published articles.'),
  define('kb:read:internal', 'Knowledge Base', 'Read staff-only articles and runbooks.'),
  define('kb:write', 'Knowledge Base', 'Create and edit articles.'),
  define('kb:publish', 'Knowledge Base', 'Publish or archive articles.'),

  // ---- Approvals ---------------------------------------------------------
  define('approval:request', 'Approvals', 'Request sign-off for a gated transition.'),
  define('approval:decide', 'Approvals', 'Approve or reject a pending request.'),

  // ---- Reporting ---------------------------------------------------------
  define('report:view:own', 'Reporting', 'View personal performance metrics.'),
  define('report:view:tenant', 'Reporting', 'View tenant-wide dashboards and analytics.'),
  define('report:export', 'Reporting', 'Export report data.'),

  // ---- Audit -------------------------------------------------------------
  define('audit:read', 'Audit', 'Read the tenant audit log.'),

  // ---- Administration (the requirements' Tenant Administration list) -----
  define('admin:user:read', 'Administration', 'List users in the tenant.'),
  define('admin:user:manage', 'Administration', 'Create, update, suspend and remove users.'),
  define('admin:user:invite', 'Administration', 'Invite users.'),
  define(
    'admin:role:configure',
    'Administration',
    'Adjust configurable role permissions for the tenant.',
  ),
  define('admin:team:manage', 'Administration', 'Manage support teams.'),
  define('admin:queue:manage', 'Administration', 'Manage routing queues.'),
  define('admin:brand:manage', 'Administration', 'Manage brands and branding.'),
  define('admin:widget:configure', 'Administration', 'Configure the embeddable widget.'),
  define('admin:sso:manage', 'Administration', 'Configure single sign-on.'),
  define('admin:sla:manage', 'Administration', 'Manage SLA policies and business hours.'),
  define('admin:automation:manage', 'Administration', 'Manage automation rules.'),
  define('admin:apikey:manage', 'Administration', 'Issue, rotate and revoke API keys.'),
  define('admin:webhook:manage', 'Administration', 'Manage webhook endpoints.'),
  define('admin:workflow:manage', 'Administration', 'Customize the ticket workflow.'),
  define('admin:retention:manage', 'Administration', 'Configure data retention policies.'),
  define(
    'admin:dsr:manage',
    'Administration',
    'Handle GDPR/DPDPA data subject export and erasure requests.',
  ),

  // ---- Integrations ------------------------------------------------------
  define(
    'integration:manage',
    'Integrations',
    'Connect and configure GitHub, Jira and Azure DevOps.',
  ),
  define('integration:link', 'Integrations', 'Link a ticket to an external issue.'),

  // ---- Platform (vendor side) -------------------------------------------
  define('platform:tenant:manage', 'Platform', 'Provision and administer tenants.'),
  define('platform:read:all', 'Platform', 'Read data across every tenant.'),
  define('platform:impersonate', 'Platform', 'Act as a tenant user for support purposes.'),
] as const;

/** Union of every valid permission key, derived from the catalogue. */
export type PermissionKey = (typeof PERMISSIONS)[number]['key'];

export const PERMISSION_KEYS: readonly string[] = PERMISSIONS.map((p) => p.key);

const PERMISSION_BY_KEY = new Map(PERMISSIONS.map((p) => [p.key, p]));

export function getPermission(key: string): PermissionDefinition | undefined {
  return PERMISSION_BY_KEY.get(key);
}

export function isPermissionKey(key: string): boolean {
  return PERMISSION_BY_KEY.has(key);
}

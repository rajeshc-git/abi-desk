import { type PermissionKey } from './permissions';

/**
 * The role matrix, transcribed from the requirements document.
 *
 * Reproduced here so the code can be checked against the source cell by cell:
 *
 * | Module                  | Guest | Tenant Admin | L1       | L2 | L3 | Dev |
 * |-------------------------|-------|--------------|----------|----|----|-----|
 * | Create Ticket           |   ✓   |      ✓       |    ✓     | ✓  | ✓  |  ✓  |
 * | Edit Own Ticket         |   ✓   |      ✓       |    ✓     | ✓  | ✓  |  ✓  |
 * | View Own Tickets        |   ✓   |      ✓       |    ✓     | ✓  | ✓  |  ✓  |
 * | View All Tenant Tickets |   ✗   |      ✓       |    ✓     | ✓  | ✓  |  ✓  |
 * | Internal Notes          |   ✗   |      ✗       |    ✓     | ✓  | ✓  |  ✓  |
 * | Capture Screenshot      |   ✓   |      ✓       |    ✓     | ✓  | ✓  |  ✓  |
 * | Screen Recording        |   ✓   |      ✓       |    ✓     | ✓  | ✓  |  ✓  |
 * | Assign Ticket           |   ✗   |    Queue     |    ✓     | ✓  | ✓  |  ✓  |
 * | Escalate Ticket         |   ✗   |   Optional   |    ✓     | ✓  | ✓  |  ✓  |
 * | Close Ticket            |   ✗   |   Optional   |    ✓     | ✓  | ✓  |  ✓  |
 * | Bulk Update             |   ✗   |      ✗       | Optional | ✓  | ✓  |  ✓  |
 *
 * Three cells are not simple booleans, and they are the reason permissions are
 * rows in a table rather than constants in code:
 *
 *   "Queue"    -> Tenant Admin receives `ticket:assign:queue` but *not*
 *                 `ticket:assign:agent`. They can route work to a queue; they
 *                 cannot hand it to a named person.
 *   "Optional" -> shipped with a default and marked `configurable`, so a Tenant
 *                 Admin can flip it in settings. Only the pairing is configurable:
 *                 an admin can revoke their own escalate rights but never L1's.
 *
 * Two roles are added beyond the document, both noted in the schema:
 *   QA_TEAM        - the documented workflow has a QA stage with no owner.
 *   PLATFORM_ADMIN - a multi-tenant SaaS needs a vendor-side operator.
 *
 * One reading worth stating explicitly: Tenant Admin is an *administrator*, not a
 * ticket worker. The document gives them ✗ on Internal Notes and only "Edit Own
 * Ticket", so they do not receive `ticket:update:tenant` or
 * `ticket:note:internal`. Support tiers do the ticket work; admins configure the
 * system.
 */

export type RoleKey =
  | 'GUEST_CUSTOMER'
  | 'TENANT_ADMIN'
  | 'L1_SUPPORT'
  | 'L2_SUPPORT'
  | 'L3_SUPPORT'
  | 'DEV_TEAM'
  | 'QA_TEAM'
  | 'PLATFORM_ADMIN';

export type RoleScope = 'PLATFORM' | 'TENANT';

export type SupportTier = 'L1' | 'L2' | 'L3' | 'DEV' | 'QA';

export interface RoleGrant {
  permission: PermissionKey;
  /** Product default. */
  granted: boolean;
  /** Whether a Tenant Admin may change this pairing (the "Optional" cells). */
  configurable: boolean;
}

export interface RoleDefinition {
  key: RoleKey;
  scope: RoleScope;
  name: string;
  description: string;
  /** Lower is broader authority; blocks privilege escalation when assigning roles. */
  rank: number;
  tier?: SupportTier;
  /** Staff see the agent console; non-staff see only the customer portal. */
  isStaff: boolean;
  grants: RoleGrant[];
}

/** Granted, fixed. */
const allow = (permission: PermissionKey): RoleGrant => ({
  permission,
  granted: true,
  configurable: false,
});

/** An "Optional" cell: tenant-adjustable, with the product's default. */
const optional = (permission: PermissionKey, defaultGranted: boolean): RoleGrant => ({
  permission,
  granted: defaultGranted,
  configurable: true,
});

// ---------------------------------------------------------------------------
// Reusable bundles
// ---------------------------------------------------------------------------

/**
 * Every capture capability. The matrix grants screenshot and screen recording to
 * all six roles; the widget feature list adds annotation, voice and attachments on
 * the same footing, so they travel together.
 */
const CAPTURE_ALL: PermissionKey[] = [
  'capture:screenshot',
  'capture:annotate',
  'capture:screen_recording',
  'capture:voice_recording',
  'capture:attachment',
  'capture:diagnostics',
];

/** What every role can do with their own tickets. */
const TICKET_SELF_SERVICE: PermissionKey[] = [
  'ticket:create',
  'ticket:read:own',
  'ticket:update:own',
  'ticket:watch',
];

/** The working set shared by every support tier (L1 and above). */
const SUPPORT_BASELINE: PermissionKey[] = [
  ...TICKET_SELF_SERVICE,
  'ticket:read:tenant',
  'ticket:update:tenant',
  'ticket:note:internal',
  'ticket:assign:agent',
  'ticket:assign:queue',
  'ticket:escalate',
  'ticket:close',
  'ticket:reopen',
  'ticket:link',
  'ticket:tag',
  ...CAPTURE_ALL,
  'capture:diagnostics:read',
  'chat:participate',
  'chat:respond',
  'kb:read',
  'kb:read:internal',
  'approval:request',
  'report:view:own',
];

/** The full Tenant Administration list from the requirements. */
const TENANT_ADMINISTRATION: PermissionKey[] = [
  'admin:user:read',
  'admin:user:manage',
  'admin:user:invite',
  'admin:role:configure',
  'admin:team:manage',
  'admin:queue:manage',
  'admin:brand:manage',
  'admin:widget:configure',
  'admin:sso:manage',
  'admin:sla:manage',
  'admin:automation:manage',
  'admin:apikey:manage',
  'admin:webhook:manage',
  'admin:workflow:manage',
  'admin:retention:manage',
  'admin:dsr:manage',
];

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    key: 'GUEST_CUSTOMER',
    scope: 'TENANT',
    name: 'Guest User / Customer',
    description:
      'End user of the tenant\u2019s SaaS application. Raises tickets through the widget, tracks their own, and confirms resolutions.',
    rank: 100,
    isStaff: false,
    grants: [
      ...TICKET_SELF_SERVICE.map(allow),
      // Not "Close Ticket" - the requirements give Guest ✗ there. But the
      // workflow ends in "Customer Confirmation", so confirming is its own
      // capability rather than a back door into closing.
      allow('ticket:confirm_resolution'),
      ...CAPTURE_ALL.map(allow),
      allow('chat:start'),
      allow('chat:participate'),
      allow('kb:read'),
    ],
  },
  {
    key: 'TENANT_ADMIN',
    scope: 'TENANT',
    name: 'Tenant Admin',
    description:
      'Customer organization administrator. Manages users, branding, SSO, SLAs, automation, API keys and webhooks.',
    rank: 10,
    isStaff: true,
    grants: [
      ...TICKET_SELF_SERVICE.map(allow),
      allow('ticket:read:tenant'),
      allow('ticket:confirm_resolution'),

      // "Queue": route to a queue, never to a named agent.
      allow('ticket:assign:queue'),

      // "Optional": on by default, revocable by the tenant.
      optional('ticket:escalate', true),
      optional('ticket:close', true),

      // Deliberately absent, matching the matrix: ticket:note:internal (✗),
      // ticket:assign:agent (Queue only), ticket:bulk_update (✗),
      // ticket:update:tenant (only "Edit Own Ticket" is granted).

      ...CAPTURE_ALL.map(allow),
      allow('capture:diagnostics:read'),

      ...TENANT_ADMINISTRATION.map(allow),
      allow('audit:read'),
      allow('report:view:own'),
      allow('report:view:tenant'),
      allow('report:export'),
      allow('kb:read'),
      allow('kb:read:internal'),
      allow('kb:write'),
      allow('kb:publish'),
      allow('approval:decide'),
      allow('integration:manage'),
      allow('chat:participate'),
      allow('chat:respond'),
    ],
  },
  {
    key: 'L1_SUPPORT',
    scope: 'TENANT',
    name: 'L1 Support',
    description: 'First-line support. Triages incoming tickets and resolves common issues.',
    rank: 60,
    tier: 'L1',
    isStaff: true,
    grants: [
      ...SUPPORT_BASELINE.map(allow),
      // "Optional" for L1: off by default, since bulk changes by the least
      // experienced tier is how a backlog gets mangled. Tenants may enable it.
      optional('ticket:bulk_update', false),
    ],
  },
  {
    key: 'L2_SUPPORT',
    scope: 'TENANT',
    name: 'L2 Support',
    description: 'Technical support. Handles escalations that need deeper product knowledge.',
    rank: 50,
    tier: 'L2',
    isStaff: true,
    grants: [
      ...SUPPORT_BASELINE.map(allow),
      allow('ticket:bulk_update'),
      allow('ticket:merge'),
      allow('ticket:spam'),
      allow('report:view:tenant'),
      allow('kb:write'),
    ],
  },
  {
    key: 'L3_SUPPORT',
    scope: 'TENANT',
    name: 'L3 Support',
    description:
      'Product specialists. Last support tier before engineering; owns handover to development.',
    rank: 30,
    tier: 'L3',
    isStaff: true,
    grants: [
      ...SUPPORT_BASELINE.map(allow),
      allow('ticket:bulk_update'),
      allow('ticket:merge'),
      allow('ticket:spam'),
      allow('ticket:delete'),
      // L3 is the boundary with engineering, so the hand-off is theirs.
      allow('ticket:transition:development'),
      allow('report:view:tenant'),
      allow('report:export'),
      allow('kb:write'),
      allow('kb:publish'),
      allow('approval:decide'),
      allow('integration:link'),
    ],
  },
  {
    key: 'DEV_TEAM',
    scope: 'TENANT',
    name: 'Development Team',
    description: 'Engineering. Fixes defects raised from L3 and hands work to QA.',
    rank: 40,
    tier: 'DEV',
    isStaff: true,
    grants: [
      ...SUPPORT_BASELINE.map(allow),
      allow('ticket:bulk_update'),
      allow('ticket:merge'),
      allow('ticket:spam'),
      allow('ticket:transition:qa'),
      allow('report:view:tenant'),
      allow('kb:write'),
      allow('integration:link'),
      allow('integration:manage'),
    ],
  },
  {
    key: 'QA_TEAM',
    scope: 'TENANT',
    name: 'QA Team',
    description:
      'Verifies fixes and promotes them to release. Added because the documented workflow has a QA stage.',
    rank: 45,
    tier: 'QA',
    isStaff: true,
    grants: [
      ...SUPPORT_BASELINE.map(allow),
      allow('ticket:bulk_update'),
      // QA either promotes to release or sends the fix back to development.
      allow('ticket:transition:release'),
      allow('ticket:transition:development'),
      allow('report:view:tenant'),
      allow('kb:write'),
      allow('integration:link'),
    ],
  },
  {
    key: 'PLATFORM_ADMIN',
    scope: 'PLATFORM',
    name: 'Platform Admin',
    description:
      'Vendor-side operator. Provisions tenants and supports them across tenant boundaries.',
    rank: 0,
    isStaff: true,
    grants: [
      ...SUPPORT_BASELINE.map(allow),
      allow('ticket:bulk_update'),
      allow('ticket:merge'),
      allow('ticket:delete'),
      allow('ticket:spam'),
      allow('ticket:transition:development'),
      allow('ticket:transition:qa'),
      allow('ticket:transition:release'),
      ...TENANT_ADMINISTRATION.map(allow),
      allow('audit:read'),
      allow('report:view:tenant'),
      allow('report:export'),
      allow('kb:write'),
      allow('kb:publish'),
      allow('approval:decide'),
      allow('integration:manage'),
      allow('integration:link'),
      allow('platform:tenant:manage'),
      allow('platform:read:all'),
      allow('platform:impersonate'),
    ],
  },
] as const;

const ROLE_BY_KEY = new Map(ROLE_DEFINITIONS.map((role) => [role.key, role]));

export function getRoleDefinition(key: RoleKey): RoleDefinition | undefined {
  return ROLE_BY_KEY.get(key);
}

/** Escalation order used by the tier ladder. */
export const TIER_ORDER: readonly SupportTier[] = ['L1', 'L2', 'L3', 'DEV', 'QA'];

export function nextTier(tier: SupportTier): SupportTier | undefined {
  const index = TIER_ORDER.indexOf(tier);
  return index >= 0 ? TIER_ORDER[index + 1] : undefined;
}

// ---------------------------------------------------------------------------
// The requirements matrix, machine-readable.
//
// Kept separate from ROLE_DEFINITIONS on purpose: the conformance test asserts
// that the implementation above satisfies the document below. If the two were
// derived from each other the test would be circular and would prove nothing.
// ---------------------------------------------------------------------------

export type MatrixCell = 'yes' | 'no' | 'queue' | 'optional';

export interface MatrixRow {
  module: string;
  /** Permission key(s) the row corresponds to. */
  permissions: PermissionKey[];
  cells: Record<
    'GUEST_CUSTOMER' | 'TENANT_ADMIN' | 'L1_SUPPORT' | 'L2_SUPPORT' | 'L3_SUPPORT' | 'DEV_TEAM',
    MatrixCell
  >;
}

export const REQUIREMENTS_MATRIX: readonly MatrixRow[] = [
  {
    module: 'Create Ticket',
    permissions: ['ticket:create'],
    cells: {
      GUEST_CUSTOMER: 'yes',
      TENANT_ADMIN: 'yes',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Edit Own Ticket',
    permissions: ['ticket:update:own'],
    cells: {
      GUEST_CUSTOMER: 'yes',
      TENANT_ADMIN: 'yes',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'View Own Tickets',
    permissions: ['ticket:read:own'],
    cells: {
      GUEST_CUSTOMER: 'yes',
      TENANT_ADMIN: 'yes',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'View All Tenant Tickets',
    permissions: ['ticket:read:tenant'],
    cells: {
      GUEST_CUSTOMER: 'no',
      TENANT_ADMIN: 'yes',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Internal Notes',
    permissions: ['ticket:note:internal'],
    cells: {
      GUEST_CUSTOMER: 'no',
      TENANT_ADMIN: 'no',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Capture Screenshot',
    permissions: ['capture:screenshot'],
    cells: {
      GUEST_CUSTOMER: 'yes',
      TENANT_ADMIN: 'yes',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Screen Recording',
    permissions: ['capture:screen_recording'],
    cells: {
      GUEST_CUSTOMER: 'yes',
      TENANT_ADMIN: 'yes',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Assign Ticket',
    permissions: ['ticket:assign:agent'],
    cells: {
      GUEST_CUSTOMER: 'no',
      TENANT_ADMIN: 'queue',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Escalate Ticket',
    permissions: ['ticket:escalate'],
    cells: {
      GUEST_CUSTOMER: 'no',
      TENANT_ADMIN: 'optional',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Close Ticket',
    permissions: ['ticket:close'],
    cells: {
      GUEST_CUSTOMER: 'no',
      TENANT_ADMIN: 'optional',
      L1_SUPPORT: 'yes',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
  {
    module: 'Bulk Update',
    permissions: ['ticket:bulk_update'],
    cells: {
      GUEST_CUSTOMER: 'no',
      TENANT_ADMIN: 'no',
      L1_SUPPORT: 'optional',
      L2_SUPPORT: 'yes',
      L3_SUPPORT: 'yes',
      DEV_TEAM: 'yes',
    },
  },
] as const;

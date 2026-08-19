import { type PermissionKey } from './permissions';
import { ROLE_DEFINITIONS, type RoleKey } from './roles';

/**
 * Policy evaluation, kept free of Prisma and Nest so the same logic runs in the API
 * guards, the agent console (deciding what to render) and the tests.
 *
 * The important design decision here is that row visibility is expressed as a
 * *scope*, not as a boolean. "View Own Tickets" and "View All Tenant Tickets" are
 * separate rows in the requirements matrix, and the difference between them is which
 * rows a query may return - not whether an endpoint may be called. A guard alone
 * would let a caller with only `ticket:read:own` fetch someone else's ticket by id.
 */

/** The subset of a principal that policy decisions depend on. */
export interface PolicySubject {
  userId: string;
  tenantId: string | null;
  permissions: ReadonlySet<string>;
  isPlatformAdmin: boolean;
  /** Set when the user's roles are restricted to a single brand. */
  brandId?: string | null;
}

/**
 * How far a caller can see.
 *
 * Deliberately a data structure rather than a query fragment: this package must not
 * depend on an ORM. The API translates it into a Prisma `where` clause.
 */
export type AccessScope =
  /** Every tenant. Platform operators only. */
  | { kind: 'all' }
  /** Every row in one tenant. */
  | { kind: 'tenant'; tenantId: string }
  /** One tenant, narrowed to a single brand. */
  | { kind: 'brand'; tenantId: string; brandId: string }
  /** Only rows the caller owns. */
  | { kind: 'own'; tenantId: string; userId: string }
  /** Nothing. */
  | { kind: 'none' };

export interface PermissionRequirement {
  permissions: PermissionKey[];
  /** `all` requires every listed permission; `any` requires at least one. */
  mode: 'all' | 'any';
}

export function can(subject: PolicySubject, permission: PermissionKey | string): boolean {
  return subject.permissions.has(permission);
}

export function canAny(
  subject: PolicySubject,
  permissions: ReadonlyArray<PermissionKey | string>,
): boolean {
  return permissions.some((permission) => subject.permissions.has(permission));
}

export function canAll(
  subject: PolicySubject,
  permissions: ReadonlyArray<PermissionKey | string>,
): boolean {
  return permissions.every((permission) => subject.permissions.has(permission));
}

export function satisfies(subject: PolicySubject, requirement: PermissionRequirement): boolean {
  return requirement.mode === 'all'
    ? canAll(subject, requirement.permissions)
    : canAny(subject, requirement.permissions);
}

/**
 * Resolves how much of the ticket table a caller may read.
 *
 * Precedence is widest-first, and each step maps directly onto a matrix row:
 *   platform operator      -> every tenant
 *   ticket:read:tenant     -> "View All Tenant Tickets"
 *   ticket:read:own        -> "View Own Tickets"
 *   neither                -> nothing
 *
 * A brand-restricted agent gets `brand` rather than `tenant`, which is what makes
 * multi-brand support meaningful: an agent hired for one product line does not see
 * the other's tickets.
 */
export function resolveTicketScope(subject: PolicySubject): AccessScope {
  if (subject.isPlatformAdmin && can(subject, 'platform:read:all')) {
    return { kind: 'all' };
  }

  // Every branch below needs a tenant. A tenant-scoped role without a tenant is a
  // provisioning bug, and returning `none` fails closed rather than leaking.
  if (!subject.tenantId) {
    return { kind: 'none' };
  }

  if (can(subject, 'ticket:read:tenant')) {
    return subject.brandId
      ? { kind: 'brand', tenantId: subject.tenantId, brandId: subject.brandId }
      : { kind: 'tenant', tenantId: subject.tenantId };
  }

  if (can(subject, 'ticket:read:own')) {
    return { kind: 'own', tenantId: subject.tenantId, userId: subject.userId };
  }

  return { kind: 'none' };
}

/**
 * Whether the caller may see internal notes.
 *
 * Its own function because the matrix withholds this from Tenant Admin while
 * granting them `ticket:read:tenant` - so "can read the ticket" and "can read the
 * staff-only discussion on it" are genuinely independent, and conflating them is the
 * obvious way to leak internal notes to an administrator the document says should
 * not see them.
 */
export function canReadInternalNotes(subject: PolicySubject): boolean {
  return can(subject, 'ticket:note:internal');
}

/**
 * Whether the caller may edit a specific ticket.
 *
 * `ticket:update:own` is limited to tickets they reported; `ticket:update:tenant` is
 * unrestricted within the tenant.
 */
export function canEditTicket(
  subject: PolicySubject,
  ticket: { requesterId: string; tenantId: string },
): boolean {
  if (subject.tenantId && subject.tenantId !== ticket.tenantId && !subject.isPlatformAdmin) {
    return false;
  }

  if (can(subject, 'ticket:update:tenant')) return true;

  return can(subject, 'ticket:update:own') && ticket.requesterId === subject.userId;
}

/**
 * Assignment capability, split to express the matrix's "Queue" cell.
 *
 * Tenant Admin may route a ticket to a queue but not hand it to a named agent, so
 * these are two permissions and two answers rather than one.
 */
export function resolveAssignmentCapability(subject: PolicySubject): {
  toAgent: boolean;
  toQueue: boolean;
} {
  return {
    toAgent: can(subject, 'ticket:assign:agent'),
    toQueue: can(subject, 'ticket:assign:queue') || can(subject, 'ticket:assign:agent'),
  };
}

/**
 * Highest authority (lowest rank) among a set of roles.
 *
 * Used to stop privilege escalation: a user may not grant a role more powerful than
 * their own, which is otherwise a one-request path from Tenant Admin to Platform
 * Admin.
 */
export function highestRank(roles: ReadonlyArray<RoleKey>): number {
  const ranks = roles
    .map((key) => ROLE_DEFINITIONS.find((role) => role.key === key)?.rank)
    .filter((rank): rank is number => typeof rank === 'number');

  return ranks.length > 0 ? Math.min(...ranks) : Number.POSITIVE_INFINITY;
}

/** True when `actorRoles` may assign `targetRole` without escalating privilege. */
export function canAssignRole(actorRoles: ReadonlyArray<RoleKey>, targetRole: RoleKey): boolean {
  const target = ROLE_DEFINITIONS.find((role) => role.key === targetRole);
  if (!target) return false;

  // Strictly greater-than-or-equal: an admin may assign their own rank downwards but
  // never create a peer with broader authority than themselves.
  return highestRank(actorRoles) <= target.rank;
}

/**
 * The product-default grant for a (role, permission) pair, or undefined when the
 * role never mentions it.
 *
 * Absence and `granted: false` mean different things: absence is "not part of this
 * role", while an explicit false is a capability deliberately withheld that a tenant
 * may switch on. The matrix's "Optional" cells rely on that distinction.
 */
export function defaultGrantFor(
  roleKey: RoleKey,
  permission: PermissionKey | string,
): { granted: boolean; configurable: boolean } | undefined {
  const role = ROLE_DEFINITIONS.find((candidate) => candidate.key === roleKey);
  if (!role) return undefined;

  const grant = role.grants.find((candidate) => candidate.permission === permission);
  if (!grant) return undefined;

  return { granted: grant.granted, configurable: grant.configurable };
}

/** Effective default permission set for a role, ignoring tenant overrides. */
export function defaultPermissionsFor(roleKey: RoleKey): string[] {
  const role = ROLE_DEFINITIONS.find((candidate) => candidate.key === roleKey);
  if (!role) return [];

  return role.grants.filter((grant) => grant.granted).map((grant) => grant.permission);
}

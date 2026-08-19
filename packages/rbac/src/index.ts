/**
 * `@abi-desk/rbac` - the authorization model, with no runtime dependencies.
 *
 * Deliberately free of Prisma, Nest and any browser API so the same catalogue,
 * matrix and policy logic serve the API guards, the seed script, the agent console
 * (deciding what to render) and the test suite. One definition, four consumers, no
 * chance of drift.
 */

export {
  PERMISSIONS,
  PERMISSION_KEYS,
  getPermission,
  isPermissionKey,
  type PermissionCategory,
  type PermissionDefinition,
  type PermissionKey,
} from './permissions';

export {
  ROLE_DEFINITIONS,
  REQUIREMENTS_MATRIX,
  TIER_ORDER,
  getRoleDefinition,
  nextTier,
  type MatrixCell,
  type MatrixRow,
  type RoleDefinition,
  type RoleGrant,
  type RoleKey,
  type RoleScope,
  type SupportTier,
} from './roles';

export {
  can,
  canAll,
  canAny,
  canAssignRole,
  canEditTicket,
  canReadInternalNotes,
  defaultGrantFor,
  defaultPermissionsFor,
  highestRank,
  resolveAssignmentCapability,
  resolveTicketScope,
  satisfies,
  type AccessScope,
  type PermissionRequirement,
  type PolicySubject,
} from './policy';

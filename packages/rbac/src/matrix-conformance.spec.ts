import { describe, expect, it } from 'vitest';
import { PERMISSIONS, PERMISSION_KEYS } from './permissions';
import { defaultGrantFor } from './policy';
import { REQUIREMENTS_MATRIX, ROLE_DEFINITIONS, type MatrixCell, type RoleKey } from './roles';

/**
 * Conformance test: does the implemented role model satisfy the RBAC matrix in
 * `Requirement.md`?
 *
 * `REQUIREMENTS_MATRIX` is a hand transcription of the document's table and is
 * deliberately kept separate from `ROLE_DEFINITIONS`. If one were derived from the
 * other this test would be circular and would prove nothing - it would only confirm
 * that a value equals itself. Here the two are written independently and this file
 * asserts they agree, so a drift in either direction fails the build.
 *
 * The three non-boolean cells are what make the test worth having:
 *   "Queue"    -> assign-to-queue granted, assign-to-agent withheld
 *   "Optional" -> granted with a default, and marked tenant-configurable
 *   Guest ✗ on Close, but the workflow still ends in Customer Confirmation
 */

/** The six roles the document actually specifies. */
const DOCUMENTED_ROLES = [
  'GUEST_CUSTOMER',
  'TENANT_ADMIN',
  'L1_SUPPORT',
  'L2_SUPPORT',
  'L3_SUPPORT',
  'DEV_TEAM',
] as const satisfies readonly RoleKey[];

/** Asserts one cell of the matrix against the implemented grants. */
function assertCell(role: RoleKey, permission: string, cell: MatrixCell): void {
  const grant = defaultGrantFor(role, permission);

  switch (cell) {
    case 'yes':
      expect(grant, `${role} should hold ${permission}`).toBeDefined();
      expect(grant?.granted, `${role}.${permission} should be granted`).toBe(true);
      expect(
        grant?.configurable,
        `${role}.${permission} is a hard tick in the matrix, so a tenant must not be able to revoke it`,
      ).toBe(false);
      break;

    case 'no':
      // Absence and an explicit `granted: false` both satisfy "✗". What must never
      // happen is an effective grant.
      expect(grant?.granted ?? false, `${role} must NOT hold ${permission}`).toBe(false);
      break;

    case 'optional':
      expect(grant, `${role}.${permission} is "Optional" so a default must exist`).toBeDefined();
      expect(
        grant?.configurable,
        `${role}.${permission} is "Optional" so a tenant must be able to change it`,
      ).toBe(true);
      break;

    case 'queue':
      // Handled by a dedicated test below, since it spans two permissions.
      break;
  }
}

describe('RBAC matrix conformance (Requirement.md)', () => {
  it('transcribes all eleven documented rows', () => {
    // A guard against silently dropping a row from the transcription.
    expect(REQUIREMENTS_MATRIX).toHaveLength(11);
    expect(REQUIREMENTS_MATRIX.map((row) => row.module)).toEqual([
      'Create Ticket',
      'Edit Own Ticket',
      'View Own Tickets',
      'View All Tenant Tickets',
      'Internal Notes',
      'Capture Screenshot',
      'Screen Recording',
      'Assign Ticket',
      'Escalate Ticket',
      'Close Ticket',
      'Bulk Update',
    ]);
  });

  for (const row of REQUIREMENTS_MATRIX) {
    describe(`row: ${row.module}`, () => {
      for (const role of DOCUMENTED_ROLES) {
        const cell = row.cells[role];

        it(`${role} = ${cell}`, () => {
          for (const permission of row.permissions) {
            assertCell(role, permission, cell);
          }
        });
      }
    });
  }

  describe('the "Queue" cell (Tenant Admin, Assign Ticket)', () => {
    it('grants routing to a queue but not to a named agent', () => {
      // This is the whole point of splitting assignment into two permissions.
      expect(defaultGrantFor('TENANT_ADMIN', 'ticket:assign:queue')?.granted).toBe(true);
      expect(defaultGrantFor('TENANT_ADMIN', 'ticket:assign:agent')?.granted ?? false).toBe(false);
    });

    it('gives support tiers both, since their cell is a plain tick', () => {
      for (const role of ['L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM'] as const) {
        expect(defaultGrantFor(role, 'ticket:assign:agent')?.granted).toBe(true);
        expect(defaultGrantFor(role, 'ticket:assign:queue')?.granted).toBe(true);
      }
    });
  });

  describe('the "Optional" cells', () => {
    it('Tenant Admin escalate and close default on and stay adjustable', () => {
      for (const permission of ['ticket:escalate', 'ticket:close'] as const) {
        const grant = defaultGrantFor('TENANT_ADMIN', permission);
        expect(grant?.granted).toBe(true);
        expect(grant?.configurable).toBe(true);
      }
    });

    it('L1 bulk update defaults off and stays adjustable', () => {
      const grant = defaultGrantFor('L1_SUPPORT', 'ticket:bulk_update');
      // Off by default: bulk edits by the least experienced tier is how a backlog
      // gets mangled. Tenants who want it can switch it on.
      expect(grant?.granted).toBe(false);
      expect(grant?.configurable).toBe(true);
    });

    it('does not make the same permission adjustable for higher tiers', () => {
      // An admin must be able to revoke their own escalate rights but never L1's.
      expect(defaultGrantFor('L1_SUPPORT', 'ticket:escalate')?.configurable).toBe(false);
      expect(defaultGrantFor('L2_SUPPORT', 'ticket:bulk_update')?.configurable).toBe(false);
    });
  });

  describe('customer confirmation without close rights', () => {
    it('lets a guest confirm a resolution but not close a ticket', () => {
      // The document gives Guest ✗ on Close, yet the workflow ends in "Customer
      // Confirmation". Confirming is therefore its own capability, not a loophole
      // into closing.
      expect(defaultGrantFor('GUEST_CUSTOMER', 'ticket:confirm_resolution')?.granted).toBe(true);
      expect(defaultGrantFor('GUEST_CUSTOMER', 'ticket:close')?.granted ?? false).toBe(false);
    });
  });

  describe('Tenant Admin is an administrator, not a ticket worker', () => {
    it('holds every documented Tenant Administration permission', () => {
      // Straight from the "Tenant Administration Permissions" list in the document.
      const required = [
        'admin:user:manage',
        'admin:user:invite',
        'admin:widget:configure',
        'admin:brand:manage',
        'admin:sso:manage',
        'admin:sla:manage',
        'admin:automation:manage',
        'admin:apikey:manage',
        'admin:webhook:manage',
      ] as const;

      for (const permission of required) {
        expect(defaultGrantFor('TENANT_ADMIN', permission)?.granted, permission).toBe(true);
      }
    });

    it('does not hold internal notes or tenant-wide ticket editing', () => {
      // The matrix gives them ✗ on Internal Notes and only "Edit Own Ticket", which
      // reads as a deliberate separation of administration from casework.
      expect(defaultGrantFor('TENANT_ADMIN', 'ticket:note:internal')?.granted ?? false).toBe(false);
      expect(defaultGrantFor('TENANT_ADMIN', 'ticket:update:tenant')?.granted ?? false).toBe(false);
      expect(defaultGrantFor('TENANT_ADMIN', 'ticket:update:own')?.granted).toBe(true);
    });
  });

  describe('roles added beyond the document', () => {
    it('gives QA ownership of the workflow stage the document created for it', () => {
      // The pipeline has Development -> QA -> Release but the roles table omits QA,
      // so the stage would otherwise have no owner.
      expect(defaultGrantFor('QA_TEAM', 'ticket:transition:release')?.granted).toBe(true);
      expect(defaultGrantFor('QA_TEAM', 'ticket:transition:development')?.granted).toBe(true);
    });

    it('scopes the platform operator across tenants and nobody else', () => {
      expect(defaultGrantFor('PLATFORM_ADMIN', 'platform:read:all')?.granted).toBe(true);

      for (const role of DOCUMENTED_ROLES) {
        expect(defaultGrantFor(role, 'platform:read:all')?.granted ?? false, role).toBe(false);
        expect(defaultGrantFor(role, 'platform:tenant:manage')?.granted ?? false, role).toBe(false);
      }
    });
  });
});

describe('permission catalogue integrity', () => {
  it('has no duplicate keys', () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
  });

  it('only grants permissions that exist in the catalogue', () => {
    // Catches a typo in a role definition, which would otherwise silently grant
    // nothing and be very hard to spot.
    const known = new Set<string>(PERMISSION_KEYS);
    const unknown: string[] = [];

    for (const role of ROLE_DEFINITIONS) {
      for (const grant of role.grants) {
        if (!known.has(grant.permission)) {
          unknown.push(`${role.key} -> ${grant.permission}`);
        }
      }
    }

    expect(unknown).toEqual([]);
  });

  it('never lists the same permission twice within one role', () => {
    const duplicates: string[] = [];

    for (const role of ROLE_DEFINITIONS) {
      const seen = new Set<string>();
      for (const grant of role.grants) {
        if (seen.has(grant.permission)) duplicates.push(`${role.key} -> ${grant.permission}`);
        seen.add(grant.permission);
      }
    }

    // A duplicate would make the effective grant depend on array order, which is not
    // something anyone should have to reason about.
    expect(duplicates).toEqual([]);
  });

  it('derives module and action consistently from every key', () => {
    for (const permission of PERMISSIONS) {
      const [module, action] = permission.key.split(':');
      expect(permission.module).toBe(module);
      expect(permission.action).toBe(action);
    }
  });

  it('marks a permission tenant-configurable only where some role says so', () => {
    const configurable = new Set(
      ROLE_DEFINITIONS.flatMap((role) =>
        role.grants.filter((grant) => grant.configurable).map((grant) => grant.permission),
      ),
    );

    // The document's "Optional" cells, and nothing else.
    expect([...configurable].sort()).toEqual([
      'ticket:bulk_update',
      'ticket:close',
      'ticket:escalate',
    ]);
  });

  it('assigns every role a unique rank so authority is a total order', () => {
    const ranks = ROLE_DEFINITIONS.map((role) => role.rank);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('gives the platform operator the broadest authority', () => {
    const platform = ROLE_DEFINITIONS.find((role) => role.key === 'PLATFORM_ADMIN');
    const others = ROLE_DEFINITIONS.filter((role) => role.key !== 'PLATFORM_ADMIN');

    // Lower rank means broader authority; this is what `canAssignRole` relies on to
    // prevent privilege escalation.
    for (const role of others) {
      expect(platform!.rank).toBeLessThan(role.rank);
    }
  });
});

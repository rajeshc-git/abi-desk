import { Injectable } from '@nestjs/common';
import { defaultGrantFor, ROLE_DEFINITIONS, type RoleKey } from '@abi-desk/rbac';
import { AppException } from '../../common/errors/app-exception';
import { AuditService } from '../../common/audit/audit.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { PermissionResolverService } from './permission-resolver.service';

export interface ConfigurableGrant {
  roleKey: RoleKey;
  roleName: string;
  permissionKey: string;
  permissionDescription: string;
  /** What the product ships. */
  defaultGranted: boolean;
  /** What this tenant has in force. */
  effectiveGranted: boolean;
  /** True when the tenant has deviated from the default. */
  overridden: boolean;
}

/**
 * Tenant-level adjustment of the matrix's "Optional" cells.
 *
 * Only pairings the product marks `configurable` may be changed. That restriction is
 * the whole point: a Tenant Admin can revoke their *own* escalate rights, but must
 * never be able to strip `ticket:escalate` from L1 - the document shows that as a hard
 * tick, and letting an admin turn it off would break first-line support and put the
 * system out of conformance with its own specification.
 */
@Injectable()
export class PermissionOverrideService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly resolver: PermissionResolverService,
    private readonly audit: AuditService,
  ) {}

  /** Every adjustable pairing, with the tenant's current effective state. */
  async list(tenantId: string): Promise<ConfigurableGrant[]> {
    const [rolePermissions, overrides] = await Promise.all([
      this.prisma.client.rolePermission.findMany({
        where: { configurable: true },
        select: {
          granted: true,
          role: { select: { id: true, key: true, name: true } },
          permission: { select: { id: true, key: true, description: true } },
        },
      }),
      this.prisma.client.tenantRolePermissionOverride.findMany({
        where: { tenantId },
        select: { roleId: true, permissionId: true, granted: true },
      }),
    ]);

    const overrideByPair = new Map(
      overrides.map((override) => [
        `${override.roleId}:${override.permissionId}`,
        override.granted,
      ]),
    );

    return rolePermissions
      .map((row) => {
        const override = overrideByPair.get(`${row.role.id}:${row.permission.id}`);

        return {
          roleKey: row.role.key as RoleKey,
          roleName: row.role.name,
          permissionKey: row.permission.key,
          permissionDescription: row.permission.description,
          defaultGranted: row.granted,
          effectiveGranted: override ?? row.granted,
          overridden: override !== undefined && override !== row.granted,
        };
      })
      .sort(
        (a, b) =>
          a.roleKey.localeCompare(b.roleKey) || a.permissionKey.localeCompare(b.permissionKey),
      );
  }

  /**
   * Sets or clears an override.
   *
   * Passing `granted === null` removes the override and returns the pairing to the
   * product default, which is a distinct operation from setting it to the same value
   * as the default - the row's presence is what the admin UI shows as "customised".
   */
  async set(input: {
    tenantId: string;
    roleKey: RoleKey;
    permissionKey: string;
    granted: boolean | null;
    actorId: string;
  }): Promise<ConfigurableGrant[]> {
    const role = ROLE_DEFINITIONS.find((candidate) => candidate.key === input.roleKey);

    if (!role) {
      throw AppException.notFound('Role', input.roleKey);
    }

    // A platform-scoped role's grants are not a tenant's business to change.
    if (role.scope === 'PLATFORM') {
      throw AppException.permissionDenied('Platform-scoped roles cannot be modified by a tenant.', {
        roleKey: input.roleKey,
      });
    }

    const productDefault = defaultGrantFor(input.roleKey, input.permissionKey);

    if (!productDefault) {
      throw AppException.unprocessable(
        `Role ${input.roleKey} does not include ${input.permissionKey}.`,
        [{ path: 'permissionKey', message: 'not part of this role' }],
      );
    }

    if (!productDefault.configurable) {
      // The refusal that keeps the deployment conformant with the requirements.
      throw AppException.permissionDenied(
        `${input.permissionKey} is fixed for ${input.roleKey} and cannot be changed.`,
        { roleKey: input.roleKey, permissionKey: input.permissionKey },
      );
    }

    const [roleRow, permissionRow] = await Promise.all([
      this.prisma.client.role.findUnique({
        where: { key: input.roleKey },
        select: { id: true },
      }),
      this.prisma.client.permission.findUnique({
        where: { key: input.permissionKey },
        select: { id: true },
      }),
    ]);

    if (!roleRow || !permissionRow) {
      throw AppException.notFound('Role or permission');
    }

    const existing = await this.prisma.client.tenantRolePermissionOverride.findUnique({
      where: {
        tenantId_roleId_permissionId: {
          tenantId: input.tenantId,
          roleId: roleRow.id,
          permissionId: permissionRow.id,
        },
      },
      select: { granted: true },
    });

    if (input.granted === null) {
      await this.prisma.client.tenantRolePermissionOverride.deleteMany({
        where: { tenantId: input.tenantId, roleId: roleRow.id, permissionId: permissionRow.id },
      });
    } else {
      await this.prisma.client.tenantRolePermissionOverride.upsert({
        where: {
          tenantId_roleId_permissionId: {
            tenantId: input.tenantId,
            roleId: roleRow.id,
            permissionId: permissionRow.id,
          },
        },
        update: { granted: input.granted, updatedById: input.actorId },
        create: {
          tenantId: input.tenantId,
          roleId: roleRow.id,
          permissionId: permissionRow.id,
          granted: input.granted,
          updatedById: input.actorId,
        },
      });
    }

    await this.audit.record({
      action: 'authorization.permission_override_changed',
      resourceType: 'role_permission',
      resourceId: roleRow.id,
      resourceLabel: `${input.roleKey}:${input.permissionKey}`,
      tenantId: input.tenantId,
      actorId: input.actorId,
      changes: {
        granted: {
          from: existing?.granted ?? productDefault.granted,
          to: input.granted ?? productDefault.granted,
        },
      },
    });

    // Every holder of this role now has a stale cached permission set. The 60-second
    // TTL would eventually catch up, but an admin flipping a switch expects it to
    // take effect before they can refresh the page.
    await this.resolver.invalidateTenant(input.tenantId);

    return this.list(input.tenantId);
  }
}

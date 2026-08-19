import { type PrismaClient, type RoleKey } from '@prisma/client';
import { PERMISSIONS, ROLE_DEFINITIONS } from '@abi-desk/rbac';

/**
 * Projects the canonical catalogue in `@abi-desk/rbac` into the database.
 *
 * The catalogue is the source of truth and this is a one-way sync, so the seed can
 * be re-run after a permission is added and the tables converge. Tenant overrides
 * are never touched: those are customer configuration, not product defaults.
 */
export async function seedAuthorization(prisma: PrismaClient): Promise<void> {
  // --- Permissions -------------------------------------------------------
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        module: permission.module,
        action: permission.action,
        scope: permission.scope ?? null,
        description: permission.description,
        category: permission.category,
      },
      create: {
        key: permission.key,
        module: permission.module,
        action: permission.action,
        scope: permission.scope ?? null,
        description: permission.description,
        category: permission.category,
        // Set below, once we know whether any role marks this pairing adjustable.
        tenantConfigurable: false,
      },
    });
  }

  const permissionIdByKey = new Map(
    (await prisma.permission.findMany({ select: { id: true, key: true } })).map((p) => [
      p.key,
      p.id,
    ]),
  );

  // --- Roles -------------------------------------------------------------
  for (const role of ROLE_DEFINITIONS) {
    await prisma.role.upsert({
      where: { key: role.key as RoleKey },
      update: {
        scope: role.scope,
        name: role.name,
        description: role.description,
        rank: role.rank,
        tier: role.tier ?? null,
        isStaff: role.isStaff,
      },
      create: {
        key: role.key as RoleKey,
        scope: role.scope,
        name: role.name,
        description: role.description,
        rank: role.rank,
        tier: role.tier ?? null,
        isSystem: true,
        isStaff: role.isStaff,
      },
    });
  }

  const roleIdByKey = new Map(
    (await prisma.role.findMany({ select: { id: true, key: true } })).map((r) => [r.key, r.id]),
  );

  // --- Role -> permission grants ----------------------------------------
  const configurablePermissionKeys = new Set<string>();

  for (const role of ROLE_DEFINITIONS) {
    const roleId = roleIdByKey.get(role.key as RoleKey);
    if (!roleId) throw new Error(`Role ${role.key} was not persisted.`);

    const grantedKeys = new Set<string>();

    for (const grant of role.grants) {
      const permissionId = permissionIdByKey.get(grant.permission);
      if (!permissionId) {
        throw new Error(`Role ${role.key} references unknown permission '${grant.permission}'.`);
      }

      grantedKeys.add(grant.permission);
      if (grant.configurable) {
        configurablePermissionKeys.add(grant.permission);
      }

      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: { granted: grant.granted, configurable: grant.configurable },
        create: {
          roleId,
          permissionId,
          granted: grant.granted,
          configurable: grant.configurable,
        },
      });
    }

    // Remove grants that were dropped from the catalogue, so a revoked capability
    // actually disappears instead of lingering from an earlier seed.
    const staleIds = [...permissionIdByKey.entries()]
      .filter(([key]) => !grantedKeys.has(key))
      .map(([, id]) => id);

    if (staleIds.length > 0) {
      await prisma.rolePermission.deleteMany({
        where: { roleId, permissionId: { in: staleIds } },
      });
    }
  }

  // A permission is flagged tenant-configurable when at least one role exposes it
  // as such; that flag is what drives the admin settings UI.
  if (configurablePermissionKeys.size > 0) {
    await prisma.permission.updateMany({
      where: { key: { in: [...configurablePermissionKeys] } },
      data: { tenantConfigurable: true },
    });
  }
}

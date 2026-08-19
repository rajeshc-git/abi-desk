/* eslint-disable no-console */
/**
 * Seed entry point.
 *
 * Idempotent: every write is an upsert (or a find-then-write where the uniqueness
 * guarantee is a partial index Prisma cannot target), so `pnpm db:seed` can run
 * repeatedly against an existing database without duplicating anything.
 *
 * Connects with MIGRATION_DATABASE_URL - the schema owner - because the owner is
 * exempt from Row Level Security. Seeding through the runtime role would require
 * establishing tenant context around every single write.
 */
import { PrismaClient } from '@prisma/client';
import { parseEncryptionKey } from '../src/secret-box';
import { seedAuthorization } from './seed/authorization';
import { DEMO_PASSWORD, DEMO_WIDGET_PUBLIC_KEYS } from './seed/constants';
import { seedTenants } from './seed/tenants';
import { seedUsers } from './seed/users';
import { seedWorkflowDefaults } from './seed/workflow';

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('MIGRATION_DATABASE_URL (or DATABASE_URL) must be set to run the seed.');
}

const encryptionKeyRaw = process.env.APP_ENCRYPTION_KEY;

if (!encryptionKeyRaw) {
  throw new Error(
    'APP_ENCRYPTION_KEY must be set: widget signing secrets are encrypted at rest.\n' +
      'Generate one with: openssl rand -base64 32',
  );
}

const encryptionKey = parseEncryptionKey(encryptionKeyRaw);

const prisma = new PrismaClient({
  datasources: { db: { url: connectionString } },
});

function step(label: string): (detail?: string) => void {
  const startedAt = Date.now();
  process.stdout.write(`  ${label.padEnd(34, '.')} `);
  return (detail = '') => {
    console.log(`ok ${String(Date.now() - startedAt).padStart(5)}ms ${detail}`);
  };
}

async function main(): Promise<void> {
  console.log('\nSeeding ABI Desk\n');

  let done = step('permissions and roles');
  await seedAuthorization(prisma);
  const [permissionCount, roleCount, grantCount] = await Promise.all([
    prisma.permission.count(),
    prisma.role.count(),
    prisma.rolePermission.count(),
  ]);
  done(`${permissionCount} permissions, ${roleCount} roles, ${grantCount} grants`);

  done = step('workflow defaults');
  const transitions = await seedWorkflowDefaults(prisma);
  done(`${transitions} transitions`);

  done = step('tenants, brands and config');
  await seedTenants(prisma, encryptionKey);
  const [tenantCount, brandCount, queueCount, slaCount] = await Promise.all([
    prisma.tenant.count(),
    prisma.brand.count(),
    prisma.queue.count(),
    prisma.slaPolicy.count(),
  ]);
  done(
    `${tenantCount} tenants, ${brandCount} brands, ${queueCount} queues, ${slaCount} SLA policies`,
  );

  done = step('users and role assignments');
  const users = await seedUsers(prisma);
  done(`${users.length} users`);

  // ---- Report -----------------------------------------------------------
  console.log('\nDemo accounts (password for all: ' + DEMO_PASSWORD + ')\n');
  console.log('  ' + 'EMAIL'.padEnd(34) + 'TENANT'.padEnd(10) + 'ROLES');
  console.log('  ' + '-'.repeat(78));
  for (const user of users) {
    console.log('  ' + user.email.padEnd(34) + user.tenant.padEnd(10) + user.roles.join(', '));
  }

  console.log('\nWidget public keys (embed in a host page)\n');
  for (const [brand, key] of Object.entries(DEMO_WIDGET_PUBLIC_KEYS)) {
    console.log('  ' + brand.padEnd(20) + key);
  }

  console.log('\nSeed complete.\n');
}

main()
  .catch((error: unknown) => {
    console.error('\nSeed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

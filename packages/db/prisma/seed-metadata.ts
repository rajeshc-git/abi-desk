import { PrismaClient } from '@prisma/client';
import { seedAuthorization } from './seed/authorization';
import { seedWorkflowDefaults } from './seed/workflow';

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('MIGRATION_DATABASE_URL (or DATABASE_URL) must be set to run the metadata seed.');
}

const prisma = new PrismaClient({
  datasources: { db: { url: connectionString } },
});

async function main(): Promise<void> {
  console.log('\nSeeding ABI Desk System Metadata...\n');

  console.log('Seeding permissions and roles...');
  await seedAuthorization(prisma);

  console.log('Seeding workflow defaults...');
  const transitions = await seedWorkflowDefaults(prisma);

  console.log(`\nMetadata seeding complete. ${transitions} transitions seeded.\n`);
}

main()
  .catch((error: unknown) => {
    console.error('\nMetadata seed failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

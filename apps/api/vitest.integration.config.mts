import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * Integration tests. These talk to the real PostgreSQL from docker-compose,
 * because the behaviour under test *is* PostgreSQL behaviour: Row Level Security,
 * `SET LOCAL` transaction scoping, and trigger enforcement cannot be verified
 * against a mock.
 *
 *   docker compose up -d postgres
 *   pnpm --filter @abi-desk/api test:integration
 *
 * Run serially: several tests assert on tenant-scoped visibility, and parallel
 * workers sharing one database would interleave their transactions.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
  plugins: [
    swc.vite({
      module: { type: 'es6' },
      jsc: {
        target: 'es2022',
        parser: { syntax: 'typescript', decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
      },
    }),
  ],
});

import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

/**
 * NestJS depends on `emitDecoratorMetadata`, which esbuild (Vite's default
 * transformer) does not implement. SWC does, so we swap it in for tests.
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.spec.ts'],
    // Integration specs need a live PostgreSQL and have their own config; the unit
    // run must stay runnable with no infrastructure at all.
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/main.ts', 'src/**/*.module.ts'],
    },
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

import 'reflect-metadata';

import { bootstrapApi } from './bootstrap/api.bootstrap';
import { bootstrapWorker } from './bootstrap/worker.bootstrap';
import { createLogger } from './common/logging/logger.factory';
import { EnvironmentValidationError, loadEnv } from './config/env.schema';

/**
 * Process entry point for both the API and the worker.
 *
 * Order matters here:
 *  1. validate configuration (fail fast, with a readable message),
 *  2. build the logger (so every subsequent line is structured),
 *  3. install last-resort handlers,
 *  4. boot the selected role.
 */
async function main(): Promise<void> {
  const env = loadEnv();
  const logger = createLogger(env);

  // An unhandled rejection or uncaught exception means we are in unknown state.
  // Log it with full fidelity, then exit and let the orchestrator restart us.
  process.on('unhandledRejection', (reason: unknown) => {
    logger.fatal({ err: reason }, 'Unhandled promise rejection - exiting');
    process.exit(1);
  });

  process.on('uncaughtException', (error: Error) => {
    logger.fatal({ err: error }, 'Uncaught exception - exiting');
    process.exit(1);
  });

  if (env.PROCESS_ROLE === 'worker') {
    await bootstrapWorker(env, logger);
    return;
  }

  await bootstrapApi(env, logger);
}

main().catch((error: unknown) => {
  if (error instanceof EnvironmentValidationError) {
    // Configuration errors happen before the logger exists and are read by a
    // human staring at `docker compose logs`, so plain text is correct here.
    console.error(`\n${error.message}\n`);
    process.exit(78); // EX_CONFIG
  }

  console.error('Fatal error during startup:', error);
  process.exit(1);
});

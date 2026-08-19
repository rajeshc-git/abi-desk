import { Prisma, PrismaClient } from '@prisma/client';

export interface PrismaClientOptions {
  /** Postgres connection string for the low-privilege runtime role. */
  databaseUrl: string;
  /** Emit query-level log events. Verbose; intended for local debugging only. */
  logQueries?: boolean;
}

/**
 * Produces the Prisma constructor options used everywhere in the monorepo.
 *
 * Logs are emitted as Prisma *events* rather than written to stdout, so the host
 * application can forward them through its own structured logger and keep a
 * single log format across the process.
 */
export function buildPrismaOptions(options: PrismaClientOptions): Prisma.PrismaClientOptions {
  const log: Prisma.LogDefinition[] = [
    { emit: 'event', level: 'warn' },
    { emit: 'event', level: 'error' },
  ];

  if (options.logQueries) {
    log.unshift({ emit: 'event', level: 'query' });
  }

  return {
    datasources: { db: { url: options.databaseUrl } },
    log,
    errorFormat: 'minimal',
  };
}

/** Convenience factory for scripts and tests that do not use Nest DI. */
export function createPrismaClient(options: PrismaClientOptions): PrismaClient {
  return new PrismaClient(buildPrismaOptions(options));
}

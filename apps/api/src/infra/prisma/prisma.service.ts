import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { buildPrismaOptions, PrismaClient } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppConfig } from '../../config/app-config';
import { PINO_LOGGER } from '../../common/logging/logging.module';

/** Shape of the Prisma log events we subscribe to (typed loosely on purpose). */
interface PrismaLogEvent {
  message: string;
  target?: string;
}

interface PrismaQueryEvent extends PrismaLogEvent {
  query: string;
  params: string;
  duration: number;
}

/**
 * Prisma client bound to the Nest lifecycle.
 *
 * Connects eagerly on module init so a bad `DATABASE_URL` fails the container's
 * startup rather than the first request, and disconnects on shutdown so
 * `docker compose down` does not leave sessions behind in Postgres.
 *
 * Note this connects as the *low-privilege* role, which is what makes Row Level
 * Security effective. Migrations use a separate owner connection.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;

  constructor(config: AppConfig, @Inject(PINO_LOGGER) rootLogger: Logger) {
    super(
      buildPrismaOptions({
        databaseUrl: config.database.url,
        logQueries: config.database.logQueries,
      }),
    );

    this.logger = rootLogger.child({ context: 'PrismaService' });
    this.forwardPrismaLogs(config.database.logQueries);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.info('Database connection established');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.info('Database connection closed');
  }

  /** Cheap liveness probe used by the readiness endpoint. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }

  /**
   * Prisma emits warnings and errors as events (see `buildPrismaOptions`) so they
   * do not bypass our structured logger. The `$on` overloads are keyed off the
   * literal log config, which we build at runtime, hence the narrow cast.
   */
  private forwardPrismaLogs(logQueries: boolean): void {
    const emitter = this as unknown as {
      $on(event: 'warn' | 'error', listener: (event: PrismaLogEvent) => void): void;
      $on(event: 'query', listener: (event: PrismaQueryEvent) => void): void;
    };

    emitter.$on('warn', (event) => {
      this.logger.warn({ target: event.target }, event.message);
    });

    emitter.$on('error', (event) => {
      this.logger.error({ target: event.target }, event.message);
    });

    if (logQueries) {
      emitter.$on('query', (event) => {
        this.logger.debug({ durationMs: event.duration, params: event.params }, event.query);
      });
    }
  }
}

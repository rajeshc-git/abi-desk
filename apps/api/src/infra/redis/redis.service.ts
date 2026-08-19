import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { type Logger } from 'pino';
import { AppConfig } from '../../config/app-config';
import { PINO_LOGGER } from '../../common/logging/logging.module';

/**
 * Shared Redis connection.
 *
 * `maxRetriesPerRequest: null` is required by BullMQ (it manages its own
 * blocking commands and will not tolerate ioredis aborting them), so the setting
 * is applied here rather than being rediscovered when the queue layer lands.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  readonly client: Redis;
  private readonly logger: Logger;

  constructor(config: AppConfig, @Inject(PINO_LOGGER) rootLogger: Logger) {
    this.logger = rootLogger.child({ context: 'RedisService' });

    this.client = new Redis(config.redis.url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: true,
      connectionName: `${config.app.name}:${config.app.processRole}`,
      retryStrategy: (attempt) => Math.min(attempt * 200, 5_000),
    });

    this.client.on('error', (error: Error) => {
      // ioredis reconnects on its own; log once per failure without crashing.
      this.logger.warn({ err: error }, 'Redis connection error');
    });

    this.client.on('ready', () => {
      this.logger.info('Redis connection ready');
    });
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    // `quit` drains in-flight commands; `disconnect` would drop them.
    await this.client.quit().catch(() => this.client.disconnect());
    this.logger.info('Redis connection closed');
  }

  async ping(): Promise<void> {
    const reply = await this.client.ping();
    if (reply !== 'PONG') {
      throw new Error(`Unexpected PING reply: ${reply}`);
    }
  }
}

import { NestFactory } from '@nestjs/core';
import { type Logger } from 'pino';
import { AppModule } from '../app.module';
import { NestPinoLogger } from '../common/logging/nest-pino.logger';
import { type Env } from '../config/env.schema';

/**
 * Boots the background worker.
 *
 * Same module graph, same image, no HTTP listener - selected with
 * `PROCESS_ROLE=worker`. Running one image in two roles means the worker cannot
 * drift out of sync with the API's domain logic, which is the usual failure mode
 * when queue consumers live in a separate service.
 *
 * The process stays alive because the Redis connection holds the event loop open;
 * queue processors are registered by the modules that own them.
 */
export async function bootstrapWorker(env: Env, logger: Logger): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule.register(env, logger), {
    logger: new NestPinoLogger(logger),
    bufferLogs: true,
  });

  app.enableShutdownHooks();

  logger.info({ role: env.PROCESS_ROLE }, 'ABI Desk worker started');
}

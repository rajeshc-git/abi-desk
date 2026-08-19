import { type DynamicModule, Global, Module } from '@nestjs/common';
import { type Logger } from 'pino';

/** DI token for the process-wide pino instance. */
export const PINO_LOGGER = Symbol('PINO_LOGGER');

/**
 * Publishes the shared pino logger to the DI container.
 *
 * Services that need to log outside of a request (workers, lifecycle hooks)
 * inject this and derive a child logger with `.child({ context: 'MyService' })`.
 * Request-scoped logging should prefer `request.log`, which already carries the
 * correlation id.
 */
@Global()
@Module({})
export class LoggingModule {
  static forRoot(logger: Logger): DynamicModule {
    return {
      module: LoggingModule,
      providers: [{ provide: PINO_LOGGER, useValue: logger }],
      exports: [PINO_LOGGER],
    };
  }
}

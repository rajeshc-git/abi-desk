import { type LoggerService, type LogLevel } from '@nestjs/common';
import { type Logger } from 'pino';

/**
 * Adapts Nest's `LoggerService` onto the shared pino instance.
 *
 * Without this, Nest's own lifecycle messages would go to stdout as unstructured
 * text while everything else emitted JSON - which breaks log ingestion the first
 * time you need to grep production.
 */
export class NestPinoLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...optional: unknown[]): void {
    this.write('info', message, optional);
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.write('error', message, optional);
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.write('warn', message, optional);
  }

  debug(message: unknown, ...optional: unknown[]): void {
    this.write('debug', message, optional);
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    this.write('trace', message, optional);
  }

  fatal(message: unknown, ...optional: unknown[]): void {
    this.write('fatal', message, optional);
  }

  setLogLevels?(_levels: LogLevel[]): void {
    // Level is owned by configuration (LOG_LEVEL), not by Nest.
  }

  private write(
    level: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    message: unknown,
    optional: unknown[],
  ): void {
    // Nest passes the emitting class name as the last vararg.
    const context =
      optional.length > 0 && typeof optional.at(-1) === 'string'
        ? (optional.at(-1) as string)
        : undefined;

    const stack = optional.find(
      (candidate): candidate is string =>
        typeof candidate === 'string' && candidate.includes('\n    at '),
    );

    const bindings: Record<string, unknown> = {};
    if (context) bindings.context = context;
    if (stack) bindings.stack = stack;

    if (message instanceof Error) {
      this.logger[level]({ ...bindings, err: message }, message.message);
      return;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger[level]({ ...bindings, ...message }, undefined);
      return;
    }

    this.logger[level](bindings, String(message));
  }
}

import { randomUUID } from 'node:crypto';
import { pino, type Logger, type LoggerOptions } from 'pino';
import { type Env } from '../../config/env.schema';

/**
 * Fields that must never reach a log sink, in any environment.
 *
 * Diagnostics bundles from the widget are scrubbed separately in the ingestion
 * path; this list covers the transport layer (headers, cookies, tokens).
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'req.headers["x-abidesk-signature"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.accessToken',
  '*.refreshToken',
  '*.clientSecret',
  '*.secret',
  '*.apiKey',
  '*.authorization',
];

/**
 * Builds the single pino instance used by both Fastify (access logs, per-request
 * child loggers) and Nest (framework/application logs).
 *
 * Sharing one instance is what keeps `reqId` correlation intact end-to-end: an
 * exception logged by the global filter carries the same id as the access log
 * line for that request.
 */
export function createLogger(env: Env): Logger {
  const options: LoggerOptions = {
    level: env.LOG_LEVEL,
    name: env.APP_NAME,
    base: {
      service: env.APP_NAME,
      role: env.PROCESS_ROLE,
      version: env.APP_VERSION,
      env: env.NODE_ENV,
    },
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    formatters: {
      // Emit `level: "info"` rather than `level: 30`; log aggregators prefer it.
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers: {
      req: (request: {
        id?: string;
        method?: string;
        url?: string;
        headers?: Record<string, unknown>;
      }) => ({
        id: request.id,
        method: request.method,
        url: request.url,
        userAgent: request.headers?.['user-agent'],
      }),
      res: (reply: { statusCode?: number }) => ({ statusCode: reply.statusCode }),
    },
  };

  if (env.LOG_PRETTY) {
    return pino({
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname,service,version,env,role',
          singleLine: false,
        },
      },
    });
  }

  return pino(options);
}

/**
 * Correlation id strategy: honour an inbound `x-request-id` (so a trace survives
 * the console -> API hop) and otherwise mint a UUID.
 */
export function generateRequestId(headers: Record<string, unknown> | undefined): string {
  const inbound = headers?.['x-request-id'];
  if (typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 200) {
    return inbound;
  }
  return randomUUID();
}

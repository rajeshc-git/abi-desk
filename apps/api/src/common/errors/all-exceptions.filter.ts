import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app-config';
import { PROBLEM_CONTENT_TYPE } from './problem-details';
import { toProblemDetails } from './to-problem-details';

/**
 * Terminal exception handler.
 *
 * Responsibilities, in order:
 *  1. turn the throwable into an RFC 7807 body,
 *  2. log it at a severity proportional to the status (5xx = error, 4xx = warn),
 *  3. reply with `application/problem+json` and echo the correlation id.
 *
 * Logging happens through the request-scoped Fastify logger so the entry carries
 * the same `reqId` as the access log line.
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly config: AppConfig) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const request = http.getRequest<FastifyRequest>();
    const reply = http.getResponse<FastifyReply>();

    const requestId = typeof request?.id === 'string' ? request.id : undefined;

    const problem = toProblemDetails(exception, {
      instance: request?.url,
      requestId,
      exposeInternalDetail: !this.config.isProduction,
    });

    const logger = request?.log;
    if (logger) {
      const payload = {
        err: exception instanceof Error ? exception : new Error(String(exception)),
        status: problem.status,
        code: problem.code,
        method: request.method,
        url: request.url,
        ...(exception instanceof HttpException ? {} : { unexpected: true }),
      };

      if (problem.status >= HttpStatus.INTERNAL_SERVER_ERROR) {
        logger.error(payload, problem.detail ?? problem.title);
      } else {
        logger.warn(payload, problem.detail ?? problem.title);
      }
    }

    if (reply.sent) {
      return;
    }

    void reply
      .status(problem.status)
      .header('content-type', PROBLEM_CONTENT_TYPE)
      .header('x-request-id', requestId ?? '')
      .send(problem);
  }
}

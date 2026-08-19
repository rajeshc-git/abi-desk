import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { catchError, type Observable, tap, throwError } from 'rxjs';
import { AppException } from '../errors/app-exception';
import { AUDIT_METADATA_KEY, type AuditDescriptor } from '../auth/auth.decorators';
import { AuditService } from './audit.service';

/**
 * Records an audit entry for routes marked with `@Audited(...)`.
 *
 * Both outcomes are captured. A refused action is written with `succeeded: false` and
 * the error's stable code, because "who tried to close a ticket they had no rights
 * to" is exactly the question an incident review asks, and most systems only log the
 * successes.
 *
 * Field-level diffs are not produced here - the interceptor cannot know what a
 * service changed. Services that mutate state call `AuditService.diff()` themselves;
 * this covers the "action occurred" record so that no annotated route can be
 * exercised without leaving a trace.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const descriptor = this.reflector.get<AuditDescriptor | undefined>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!descriptor) return next.handle();

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = request.principal;

    const params = (request.params ?? {}) as Record<string, string | undefined>;
    const resourceId = descriptor.idParam ? params[descriptor.idParam] : undefined;

    const base = {
      action: descriptor.action,
      resourceType: descriptor.resourceType,
      resourceId: resourceId ?? null,
      tenantId: principal?.tenantId ?? null,
      actorId: principal?.userId ?? null,
      actorEmail: principal?.email ?? null,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
      requestId: typeof request.id === 'string' ? request.id : null,
      ...(principal?.apiKeyId ? { apiKeyId: principal.apiKeyId } : {}),
    };

    return next.handle().pipe(
      tap(() => {
        // Fire-and-forget: the response must not wait on the audit write, and a
        // failed write is logged inside AuditService rather than surfaced here.
        void this.audit.record({ ...base, succeeded: true });
      }),
      catchError((error: unknown) => {
        void this.audit.record({
          ...base,
          succeeded: false,
          failureCode:
            error instanceof AppException
              ? error.code
              : error instanceof Error
                ? error.name
                : 'UNKNOWN',
        });

        return throwError(() => error);
      }),
    );
  }
}

import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { type FastifyRequest } from 'fastify';
import { from, type Observable, switchMap } from 'rxjs';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';

/**
 * Establishes tenant context around the request handler.
 *
 * ## Ordering
 *
 * Nest runs middleware, then guards, then interceptors, then the handler. That order
 * is what dictates the design here:
 *
 *  - The auth guard runs *before* this and cannot rely on ambient tenant context, so
 *    it does its own lookups under an explicit RLS bypass.
 *  - The RBAC guard also runs before this, which is why the principal carries a
 *    fully resolved permission set - it needs no database access at all.
 *  - Everything from the handler down runs inside the tenant scope established here,
 *    so services never think about tenancy.
 *
 * ## Platform administrators
 *
 * A platform admin has no tenant of their own. They operate with an explicit bypass
 * so cross-tenant support work is possible, and every such request is identifiable
 * in the audit log by its actor.
 */
@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  constructor(private readonly contexts: TenantContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = request.principal;
    const requestId = typeof request.id === 'string' ? request.id : undefined;

    // Unauthenticated (public) route: no tenant scope. RLS then makes every
    // tenant-scoped table return nothing, which is the correct default.
    if (!principal) {
      return from(this.contexts.runWithoutContext(async () => firstValueFromHandler(next))).pipe(
        switchMap((value) => value as Observable<unknown>),
      );
    }

    if (principal.isPlatformAdmin && !principal.tenantId) {
      return from(
        this.contexts.runWithBypass(
          'platform-admin',
          { userId: principal.userId, ...(requestId ? { requestId } : {}) },
          async () => firstValueFromHandler(next),
        ),
      ).pipe(switchMap((value) => value as Observable<unknown>));
    }

    if (!principal.tenantId) {
      return from(this.contexts.runWithoutContext(async () => firstValueFromHandler(next))).pipe(
        switchMap((value) => value as Observable<unknown>),
      );
    }

    return from(
      this.contexts.runWithTenant(
        principal.tenantId,
        { userId: principal.userId, ...(requestId ? { requestId } : {}) },
        async () => firstValueFromHandler(next),
      ),
    ).pipe(switchMap((value) => value as Observable<unknown>));
  }
}

/**
 * Invokes the handler while the AsyncLocalStorage scope is open.
 *
 * The handler is *called* synchronously inside the scope but returns an Observable
 * that is subscribed to later, outside it. Returning the Observable itself would
 * mean the scope had already closed by the time any database call ran - which is the
 * subtle way this kind of interceptor silently stops working.
 */
async function firstValueFromHandler(next: CallHandler): Promise<Observable<unknown>> {
  return next.handle();
}

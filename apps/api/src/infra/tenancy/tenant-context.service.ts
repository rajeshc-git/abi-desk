import { Injectable } from '@nestjs/common';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import {
  createTenantContext,
  getTenantContext,
  isUuid,
  type TenantContext,
  tenantContextStorage,
} from './tenant-context';

/**
 * Establishes and reads the ambient tenancy context.
 *
 * Every request path enters through `runWithTenant` (or `runWithBypass` for the
 * narrow set of tenant-agnostic operations); everything downstream reads it.
 */
@Injectable()
export class TenantContextService {
  /** Current context, or undefined outside any established scope. */
  peek(): TenantContext | undefined {
    return getTenantContext();
  }

  /**
   * Current tenant id, throwing if none is established.
   *
   * Used by code that genuinely cannot proceed without a tenant. The error is a
   * 400-class problem rather than a 500 because it almost always means the caller
   * omitted tenant identification.
   */
  requireTenantId(): string {
    const context = getTenantContext();

    if (!context?.tenantId) {
      throw new AppException(
        ErrorCode.TENANT_CONTEXT_MISSING,
        400,
        'This operation requires a tenant context.',
      );
    }

    return context.tenantId;
  }

  requireUserId(): string {
    const context = getTenantContext();

    if (!context?.userId) {
      throw AppException.unauthenticated();
    }

    return context.userId;
  }

  /** Runs `fn` scoped to a tenant. */
  runWithTenant<T>(
    tenantId: string,
    details: Omit<Partial<TenantContext>, 'tenantId' | 'bypassRls'>,
    fn: () => Promise<T>,
  ): Promise<T> {
    if (!isUuid(tenantId)) {
      // Caught here rather than at the database boundary so the message names the
      // real problem instead of surfacing a Postgres cast error.
      throw AppException.badRequest(`'${tenantId}' is not a valid tenant identifier.`);
    }

    return tenantContextStorage.run(
      createTenantContext({ ...details, tenantId, bypassRls: false }),
      fn,
    );
  }

  /**
   * Runs `fn` without tenant filtering.
   *
   * Reserved for: authentication (resolving a user before their tenant is known),
   * platform administration, and cross-tenant background jobs. Every call site
   * should be obvious from reading it - if it is not, the call is probably wrong.
   */
  runWithBypass<T>(
    reason: 'authentication' | 'platform-admin' | 'background-job',
    details: Omit<Partial<TenantContext>, 'bypassRls'>,
    fn: () => Promise<T>,
  ): Promise<T> {
    return tenantContextStorage.run(
      createTenantContext({ ...details, bypassRls: true, ...(reason ? {} : {}) }),
      fn,
    );
  }

  /** Runs `fn` with no context at all: only non-tenant tables are reachable. */
  runWithoutContext<T>(fn: () => Promise<T>): Promise<T> {
    return tenantContextStorage.run(createTenantContext(), fn);
  }
}

import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { satisfies, type PermissionRequirement } from '@abi-desk/rbac';
import { type FastifyRequest } from 'fastify';
import { AppException } from '../errors/app-exception';
import { PERMISSIONS_METADATA_KEY } from './auth.decorators';

/**
 * Enforces `@RequirePermission(...)` on a route.
 *
 * Runs after `JwtAuthGuard`, and needs no database access: the principal already
 * carries a fully resolved permission set (resolved once per request and cached), so
 * this is a set membership test. That matters because guards execute before the
 * tenant-context interceptor opens the AsyncLocalStorage scope - a guard that queried
 * here would have no tenant scope to query in.
 *
 * Note what this guard does *not* do: it decides whether an endpoint may be called,
 * not which rows it may return. Row visibility is a query concern and lives in
 * `resolveTicketScope`. Relying on an endpoint guard alone would still let a caller
 * holding only `ticket:read:own` fetch another user's ticket by id.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const requirement = this.reflector.getAllAndOverride<PermissionRequirement | undefined>(
      PERMISSIONS_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No requirement declared: this guard has no opinion. Authentication itself is
    // already enforced by JwtAuthGuard.
    if (!requirement || requirement.permissions.length === 0) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = request.principal;

    if (!principal) {
      // A permission-gated route reached without a principal means it was also marked
      // @Public(), which is a wiring mistake rather than a client error.
      throw AppException.unauthenticated(
        'This route requires a permission but no authenticated caller was resolved.',
      );
    }

    const allowed = satisfies(
      {
        userId: principal.userId,
        tenantId: principal.tenantId,
        permissions: principal.permissions,
        isPlatformAdmin: principal.isPlatformAdmin,
        brandId: principal.brandId ?? null,
      },
      requirement,
    );

    if (!allowed) {
      const missing = requirement.permissions.filter(
        (permission) => !principal.permissions.has(permission),
      );

      // Naming the missing permission is deliberate: it is not sensitive (the
      // catalogue is published), and without it a 403 is undebuggable for the
      // integrator. The audit entry records the denial separately.
      throw AppException.permissionDenied(
        requirement.mode === 'all'
          ? `Missing required permission(s): ${missing.join(', ')}.`
          : `Requires at least one of: ${requirement.permissions.join(', ')}.`,
        {
          userId: principal.userId,
          tenantId: principal.tenantId,
          roles: principal.roles,
          required: requirement.permissions,
          mode: requirement.mode,
        },
      );
    }

    return true;
  }
}

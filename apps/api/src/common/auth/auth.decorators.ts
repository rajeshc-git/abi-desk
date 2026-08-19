import {
  applyDecorators,
  createParamDecorator,
  type ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { type PermissionKey } from '@abi-desk/rbac';
import { type FastifyRequest } from 'fastify';
import { AppException } from '../errors/app-exception';
import { type AuthenticatedPrincipal } from '../../modules/auth/auth.types';

/** Metadata key marking a route as reachable without authentication. */
export const IS_PUBLIC_KEY = 'auth:public';

/**
 * Opts a route out of authentication.
 *
 * Authentication is on by default (the guard is global), so forgetting a decorator
 * fails closed - an endpoint you neglected to think about is protected, not open.
 * Making a route public therefore has to be an explicit, reviewable act.
 */
export const Public = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(IS_PUBLIC_KEY, true));

/** Metadata key for routes that skip CSRF checks (e.g. token-only endpoints). */
export const SKIP_CSRF_KEY = 'auth:skip-csrf';

export const SkipCsrf = (): MethodDecorator & ClassDecorator =>
  applyDecorators(SetMetadata(SKIP_CSRF_KEY, true));

/** Metadata key carrying a route's permission requirement. */
export const PERMISSIONS_METADATA_KEY = 'auth:permissions';

/**
 * Requires every listed permission.
 *
 * The strings come from `@abi-desk/rbac`'s catalogue and are checked against it by
 * the conformance test, so a typo here fails the build rather than silently
 * permitting the route.
 */
export const RequirePermission = (
  ...permissions: [PermissionKey, ...PermissionKey[]]
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(PERMISSIONS_METADATA_KEY, { permissions, mode: 'all' } satisfies {
      permissions: PermissionKey[];
      mode: 'all';
    }),
  );

/** Requires at least one of the listed permissions. */
export const RequireAnyPermission = (
  ...permissions: [PermissionKey, ...PermissionKey[]]
): MethodDecorator & ClassDecorator =>
  applyDecorators(
    SetMetadata(PERMISSIONS_METADATA_KEY, { permissions, mode: 'any' } satisfies {
      permissions: PermissionKey[];
      mode: 'any';
    }),
  );

/** Metadata key describing what a route change should be audited as. */
export const AUDIT_METADATA_KEY = 'audit:descriptor';

export interface AuditDescriptor {
  /** `module.action`, e.g. `ticket.status_changed`. */
  action: string;
  /** Resource type the action targets, e.g. `ticket`. */
  resourceType: string;
  /** Route parameter holding the resource id, when there is one. */
  idParam?: string;
}

/**
 * Marks a route for automatic audit capture.
 *
 * Declared per route rather than inferred from the HTTP verb because an audit trail
 * is read by people investigating incidents, and `POST /tickets/:id/escalate` needs
 * to appear as `ticket.escalated`, not as "a POST happened".
 */
export const Audited = (descriptor: AuditDescriptor): MethodDecorator =>
  SetMetadata(AUDIT_METADATA_KEY, descriptor);

/**
 * Injects the authenticated principal.
 *
 * Throws rather than returning undefined on an unauthenticated route: a handler that
 * asks for the caller has a bug if there isn't one, and a silent `undefined` would
 * surface later as an unrelated null-reference error.
 */
export const CurrentUser = createParamDecorator(
  (property: keyof AuthenticatedPrincipal | undefined, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const principal = request.principal;

    if (!principal) {
      throw AppException.unauthenticated(
        'This route requires an authenticated caller but none was resolved.',
      );
    }

    return property ? principal[property] : principal;
  },
);

/** Injects the request's correlation id. */
export const RequestId = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();
  return typeof request.id === 'string' ? request.id : undefined;
});

/**
 * Injects the caller's network origin (IP and User-Agent).
 *
 * Read from Fastify's `ip`, which honours `X-Forwarded-For` only because
 * `trustProxy` is configured - otherwise a client could spoof its own address and
 * poison the audit trail.
 */
export const CallerOrigin = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<FastifyRequest>();

  return {
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  };
});

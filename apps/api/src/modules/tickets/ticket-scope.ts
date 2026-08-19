import { type Prisma } from '@abi-desk/db';
import { type AccessScope, type PolicySubject, resolveTicketScope } from '@abi-desk/rbac';
import { type AuthenticatedPrincipal } from '../auth/auth.types';

/**
 * Translates a policy `AccessScope` into a Prisma filter.
 *
 * This is the layer that turns "View Own Tickets" versus "View All Tenant Tickets"
 * from an endpoint permission into a *row* restriction. Without it, a caller holding
 * only `ticket:read:own` could still pass the endpoint guard and then fetch any
 * ticket by id - the guard answers "may you call this?", not "which rows may you
 * see?".
 *
 * It composes with, rather than replaces, PostgreSQL Row Level Security. RLS already
 * confines every query to the caller's tenant; this narrows further to ownership or
 * brand. Both layers are kept because they fail differently: RLS cannot express
 * "only tickets you reported", and an application filter can be forgotten.
 */
export function ticketScopeFilter(scope: AccessScope): Prisma.TicketWhereInput | null {
  switch (scope.kind) {
    case 'all':
      // Platform operators. RLS is bypassed for them explicitly and audibly.
      return {};

    case 'tenant':
      return { tenantId: scope.tenantId };

    case 'brand':
      // A brand-restricted agent: multi-brand support means an agent hired for one
      // product line must not see the other's tickets.
      return { tenantId: scope.tenantId, brandId: scope.brandId };

    case 'own':
      return { tenantId: scope.tenantId, requesterId: scope.userId };

    case 'none':
      // Null rather than an impossible filter, so callers must decide explicitly
      // whether that means 404 or an empty list. Returning `{}` here would be a
      // catastrophic default.
      return null;
  }
}

/** Adapts the request principal to the shape the policy layer expects. */
export function toPolicySubject(principal: AuthenticatedPrincipal): PolicySubject {
  return {
    userId: principal.userId,
    tenantId: principal.tenantId,
    permissions: principal.permissions,
    isPlatformAdmin: principal.isPlatformAdmin,
    brandId: principal.brandId ?? null,
  };
}

/** Convenience: principal straight to a Prisma filter. */
export function ticketFilterFor(principal: AuthenticatedPrincipal): Prisma.TicketWhereInput | null {
  return ticketScopeFilter(resolveTicketScope(toPolicySubject(principal)));
}

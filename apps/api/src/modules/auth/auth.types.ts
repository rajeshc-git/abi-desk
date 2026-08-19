import { type RoleKey } from '@abi-desk/rbac';

/** How the caller authenticated. Drives cookie handling and audit provenance. */
export type AuthMethod = 'password' | 'refresh' | 'magic-link' | 'invitation' | 'sso' | 'api-key';

/** Where tokens are delivered. */
export type SessionMode = 'token' | 'cookie';

export interface CallerContext {
  ipAddress?: string;
  userAgent?: string;
  originHeader?: string;
  referer?: string;
  host?: string;
}

/**
 * Claims carried in the access token.
 *
 * Short names because a JWT travels on every request. Roles are included but
 * permissions are not: 63 permission strings would bloat every header, and a token
 * minted before a permission change would keep asserting stale authority.
 * Permissions are resolved per request (and cached) from the database instead.
 */
export interface AccessTokenClaims {
  /** User id. */
  sub: string;
  /** Tenant id; null for platform-level users. */
  tid: string | null;
  /** Session id - the specific refresh-token row this access token descends from. */
  sid: string;
  /** Session family id. Revoking the family invalidates every descendant. */
  fid: string;
  /** STAFF or CUSTOMER, so the console and portal can branch without a lookup. */
  knd: 'STAFF' | 'CUSTOMER' | 'SYSTEM';
  /** Role keys held by the user. */
  rls: RoleKey[];
  /** Brand the session is scoped to, for brand-restricted agents. */
  brd?: string;
}

/** The resolved caller, attached to the request by the auth guard. */
export interface AuthenticatedPrincipal {
  userId: string;
  tenantId: string | null;
  sessionId: string;
  familyId: string;
  email: string;
  fullName: string;
  kind: 'STAFF' | 'CUSTOMER' | 'SYSTEM';
  roles: RoleKey[];
  /** Effective permission keys after tenant overrides. */
  permissions: ReadonlySet<string>;
  brandId?: string;
  /** Set when authenticated with an API key rather than a session. */
  apiKeyId?: string;
  isPlatformAdmin: boolean;
}

/** What a successful authentication returns. */
export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
  tokenType: 'Bearer';
}

export interface AuthenticatedResult {
  tokens: IssuedTokens;
  principal: AuthenticatedPrincipal;
  /** Present only in cookie mode: the double-submit CSRF token. */
  csrfToken?: string;
}

// Fastify request augmentation, so downstream handlers see a typed principal.
declare module 'fastify' {
  interface FastifyRequest {
    principal?: AuthenticatedPrincipal;
  }
}

// Side-effect import: @fastify/cookie augments FastifyReply with setCookie and
// clearCookie. Without it TypeScript does not know those methods exist, even though
// the plugin adds them at runtime.
import '@fastify/cookie';
import { type FastifyReply } from 'fastify';
import { type AppConfig } from '../../config/app-config';

export const ACCESS_TOKEN_COOKIE = 'abidesk_at';
export const REFRESH_TOKEN_COOKIE = 'abidesk_rt';
export const CSRF_COOKIE = 'abidesk_csrf';
export const CSRF_HEADER = 'x-csrf-token';

/**
 * Cookie handling for the browser console.
 *
 * Why cookies at all, when the API is token-based: storing an access token in
 * `localStorage` makes it readable by any script that gets injected into the page,
 * and every XSS becomes a full account takeover with a 30-day refresh token
 * attached. `httpOnly` cookies are unreadable from JavaScript, which contains the
 * damage.
 *
 * The cost of that choice is CSRF exposure, since browsers attach cookies
 * automatically. That is addressed by `SameSite=Lax` plus a double-submit token
 * (see `CsrfGuard`) - the two together, because `SameSite` alone does not cover
 * same-site subdomain attacks and older browsers.
 *
 * Programmatic clients (widget, integrations, CLI) use bearer tokens and never see
 * any of this.
 */
export function setAuthCookies(
  reply: FastifyReply,
  config: AppConfig,
  tokens: { accessToken: string; refreshToken: string; expiresIn: number },
  csrfToken: string,
): void {
  const secure = config.cookies.secure;
  const domain = config.cookies.domain;

  const base = {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/',
    ...(domain ? { domain } : {}),
  };

  reply.setCookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    maxAge: tokens.expiresIn,
  });

  // Scoped to the auth path: the refresh token is only ever presented to the
  // refresh and logout endpoints, so there is no reason to attach it to every
  // request and widen its exposure.
  reply.setCookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    path: '/api/v1/auth',
    maxAge: config.auth.refreshTtl,
  });

  // Deliberately readable by JavaScript: the console has to echo it back in a
  // header, which is precisely what proves the request came from our own page
  // rather than from a cross-site form post.
  reply.setCookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure,
    sameSite: 'lax',
    path: '/',
    ...(domain ? { domain } : {}),
    maxAge: config.auth.refreshTtl,
  });
}

export function clearAuthCookies(reply: FastifyReply, config: AppConfig): void {
  const domain = config.cookies.domain;
  const options = { path: '/', ...(domain ? { domain } : {}) };

  reply.clearCookie(ACCESS_TOKEN_COOKIE, options);
  reply.clearCookie(REFRESH_TOKEN_COOKIE, { path: '/api/v1/auth', ...(domain ? { domain } : {}) });
  reply.clearCookie(CSRF_COOKIE, options);
}

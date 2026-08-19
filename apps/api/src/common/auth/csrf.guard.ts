import { createHash, timingSafeEqual } from 'node:crypto';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { AppException } from '../errors/app-exception';
import { SKIP_CSRF_KEY } from './auth.decorators';
import { ACCESS_TOKEN_COOKIE, CSRF_COOKIE, CSRF_HEADER } from './cookies';

/** Methods that cannot change state, so cannot be CSRF targets. */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS', 'TRACE']);

/**
 * Double-submit CSRF protection for cookie-authenticated requests.
 *
 * ## Why this is needed
 *
 * Browsers attach cookies to cross-site requests automatically. Without a check, any
 * page on the internet could POST to this API and the browser would helpfully supply
 * the victim's session cookie.
 *
 * ## Why not rely on SameSite alone
 *
 * `SameSite=Lax` blocks the common case, but it is not sufficient on its own: it
 * treats all subdomains of a site as same-site, so an XSS or takeover on any
 * subdomain sharing the cookie domain can still forge requests. Defence in depth is
 * cheap here.
 *
 * ## The check
 *
 * The CSRF token exists in two places: a JavaScript-readable cookie and a request
 * header the client sets explicitly. An attacker on another origin can cause the
 * cookie to be sent but cannot read it (same-origin policy) and therefore cannot
 * populate the header. Comparison is constant-time.
 *
 * ## What is exempt
 *
 * Requests authenticated by a bearer token. A bearer token is never attached
 * automatically by the browser, so there is nothing to forge - and requiring CSRF
 * headers from server-to-server API clients would be pointless friction.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (skip) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();

    if (SAFE_METHODS.has(request.method.toUpperCase())) return true;

    // Bearer-authenticated callers are not exposed to CSRF.
    const authorization = request.headers.authorization;
    if (typeof authorization === 'string' && authorization.length > 0) return true;

    const cookies = (
      request as FastifyRequest & {
        cookies?: Record<string, string | undefined>;
      }
    ).cookies;

    // No session cookie means no ambient credential, so nothing to protect.
    if (!cookies?.[ACCESS_TOKEN_COOKIE]) return true;

    const cookieToken = cookies[CSRF_COOKIE];
    const headerToken = request.headers[CSRF_HEADER];

    if (!cookieToken || typeof headerToken !== 'string' || headerToken.length === 0) {
      throw AppException.permissionDenied(
        `Cookie-authenticated requests must include the ${CSRF_HEADER} header.`,
        { method: request.method, url: request.url },
      );
    }

    if (!constantTimeEquals(cookieToken, headerToken)) {
      throw AppException.permissionDenied('CSRF token mismatch.', {
        method: request.method,
        url: request.url,
      });
    }

    return true;
  }
}

/**
 * Length-independent constant-time comparison.
 *
 * `timingSafeEqual` throws on length mismatch, which would itself leak length, so
 * the values are folded into fixed-size digests first.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest();
  const digestB = createHash('sha256').update(b, 'utf8').digest();

  return timingSafeEqual(digestA, digestB);
}

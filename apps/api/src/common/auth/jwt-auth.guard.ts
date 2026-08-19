import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { AppException } from '../errors/app-exception';
import { ErrorCode } from '../errors/error-codes';
import { AuthService } from '../../modules/auth/auth.service';
import { TokenService } from '../../modules/auth/token.service';
import { ACCESS_TOKEN_COOKIE } from './cookies';
import { IS_PUBLIC_KEY } from './auth.decorators';

/**
 * Global authentication guard.
 *
 * Accepts a bearer token or - for the browser console - an httpOnly cookie. The
 * bearer header wins when both are present, so a programmatic caller is never
 * accidentally authenticated as whoever happens to be logged into the browser.
 *
 * Registered globally so that authentication is the default and `@Public()` is the
 * exception. The inverse (opt-in protection) means every new endpoint is one
 * forgotten decorator away from being open.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Only HTTP is guarded here; the WebSocket gateway authenticates on handshake.
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = extractToken(request);

    if (isPublic) {
      // Public routes still resolve a principal when one is offered, so endpoints
      // like ticket creation can behave differently for a signed-in customer
      // without needing a second route.
      if (token) {
        try {
          const claims = await this.tokens.verifyAccessToken(token);
          request.principal = await this.auth.resolvePrincipal(claims);
        } catch {
          // An invalid token on a public route is simply ignored.
        }
      }
      return true;
    }

    if (!token) {
      const widgetPublicKey = request.headers['x-widget-public-key'];
      if (typeof widgetPublicKey === 'string' && widgetPublicKey.length > 0) {
        const origin =
          typeof request.headers.origin === 'string' ? request.headers.origin : undefined;
        const clientIp =
          request.ip || (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim();

        const widgetUserEmail = request.headers['x-widget-user-email'];
        const emailStr = typeof widgetUserEmail === 'string' ? widgetUserEmail.trim() : undefined;

        const widgetUserToken = request.headers['x-widget-user-token'];
        const tokenStr = typeof widgetUserToken === 'string' ? widgetUserToken.trim() : undefined;

        try {
          request.principal = await this.auth.resolveWidgetPrincipal(
            widgetPublicKey,
            origin,
            clientIp,
            emailStr,
            tokenStr,
            request.method,
            request.url,
          );
          return true;
        } catch (err) {
          if (err instanceof AppException) throw err;
          // Unexpected errors fall through to the generic unauthenticated message
        }
      }

      throw AppException.unauthenticated(
        'Provide an access token via the Authorization header or session cookie.',
      );
    }

    const claims = await this.tokens.verifyAccessToken(token);
    request.principal = await this.auth.resolvePrincipal(claims);

    return true;
  }
}

/**
 * Pulls the access token from the request.
 *
 * Header first, then cookie. The scheme comparison is case-insensitive because
 * clients disagree about `Bearer` vs `bearer`, and rejecting one of them produces a
 * baffling 401.
 */
function extractToken(request: FastifyRequest): string | undefined {
  const header = request.headers.authorization;

  if (typeof header === 'string' && header.length > 0) {
    const [scheme, value] = header.split(' ');

    if (scheme?.toLowerCase() === 'bearer' && value) {
      return value.trim();
    }

    // A malformed Authorization header is a client bug worth naming, rather than
    // silently falling through to the cookie and reporting "no token".
    throw new AppException(
      ErrorCode.TOKEN_INVALID,
      401,
      'Authorization header must use the Bearer scheme.',
    );
  }

  const cookies = (request as FastifyRequest & { cookies?: Record<string, string | undefined> })
    .cookies;

  return cookies?.[ACCESS_TOKEN_COOKIE];
}

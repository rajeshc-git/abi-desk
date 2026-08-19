import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Res,
} from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { CallerOrigin, CurrentUser, Public, SkipCsrf } from '../../common/auth/auth.decorators';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE, setAuthCookies } from '../../common/auth/cookies';
import { AppException } from '../../common/errors/app-exception';
import { AppConfig } from '../../config/app-config';
import { AuthService } from './auth.service';
import {
  AcceptInvitationDto,
  ChangePasswordDto,
  ForgotPasswordDto,
  LoginDto,
  MagicLinkRedeemDto,
  MagicLinkRequestDto,
  RefreshDto,
  RegisterOrganizationDto,
  ResetPasswordDto,
  SendWidgetOtpDto,
  SessionIdParamDto,
  UpdatePreferencesDto,
  VerifyRegisterOtpDto,
  VerifyWidgetOtpDto,
} from './auth.dto';
import { type AuthenticatedPrincipal, type AuthenticatedResult } from './auth.types';

interface CallerContext {
  ipAddress: string;
  userAgent?: string;
}

/**
 * Authentication endpoints.
 *
 * Everything here is `@Public()` except the session-management routes, because these
 * are the endpoints you reach *before* you have a token. CSRF is skipped on the
 * pre-session routes for the same reason: there is no ambient cookie credential to
 * forge yet.
 */
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: AppConfig,
  ) {}

  // =========================================================================
  // Sign in
  // =========================================================================

  @Public()
  @SkipCsrf()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @CallerOrigin() origin: CallerContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.loginWithPassword({
      email: dto.email,
      password: dto.password,
      ...(dto.tenantSlug ? { tenantSlug: dto.tenantSlug } : {}),
      origin,
    });

    return await this.deliver(result, dto.sessionMode, reply);
  }

  @Public()
  @SkipCsrf()
  @Post('register/request-otp')
  @HttpCode(HttpStatus.OK)
  async requestRegisterOtp(
    @Body() dto: RegisterOrganizationDto,
    @CallerOrigin() origin: CallerContext,
  ) {
    return this.auth.requestRegistrationOtp({
      companyName: dto.companyName,
      fullName: dto.fullName,
      email: dto.email,
      password: dto.password,
      origin,
    });
  }

  @Public()
  @SkipCsrf()
  @Post('register/verify-otp')
  @HttpCode(HttpStatus.CREATED)
  async verifyRegisterOtp(
    @Body() dto: VerifyRegisterOtpDto,
    @CallerOrigin() origin: CallerContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.verifyRegistrationOtp({
      email: dto.email,
      otp: dto.otp,
      origin,
    });

    return await this.deliver(result, dto.sessionMode, reply);
  }

  /**
   * Exchanges a refresh token for a new pair.
   *
   * Reads the token from the body or the cookie. Presenting an already-used token
   * revokes the entire session family - see `SessionService.rotate`.
   */
  @Public()
  @SkipCsrf()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @CallerOrigin() origin: CallerContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const cookies = (
      reply.request as FastifyRequest & {
        cookies?: Record<string, string | undefined>;
      }
    ).cookies;

    const token = dto.refreshToken ?? cookies?.[REFRESH_TOKEN_COOKIE];

    if (!token) {
      throw AppException.badRequest(
        'Provide a refresh token in the request body or the session cookie.',
      );
    }

    const result = await this.auth.refresh(token, origin);

    // Mode is inferred when the token came from a cookie: a browser that
    // authenticated with cookies should keep doing so.
    const mode = dto.refreshToken ? dto.sessionMode : 'cookie';

    return await this.deliver(result, mode, reply);
  }

  @Public()
  @SkipCsrf()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    const request = reply.request as FastifyRequest & {
      cookies?: Record<string, string | undefined>;
    };

    // Logout must succeed even with an expired access token, so the family is
    // derived from the principal when present and from the refresh cookie otherwise.
    const principal = request.principal;

    if (principal) {
      await this.auth.logout(principal.familyId);
    } else {
      const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE];

      if (refreshToken) {
        // Rotating would issue new tokens; instead resolve the family and revoke it.
        await this.auth.logoutByRefreshToken(refreshToken);
      }
    }

    clearAuthCookies(reply, this.config);
  }

  /** Signs out every device for the current user. */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const revoked = await this.auth.logoutEverywhere(principal.userId);
    clearAuthCookies(reply, this.config);
    return { revokedSessions: revoked };
  }

  // =========================================================================
  // Magic link (widget visitors)
  // =========================================================================

  /**
   * Requests a sign-in link.
   *
   * Always 202, whether or not the address is known. Reporting "no such user" here
   * would turn the endpoint into an account-enumeration oracle, and it is reachable
   * from any page hosting the widget.
   */
  @Public()
  @SkipCsrf()
  @Post('magic-link')
  @HttpCode(HttpStatus.ACCEPTED)
  async requestMagicLink(@Body() dto: MagicLinkRequestDto, @CallerOrigin() origin: CallerContext) {
    const { expiresInMinutes } = await this.auth.requestMagicLink({
      email: dto.email,
      widgetPublicKey: dto.widgetPublicKey,
      origin,
    });

    return {
      status: 'accepted',
      message: 'If that address can receive support mail, a sign-in link is on its way.',
      expiresInMinutes,
    };
  }

  @Public()
  @SkipCsrf()
  @Get('widget-config/:publicKey')
  async getWidgetConfig(
    @Param('publicKey') publicKey: string,
    @Headers('origin') origin?: string,
  ) {
    return this.auth.getWidgetConfig(publicKey, origin);
  }

  @Public()
  @SkipCsrf()
  @Post('widget/otp/send')
  @HttpCode(HttpStatus.OK)
  async sendWidgetOtp(@Body() dto: SendWidgetOtpDto) {
    return this.auth.sendWidgetOtp(dto.email, dto.publicKey);
  }

  @Public()
  @SkipCsrf()
  @Post('widget/otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyWidgetOtp(@Body() dto: VerifyWidgetOtpDto) {
    return this.auth.verifyWidgetOtp(dto.email, dto.publicKey, dto.otp);
  }

  @Public()
  @SkipCsrf()
  @Get('widget.js')
  async getWidgetScript(@Res() reply: FastifyReply) {
    const fs = await import('node:fs');
    const path = await import('node:path');

    const pathsToTry = [
      path.join(__dirname, '../../../../../packages/widget/dist/widget.js'),
      path.join(process.cwd(), 'packages/widget/dist/widget.js'),
      path.join(process.cwd(), '../../packages/widget/dist/widget.js'),
    ];

    let filePath = '';
    for (const p of pathsToTry) {
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    }

    if (!filePath) {
      reply.status(404).send('Widget script not found. Run "pnpm build" first.');
      return;
    }

    const fileContent = fs.readFileSync(filePath, 'utf8');
    reply.header('content-type', 'application/javascript').send(fileContent);
  }

  @Public()
  @SkipCsrf()
  @Post('magic-link/redeem')
  @HttpCode(HttpStatus.OK)
  async redeemMagicLink(
    @Body() dto: MagicLinkRedeemDto,
    @CallerOrigin() origin: CallerContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.redeemMagicLink(dto.token, origin);
    return await this.deliver(result, dto.sessionMode, reply);
  }

  // =========================================================================
  // Password reset
  // =========================================================================

  @Public()
  @SkipCsrf()
  @Post('password/forgot')
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(@Body() dto: ForgotPasswordDto, @CallerOrigin() origin: CallerContext) {
    const { expiresInMinutes } = await this.auth.requestPasswordReset({
      email: dto.email,
      ...(dto.tenantSlug ? { tenantSlug: dto.tenantSlug } : {}),
      origin,
    });

    return {
      status: 'accepted',
      message: 'If that account exists, a password reset link is on its way.',
      expiresInMinutes,
    };
  }

  @Public()
  @SkipCsrf()
  @Post('password/reset')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @CallerOrigin() origin: CallerContext,
  ): Promise<void> {
    await this.auth.completePasswordReset({
      token: dto.token,
      password: dto.password,
      origin,
    });
  }

  /** Changes the password of the signed-in user. Signs out all other devices. */
  @Post('password/change')
  @HttpCode(HttpStatus.NO_CONTENT)
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
    @CallerOrigin() origin: CallerContext,
  ): Promise<void> {
    await this.auth.changePassword({
      userId: principal.userId,
      tenantId: principal.tenantId,
      currentPassword: dto.currentPassword,
      newPassword: dto.newPassword,
      origin,
      keepSessionFamilyId: principal.familyId,
    });
  }

  // =========================================================================
  // Invitations
  // =========================================================================

  /** Details for the acceptance screen. Does not consume the invitation. */
  @Public()
  @Get('invitations/:token')
  async describeInvitation(@Param('token') token: string) {
    return this.auth.describeInvitation(token);
  }

  @Public()
  @SkipCsrf()
  @Post('invitations/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvitation(
    @Body() dto: AcceptInvitationDto,
    @CallerOrigin() origin: CallerContext,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const result = await this.auth.acceptInvitation({
      token: dto.token,
      ...(dto.fullName ? { fullName: dto.fullName } : {}),
      ...(dto.password ? { password: dto.password } : {}),
      origin,
    });

    return await this.deliver(result, dto.sessionMode, reply);
  }

  // =========================================================================
  // Current session
  // =========================================================================

  /**
   * The signed-in user, their roles, and their effective permissions.
   *
   * The console renders navigation from `permissions`, so this is the contract that
   * keeps the UI and the server's authorization decisions in agreement - a button
   * that appears but 403s is a bug this prevents.
   */
  @Get('me')
  async me(@CurrentUser() principal: AuthenticatedPrincipal) {
    const [tenantName, preferences] = await Promise.all([
      this.auth.getTenantName(principal.tenantId),
      this.auth.getUserPreferences(principal.userId),
    ]);
    return {
      user: {
        id: principal.userId,
        email: principal.email,
        fullName: principal.fullName,
        kind: principal.kind,
        preferences,
      },
      tenantId: principal.tenantId,
      tenantName,
      brandId: principal.brandId ?? null,
      roles: principal.roles,
      permissions: [...principal.permissions].sort(),
      isPlatformAdmin: principal.isPlatformAdmin,
      session: { id: principal.sessionId, familyId: principal.familyId },
    };
  }

  /** Personal preferences (e.g. personal theme accent) for the signed-in user. */
  @Patch('me/preferences')
  async updatePreferences(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.auth.updateUserPreferences(principal.userId, dto);
  }

  /** Devices with a live session, so a user can spot one they do not recognise. */
  @Get('sessions')
  async sessions(@CurrentUser() principal: AuthenticatedPrincipal) {
    const sessions = await this.auth.listSessions(principal.userId, principal.familyId);
    return { sessions };
  }

  @Delete('sessions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param() params: SessionIdParamDto,
    @CurrentUser() principal: AuthenticatedPrincipal,
  ): Promise<void> {
    await this.auth.revokeSession(params.id, principal.userId);
  }

  // =========================================================================
  // Helpers
  // =========================================================================

  /**
   * Shapes the response for the requested delivery mode.
   *
   * In cookie mode the refresh token is deliberately withheld from the body: putting
   * it there as well would let any script on the page read the very credential the
   * httpOnly cookie exists to hide.
   */
  private async deliver(
    result: AuthenticatedResult,
    mode: 'token' | 'cookie',
    reply: FastifyReply,
  ) {
    const [tenantName, preferences] = await Promise.all([
      this.auth.getTenantName(result.principal.tenantId),
      this.auth.getUserPreferences(result.principal.userId),
    ]);
    const base = {
      user: {
        id: result.principal.userId,
        email: result.principal.email,
        fullName: result.principal.fullName,
        kind: result.principal.kind,
        preferences,
      },
      tenantId: result.principal.tenantId,
      tenantName,
      roles: result.principal.roles,
      permissions: [...result.principal.permissions].sort(),
      expiresIn: result.tokens.expiresIn,
    };

    if (mode === 'cookie') {
      setAuthCookies(reply, this.config, result.tokens, result.csrfToken ?? '');

      return {
        ...base,
        sessionMode: 'cookie' as const,
        csrfToken: result.csrfToken,
      };
    }

    return {
      ...base,
      sessionMode: 'token' as const,
      tokenType: result.tokens.tokenType,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    };
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { Audited, CurrentUser, Public, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { AppConfig } from '../../config/app-config';
import {
  type ConfigureOidcProviderDto,
  ConfigureOidcProviderSchema,
  type ConfigureSamlProviderDto,
  ConfigureSamlProviderSchema,
  type InitiateSsoDto,
  InitiateSsoSchema,
  type SsoCallbackQueryDto,
  SsoCallbackQuerySchema,
} from './sso.dto';
import { SsoService } from './sso.service';

@Controller({ version: '1' })
export class SsoController {
  constructor(
    private readonly ssoService: SsoService,
    private readonly config: AppConfig,
  ) {}

  // -------------------------------------------------------------------------
  // Tenant Administration: Provider Management
  // -------------------------------------------------------------------------

  @Post('admin/sso/oidc')
  @RequirePermission('admin:sso:manage')
  @Audited({ action: 'sso.oidc_configured', resourceType: 'sso_provider' })
  configureOidc(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: ConfigureOidcProviderDto,
  ) {
    return this.ssoService.configureOidc(principal, dto);
  }

  @Post('admin/sso/saml')
  @RequirePermission('admin:sso:manage')
  @Audited({ action: 'sso.saml_configured', resourceType: 'sso_provider' })
  configureSaml(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: ConfigureSamlProviderDto,
  ) {
    return this.ssoService.configureSaml(principal, dto);
  }

  @Get('admin/sso')
  @RequirePermission('admin:sso:manage')
  listProviders(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.ssoService.listProviders(principal);
  }

  @Delete('admin/sso/:id')
  @RequirePermission('admin:sso:manage')
  @Audited({ action: 'sso.provider_deleted', resourceType: 'sso_provider' })
  deleteProvider(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.ssoService.deleteProvider(principal, id);
  }

  // -------------------------------------------------------------------------
  // SSO Flow: Initiate & Callback
  // -------------------------------------------------------------------------

  @Post('auth/sso/initiate')
  @Public()
  @HttpCode(HttpStatus.OK)
  initiate(@Body() dto: InitiateSsoDto) {
    return this.ssoService.initiateSso(dto);
  }

  @Get('auth/sso/callback')
  @Public()
  async callback(
    @Query() query: SsoCallbackQueryDto,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ) {
    const origin = {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    };

    try {
      const result = await this.ssoService.handleCallback(query.code, query.state, origin);

      if (result.redirectUrl) {
        const redirect = new URL(result.redirectUrl);
        redirect.searchParams.set('token', result.tokens.accessToken);
        redirect.searchParams.set('refresh', result.tokens.refreshToken);
        return reply.redirect(redirect.toString(), 302);
      }

      return reply.send(result);
    } catch (err: any) {
      const consoleUrl = this.config.urls.console;
      const redirect = new URL(`${consoleUrl}/login`);
      redirect.searchParams.set('error', 'sso_failed');
      redirect.searchParams.set('message', err.message || 'SSO Authentication failed');
      return reply.redirect(redirect.toString(), 302);
    }
  }
}

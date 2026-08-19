import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { DbExplorerController } from './db-explorer.controller';
import { AuthService } from './auth.service';
import { OneTimeTokenService } from './one-time-token.service';
import { PasswordService } from './password.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

/**
 * Authentication.
 *
 * Global because the globally-registered `JwtAuthGuard` depends on `TokenService`
 * and `AuthService`; a guard registered in the root module cannot resolve providers
 * from a non-global feature module.
 */
@Global()
@Module({
  controllers: [AuthController, DbExplorerController],
  providers: [AuthService, TokenService, PasswordService, SessionService, OneTimeTokenService],
  exports: [AuthService, TokenService, PasswordService, SessionService, OneTimeTokenService],
})
export class AuthModule {}

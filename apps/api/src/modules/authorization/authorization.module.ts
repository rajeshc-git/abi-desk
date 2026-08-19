import { Global, Module } from '@nestjs/common';
import { PermissionOverrideService } from './permission-override.service';
import { PermissionResolverService } from './permission-resolver.service';

/**
 * Authorization primitives.
 *
 * Global because the auth guard, the RBAC guard and the tenant administration module
 * all need the resolver, and none of them should have to import a module to reach it.
 */
@Global()
@Module({
  providers: [PermissionResolverService, PermissionOverrideService],
  exports: [PermissionResolverService, PermissionOverrideService],
})
export class AuthorizationModule {}

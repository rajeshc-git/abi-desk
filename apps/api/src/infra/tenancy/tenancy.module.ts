import { Global, Module } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantPrismaService } from './tenant-prisma.service';

/**
 * Tenancy is cross-cutting, so both services are published globally: every
 * feature module needs the scoped client, and none should have to import a
 * tenancy module to get it.
 */
@Global()
@Module({
  providers: [TenantContextService, TenantPrismaService],
  exports: [TenantContextService, TenantPrismaService],
})
export class TenancyModule {}

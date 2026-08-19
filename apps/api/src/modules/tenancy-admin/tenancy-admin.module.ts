import { Module } from '@nestjs/common';
import { TenancyAdminController } from './tenancy-admin.controller';
import { TenancyAdminService } from './tenancy-admin.service';

@Module({
  controllers: [TenancyAdminController],
  providers: [TenancyAdminService],
  exports: [TenancyAdminService],
})
export class TenancyAdminModule {}

import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/**
 * Global so every feature module can record an entry without importing anything, and
 * so the globally-registered `AuditInterceptor` can resolve the service.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

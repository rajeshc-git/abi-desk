import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * Database access is needed by nearly every module, so the client is published
 * globally rather than re-imported thirty times.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

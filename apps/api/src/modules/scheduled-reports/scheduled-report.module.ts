import { Module } from '@nestjs/common';
import { MailModule } from '../../infra/mail/mail.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { RedisModule } from '../../infra/redis/redis.module';
import { TenancyModule } from '../../infra/tenancy/tenancy.module';
import { ScheduledReportController } from './scheduled-report.controller';
import { ScheduledReportService } from './scheduled-report.service';

@Module({
  imports: [PrismaModule, TenancyModule, MailModule, RedisModule],
  controllers: [ScheduledReportController],
  providers: [ScheduledReportService],
  exports: [ScheduledReportService],
})
export class ScheduledReportModule {}

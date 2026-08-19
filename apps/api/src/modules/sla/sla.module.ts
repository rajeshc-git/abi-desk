import { Module } from '@nestjs/common';
import { SlaController, TicketSlaController } from './sla.controller';
import { SlaService } from './sla.service';

@Module({
  controllers: [SlaController, TicketSlaController],
  providers: [SlaService],
  exports: [SlaService],
})
export class SlaModule {}

import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SlaModule } from '../sla/sla.module';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [SlaModule, MediaModule],
  controllers: [TicketController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}

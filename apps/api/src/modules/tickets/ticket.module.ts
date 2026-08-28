import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { SlaModule } from '../sla/sla.module';
import { CategoriesController } from './categories.controller';
import { TagsController } from './tags.controller';
import { TicketController } from './ticket.controller';
import { TicketService } from './ticket.service';

@Module({
  imports: [SlaModule, MediaModule],
  controllers: [TicketController, TagsController, CategoriesController],
  providers: [TicketService],
  exports: [TicketService],
})
export class TicketModule {}


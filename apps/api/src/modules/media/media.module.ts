import { Module } from '@nestjs/common';
import { DiagnosticsController } from './diagnostics.controller';
import { DiagnosticsService } from './diagnostics.service';
import { MediaController, TicketMediaController } from './media.controller';
import { MediaService } from './media.service';

/**
 * Media and diagnostics ingestion.
 *
 * Both services live in one module because they are two halves of the same capture: the
 * widget uploads screenshots and recordings through `MediaService` and posts the
 * accompanying browser state through `DiagnosticsService`, for the same ticket.
 *
 * `MediaService` is exported so the ticket module can link assets uploaded before the
 * ticket existed (`attachToTicket`) inside the ticket-creation transaction.
 */
@Module({
  controllers: [MediaController, TicketMediaController, DiagnosticsController],
  providers: [MediaService, DiagnosticsService],
  exports: [MediaService, DiagnosticsService],
})
export class MediaModule {}

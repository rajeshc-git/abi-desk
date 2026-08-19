import { Module } from '@nestjs/common';
import { MailModule } from '../../infra/mail/mail.module';
import { SlaModule } from '../sla/sla.module';
import { TicketModule } from '../tickets/ticket.module';
import { AssignmentService } from './assignment.service';
import { BulkTicketController, WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';

/**
 * Imports TicketModule rather than reaching for the Prisma client directly: reads must
 * go through `TicketService.findByIdOrThrow` so the row-level scope check is applied
 * once, in one place. A workflow action that loaded a ticket itself would be a way to
 * bypass that check.
 */
@Module({
  imports: [TicketModule, SlaModule, MailModule],
  controllers: [WorkflowController, BulkTicketController],
  providers: [WorkflowService, AssignmentService],
  exports: [WorkflowService, AssignmentService],
})
export class WorkflowModule {}

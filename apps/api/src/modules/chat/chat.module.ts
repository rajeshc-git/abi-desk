import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TicketModule } from '../tickets/ticket.module';
import { AnalyticsModule } from '../analytics/analytics.module';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';

@Module({
  imports: [TicketModule, AuthModule, AnalyticsModule],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService, ChatGateway],
})
export class ChatModule {}

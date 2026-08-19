import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type ListConversationsQueryDto,
  type PromoteToTicketDto,
  type SendMessageDto,
  type StartConversationDto,
  type UpdateTypingDto,
} from './chat.dto';
import { ChatService } from './chat.service';

@Controller({ path: 'chat', version: '1' })
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('conversations')
  @RequirePermission('ticket:create')
  @Audited({ action: 'chat.started', resourceType: 'chat_conversation' })
  @HttpCode(HttpStatus.CREATED)
  startConversation(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Body() dto: StartConversationDto,
  ) {
    return this.chatService.startConversation(principal, dto);
  }

  @Get('conversations')
  listConversations(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Query() query: ListConversationsQueryDto,
  ) {
    return this.chatService.listConversations(principal, query);
  }

  @Get('conversations/:id')
  getConversation(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.chatService.getConversation(principal, id);
  }

  @Post('conversations/:id/accept')
  @RequirePermission('chat:respond')
  @Audited({ action: 'chat.accepted', resourceType: 'chat_conversation', idParam: 'id' })
  acceptConversation(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.chatService.acceptConversation(principal, id);
  }

  @Post('conversations/:id/messages')
  @Audited({ action: 'chat.message_sent', resourceType: 'chat_conversation', idParam: 'id' })
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.chatService.sendMessage(principal, id, dto);
  }

  @Get('conversations/:id/messages')
  listMessages(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.chatService.listMessages(principal, id, page, pageSize);
  }

  @Post('conversations/:id/typing')
  @HttpCode(HttpStatus.OK)
  updateTyping(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateTypingDto,
  ) {
    return this.chatService.updateTyping(principal, id, dto.isTyping);
  }

  @Post('conversations/:id/close')
  @Audited({ action: 'chat.closed', resourceType: 'chat_conversation', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  closeConversation(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.chatService.closeConversation(principal, id);
  }

  @Post('conversations/:id/promote')
  @RequirePermission('ticket:create')
  @Audited({ action: 'chat.promoted_to_ticket', resourceType: 'chat_conversation', idParam: 'id' })
  @HttpCode(HttpStatus.CREATED)
  promoteToTicket(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() dto: PromoteToTicketDto,
  ) {
    return this.chatService.promoteToTicket(principal, id, dto);
  }
}

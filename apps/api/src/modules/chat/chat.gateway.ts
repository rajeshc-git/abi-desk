import { Inject, Injectable, UseGuards } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { type Logger } from 'pino';
import { Server, Socket } from 'socket.io';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TokenService } from '../auth/token.service';
import {
  type PromoteToTicketDto,
  type SendMessageDto,
  type StartConversationDto,
  type UpdateTypingDto,
} from './chat.dto';
import { ChatService } from './chat.service';
import { TicketService } from '../tickets/ticket.service';

interface AuthenticatedSocket extends Socket {
  data: {
    userId: string;
    tenantId: string;
    email: string;
    fullName: string;
    kind: 'STAFF' | 'CUSTOMER';
    roles: string[];
  };
}

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*' },
})
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger: Logger;

  constructor(
    private readonly chatService: ChatService,
    private readonly ticketService: TicketService,
    private readonly tokens: TokenService,
    private readonly tenantContext: TenantContextService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'ChatGateway' });
    this.chatService.registerGateway(this);
    this.ticketService.registerGateway(this);
  }

  async handleConnection(socket: Socket) {
    try {
      const authHeader = socket.handshake.headers.authorization;
      const authToken = socket.handshake.auth?.token ?? authHeader?.replace(/^Bearer\s+/i, '');

      if (!authToken) {
        this.logger.warn({ socketId: socket.id }, 'Socket rejected: No token provided');
        socket.disconnect();
        return;
      }

      const claims = await this.tokens.verifyAccessToken(authToken);
      if (!claims || !claims.tid) {
        this.logger.warn({ socketId: socket.id }, 'Socket rejected: Invalid token claims');
        socket.disconnect();
        return;
      }

      socket.data = {
        userId: claims.sub,
        tenantId: claims.tid,
        email: claims.sub,
        kind: claims.knd,
        roles: claims.rls,
      };

      // Join tenant room and user personal room
      socket.join(`tenant:${claims.tid}`);
      socket.join(`user:${claims.sub}`);

      this.logger.info(
        { socketId: socket.id, userId: claims.sub, tenantId: claims.tid },
        'Client connected to Chat Gateway',
      );
    } catch (err) {
      this.logger.error({ err, socketId: socket.id }, 'Socket authentication error');
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.info({ socketId: socket.id }, 'Client disconnected from Chat Gateway');
  }

  // -------------------------------------------------------------------------
  // WebSocket Message Handlers
  // -------------------------------------------------------------------------

  @SubscribeMessage('join_conversation')
  async handleJoinConversation(socket: AuthenticatedSocket, data: { conversationId: string }) {
    const room = `conversation:${data.conversationId}`;
    socket.join(room);
    this.server.to(room).emit('chat.participant_joined', {
      conversationId: data.conversationId,
      userId: socket.data.userId,
    });
    return { status: 'joined', conversationId: data.conversationId };
  }

  @SubscribeMessage('leave_conversation')
  async handleLeaveConversation(socket: AuthenticatedSocket, data: { conversationId: string }) {
    const room = `conversation:${data.conversationId}`;
    socket.leave(room);
    this.server.to(room).emit('chat.participant_left', {
      conversationId: data.conversationId,
      userId: socket.data.userId,
    });
    return { status: 'left', conversationId: data.conversationId };
  }

  broadcastMessage(tenantId: string, conversationId: string, message: any) {
    const room = `conversation:${conversationId}`;
    this.server.to(room).emit('chat.message', {
      conversationId,
      message,
    });

    this.server.to(`tenant:${tenantId}`).emit('chat.inbox_updated', {
      conversationId,
      lastMessage: message.body,
    });
  }

  broadcastTicketCreated(tenantId: string, ticket: any) {
    this.server.to(`tenant:${tenantId}`).emit('ticket.created', { ticket });
    this.server.to(`tenant:${tenantId}`).emit('ticket.inbox_updated', {
      action: 'CREATED',
      ticketId: ticket.id,
      ticket,
    });
  }

  broadcastTicketUpdated(tenantId: string, ticketId: string, ticket: any) {
    this.server.to(`tenant:${tenantId}`).emit('ticket.updated', { ticketId, ticket });
    this.server.to(`ticket:${ticketId}`).emit('ticket.updated', { ticketId, ticket });
    this.server.to(`tenant:${tenantId}`).emit('ticket.inbox_updated', {
      action: 'UPDATED',
      ticketId,
      ticket,
    });
  }

  broadcastTicketCommented(tenantId: string, ticketId: string, comment: any) {
    this.server.to(`tenant:${tenantId}`).emit('ticket.commented', { ticketId, comment });
    this.server.to(`ticket:${ticketId}`).emit('ticket.commented', { ticketId, comment });
    this.server.to(`tenant:${tenantId}`).emit('ticket.inbox_updated', {
      action: 'COMMENT_ADDED',
      ticketId,
      comment,
    });
  }

  @SubscribeMessage('join_ticket')
  async handleJoinTicket(socket: AuthenticatedSocket, data: { ticketId: string }) {
    const room = `ticket:${data.ticketId}`;
    socket.join(room);
    return { status: 'joined', ticketId: data.ticketId };
  }

  @SubscribeMessage('leave_ticket')
  async handleLeaveTicket(socket: AuthenticatedSocket, data: { ticketId: string }) {
    const room = `ticket:${data.ticketId}`;
    socket.leave(room);
    return { status: 'left', ticketId: data.ticketId };
  }

  @SubscribeMessage('send_message')
  async handleSendMessage(
    socket: AuthenticatedSocket,
    data: { conversationId: string; message: SendMessageDto },
  ) {
    const principal = this.createPrincipalFromSocket(socket);

    return this.tenantContext.runWithTenant(
      socket.data.tenantId,
      { userId: socket.data.userId },
      async () => {
        return this.chatService.sendMessage(principal, data.conversationId, data.message);
      },
    );
  }

  @SubscribeMessage('typing')
  async handleTyping(
    socket: AuthenticatedSocket,
    data: { conversationId: string; isTyping: boolean },
  ) {
    const principal = this.createPrincipalFromSocket(socket);

    await this.tenantContext.runWithTenant(
      socket.data.tenantId,
      { userId: socket.data.userId },
      async () => {
        return this.chatService.updateTyping(principal, data.conversationId, data.isTyping);
      },
    );

    const room = `conversation:${data.conversationId}`;
    socket.to(room).emit('chat.typing', {
      conversationId: data.conversationId,
      userId: socket.data.userId,
      isTyping: data.isTyping,
    });
  }

  private createPrincipalFromSocket(socket: AuthenticatedSocket) {
    return {
      userId: socket.data.userId,
      tenantId: socket.data.tenantId,
      sessionId: '',
      familyId: '',
      email: socket.data.email,
      fullName: socket.data.fullName ?? 'Chat User',
      kind: socket.data.kind,
      roles: (socket.data.roles ?? []) as any,
      permissions: new Set<string>(),
      isPlatformAdmin: false,
    };
  }
}

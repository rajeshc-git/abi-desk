import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { TicketService } from '../tickets/ticket.service';
import {
  type ListConversationsQueryDto,
  type PromoteToTicketDto,
  type SendMessageDto,
  type StartConversationDto,
} from './chat.dto';

@Injectable()
export class ChatService {
  private readonly logger: Logger;
  private gateway?: any;

  registerGateway(gateway: any) {
    this.gateway = gateway;
  }

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly tickets: TicketService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'ChatService' });
  }

  // =========================================================================
  // Conversations Lifecycle
  // =========================================================================

  async startConversation(principal: AuthenticatedPrincipal, dto: StartConversationDto) {
    const tenantId = this.tenantContext.requireTenantId();

    let msgObj: any = null;

    const conversation = await this.db.run(async (tx) => {
      const conversation = await tx.chatConversation.create({
        data: {
          tenantId,
          brandId: dto.brandId ?? null,
          subject: dto.subject ?? 'Live Chat Support',
          pageUrl: dto.pageUrl ?? null,
          status: 'QUEUED',
          participants: {
            create: {
              tenantId,
              userId: principal.userId,
              role: principal.kind === 'STAFF' ? 'AGENT' : 'CUSTOMER',
            },
          },
        },
        include: {
          participants: {
            include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          },
        },
      });

      if (dto.initialMessage) {
        const msg = await tx.chatMessage.create({
          data: {
            tenantId,
            conversationId: conversation.id,
            senderId: principal.userId,
            kind: 'TEXT',
            body: dto.initialMessage,
          },
          include: {
            sender: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
            mediaAssets: {
              select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
            },
          },
        });

        await tx.chatConversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: msg.createdAt,
            lastMessagePreview: dto.initialMessage.slice(0, 100),
            messageCount: 1,
          },
        });

        msgObj = msg;
      }

      this.logger.info({ conversationId: conversation.id, tenantId }, 'Chat conversation started');
      return conversation;
    });

    if (this.gateway && msgObj) {
      this.gateway.broadcastMessage(tenantId, conversation.id, msgObj);
    }

    return conversation;
  }

  async acceptConversation(principal: AuthenticatedPrincipal, conversationId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const { updated, sysMsg } = await this.db.run(async (tx) => {
      const conv = await tx.chatConversation.findFirst({
        where: { id: conversationId, tenantId },
      });

      if (!conv) {
        throw AppException.notFound(`Chat conversation '${conversationId}' not found.`);
      }

      const updatedConv = await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          status: 'OPEN',
          acceptedAt: new Date(),
        },
        include: {
          participants: {
            include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          },
        },
      });

      await tx.chatParticipant.upsert({
        where: { conversationId_userId: { conversationId, userId: principal.userId } },
        create: {
          tenantId,
          conversationId,
          userId: principal.userId,
          role: 'AGENT',
        },
        update: { role: 'AGENT' },
      });

      const sysMsg = await tx.chatMessage.create({
        data: {
          tenantId,
          conversationId,
          kind: 'SYSTEM',
          body: `${principal.fullName} joined the conversation.`,
        },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
          mediaAssets: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
          },
        },
      });

      this.logger.info(
        { conversationId, agentId: principal.userId, tenantId },
        'Agent accepted chat',
      );
      return { updated: updatedConv, sysMsg };
    });

    if (this.gateway) {
      this.gateway.broadcastMessage(tenantId, conversationId, sysMsg);
    }

    return updated;
  }

  async sendMessage(
    principal: AuthenticatedPrincipal,
    conversationId: string,
    dto: SendMessageDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const message = await this.db.run(async (tx) => {
      const conv = await tx.chatConversation.findFirst({
        where: { id: conversationId, tenantId },
      });

      if (!conv) {
        throw AppException.notFound(`Chat conversation '${conversationId}' not found.`);
      }

      if (conv.status === 'CLOSED') {
        throw AppException.badRequest('Cannot send messages to a closed conversation.');
      }

      const isStaff = principal.kind === 'STAFF';
      const isFirstAgentReply = isStaff && conv.firstAgentReplyAt === null;

      const msg = await tx.chatMessage.create({
        data: {
          tenantId,
          conversationId,
          senderId: principal.userId,
          kind: dto.kind ?? 'TEXT',
          body: dto.body ?? null,
          clientMessageId: dto.clientMessageId ?? null,
          ...(dto.mediaAssetIds?.length
            ? {
                mediaAssets: {
                  connect: dto.mediaAssetIds.map((id) => ({ id })),
                },
              }
            : {}),
        },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
          mediaAssets: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
          },
        },
      });

      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          lastMessageAt: msg.createdAt,
          lastMessagePreview: dto.body ? dto.body.slice(0, 100) : '[Attachment]',
          messageCount: { increment: 1 },
          ...(isFirstAgentReply ? { firstAgentReplyAt: new Date() } : {}),
        },
      });

      // Update participant last seen and read cursor
      await tx.chatParticipant.updateMany({
        where: { conversationId, userId: principal.userId },
        data: { lastReadAt: msg.createdAt, lastSeenAt: new Date(), isTyping: false },
      });

      return msg;
    });

    if (this.gateway) {
      this.gateway.broadcastMessage(tenantId, conversationId, message);
    }

    return message;
  }

  async updateTyping(principal: AuthenticatedPrincipal, conversationId: string, isTyping: boolean) {
    const tenantId = this.tenantContext.requireTenantId();

    await this.db.client.chatParticipant.updateMany({
      where: { conversationId, userId: principal.userId, tenantId },
      data: { isTyping, lastSeenAt: new Date() },
    });

    return { conversationId, userId: principal.userId, isTyping };
  }

  async closeConversation(principal: AuthenticatedPrincipal, conversationId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const { updated, sysMsg } = await this.db.run(async (tx) => {
      const conv = await tx.chatConversation.findFirst({
        where: { id: conversationId, tenantId },
      });

      if (!conv) {
        throw AppException.notFound(`Chat conversation '${conversationId}' not found.`);
      }

      const updatedConv = await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: principal.userId,
        },
      });

      const sysMsg = await tx.chatMessage.create({
        data: {
          tenantId,
          conversationId,
          kind: 'SYSTEM',
          body: `Conversation closed by ${principal.fullName}.`,
        },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
          mediaAssets: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
          },
        },
      });

      return { updated: updatedConv, sysMsg };
    });

    if (this.gateway) {
      this.gateway.broadcastMessage(tenantId, conversationId, sysMsg);
    }

    return updated;
  }

  async promoteToTicket(
    principal: AuthenticatedPrincipal,
    conversationId: string,
    dto: PromoteToTicketDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const conv = await this.db.client.chatConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        participants: { include: { user: true } },
        messages: {
          orderBy: { createdAt: 'asc' },
          include: { sender: true },
        },
      },
    });

    if (!conv) {
      throw AppException.notFound(`Chat conversation '${conversationId}' not found.`);
    }

    if (conv.ticketId) {
      throw AppException.conflict(`Conversation is already linked to ticket '${conv.ticketId}'.`);
    }

    // Find customer requester
    const customerParticipant = conv.participants.find((p) => p.role === 'CUSTOMER');
    const requesterId = customerParticipant?.userId ?? principal.userId;
    const firstCustomerMsg = conv.messages.find(
      (m) => m.sender?.kind === 'CUSTOMER' || m.sender?.id === requesterId,
    )?.body;
    const ticketDescription =
      firstCustomerMsg ||
      conv.messages.find((m) => m.kind === 'TEXT')?.body ||
      'Live Chat Support Request';

    // Generate readable chat transcript
    const transcriptLines = conv.messages.map((m) => {
      const author = m.sender?.fullName ?? 'System';
      const time = m.createdAt.toISOString();
      return `[${time}] ${author}: ${m.body ?? ''}`;
    });

    const transcriptText = [
      `### Chat Transcript (${conv.subject ?? 'Live Chat'})`,
      conv.pageUrl ? `**Origin Page**: ${conv.pageUrl}` : '',
      '```',
      ...transcriptLines,
      '```',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Create the ticket using TicketService
    const ticket = await this.tickets.create(principal, {
      subject: dto.subject ?? conv.subject ?? 'Live Chat Support Request',
      description: ticketDescription,
      type: 'INCIDENT',
      channel: 'CHAT',
      priority: dto.priority ?? 'NORMAL',
      category: dto.category,
      brandId: dto.brandId ?? conv.brandId ?? undefined,
      requesterId,
    });

    // Link ticket to conversation and append ticket link message
    const { sysMsg } = await this.db.run(async (tx) => {
      await tx.chatConversation.update({
        where: { id: conversationId },
        data: {
          ticketId: ticket.id,
          status: 'CLOSED',
          closedAt: new Date(),
          closedById: principal.userId,
        },
      });

      // Save full transcript as a PUBLIC comment (visible to both customer and staff)
      const comment = await tx.ticketComment.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          authorId: principal.userId,
          visibility: 'PUBLIC',
          body: transcriptText,
          bodyFormat: 'MARKDOWN',
        },
      });

      await tx.ticket.update({
        where: { id: ticket.id },
        data: {
          lastActivityAt: new Date(),
          publicCommentCount: { increment: 1 },
        },
      });

      await tx.ticketEvent.create({
        data: {
          tenantId,
          ticketId: ticket.id,
          type: 'COMMENT_ADDED',
          actorId: principal.userId,
          actorType: 'USER',
          metadata: { commentId: comment.id, visibility: 'PUBLIC' },
        },
      });

      const sysMsg = await tx.chatMessage.create({
        data: {
          tenantId,
          conversationId,
          kind: 'TICKET_LINK',
          body: `This conversation was promoted to Ticket #${ticket.number}.`,
        },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
          mediaAssets: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
          },
        },
      });

      return { sysMsg };
    });

    if (this.gateway) {
      this.gateway.broadcastMessage(tenantId, conversationId, sysMsg);
    }

    this.logger.info({ conversationId, ticketId: ticket.id, tenantId }, 'Chat promoted to ticket');
    return { conversationId, ticket };
  }

  // =========================================================================
  // Queries
  // =========================================================================

  async listConversations(principal: AuthenticatedPrincipal, query: ListConversationsQueryDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const isStaff = principal.kind === 'STAFF';

    const where: Prisma.ChatConversationWhereInput = {
      tenantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.brandId ? { brandId: query.brandId } : {}),
      ...(!isStaff ? { participants: { some: { userId: principal.userId } } } : {}),
    };

    const page = Math.max(1, Math.floor(Number(query.page)) || 1);
    const pageSize = Math.max(1, Math.min(100, Math.floor(Number(query.pageSize)) || 30));
    const skip = (page - 1) * pageSize;

    const [conversations, total] = await Promise.all([
      this.db.client.chatConversation.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
        include: {
          brand: { select: { id: true, name: true } },
          ticket: { select: { id: true, number: true, status: true } },
          participants: {
            include: {
              user: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
            },
          },
        },
      }),
      this.db.client.chatConversation.count({ where }),
    ]);

    return {
      conversations,
      total,
      page,
      pageSize,
    };
  }

  async getConversation(principal: AuthenticatedPrincipal, conversationId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const conversation = await this.db.client.chatConversation.findFirst({
      where: { id: conversationId, tenantId },
      include: {
        brand: { select: { id: true, name: true, primaryColor: true } },
        ticket: { select: { id: true, number: true, status: true, priority: true } },
        participants: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true, kind: true } } },
        },
      },
    });

    if (!conversation) {
      throw AppException.notFound(`Chat conversation '${conversationId}' not found.`);
    }

    return conversation;
  }

  async listMessages(
    _principal: AuthenticatedPrincipal,
    conversationId: string,
    page: number = 1,
    pageSize: number = 50,
  ) {
    const tenantId = this.tenantContext.requireTenantId();
    const resolvedPage = Math.max(1, Math.floor(Number(page)) || 1);
    const resolvedPageSize = Math.max(1, Math.min(100, Math.floor(Number(pageSize)) || 50));
    const skip = (resolvedPage - 1) * resolvedPageSize;

    // Update participant read cursor (lastReadAt) on request
    await this.db.client.chatParticipant
      .updateMany({
        where: { conversationId, userId: _principal.userId, tenantId },
        data: { lastReadAt: new Date(), lastSeenAt: new Date() },
      })
      .catch(() => {});

    const [messages, total] = await Promise.all([
      this.db.client.chatMessage.findMany({
        where: { conversationId, tenantId, deletedAt: null },
        skip,
        take: resolvedPageSize,
        orderBy: { createdAt: 'asc' },
        include: {
          sender: { select: { id: true, fullName: true, avatarUrl: true, kind: true } },
          mediaAssets: {
            select: { id: true, originalFilename: true, mimeType: true, sizeBytes: true },
          },
        },
      }),
      this.db.client.chatMessage.count({
        where: { conversationId, tenantId, deletedAt: null },
      }),
    ]);

    return { messages, total, page: resolvedPage, pageSize: resolvedPageSize };
  }
}

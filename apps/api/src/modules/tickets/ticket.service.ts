import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, type TicketEventType } from '@abi-desk/db';
import { canEditTicket, canReadInternalNotes, resolveTicketScope } from '@abi-desk/rbac';
import { type Logger } from 'pino';
import { AuditService } from '../../common/audit/audit.service';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import {
  type TenantTransaction,
  TenantPrismaService,
} from '../../infra/tenancy/tenant-prisma.service';
import { createHash, randomUUID } from 'node:crypto';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { MediaService } from '../media/media.service';
import { MailService } from '../../infra/mail/mail.service';
import { StorageService } from '../../infra/storage/storage.service';
import { SlaService } from '../sla/sla.service';
import {
  type AddCommentDto,
  type CreateCategoryDto,
  type CreateOrganizationDto,
  type CreateTagDto,
  type CreateTicketDto,
  type ListCommentsDto,
  type ListTicketsDto,
  type MergeTicketsDto,
  type SplitTicketDto,
  type UnmergeTicketDto,
  type UpdateCategoryDto,
  type UpdateOrganizationDto,
  type UpdateTagDto,
  type UpdateTicketDto,
} from './ticket.dto';
import { ticketFilterFor, toPolicySubject } from './ticket-scope';

/** Ticket shape returned by list endpoints. Deliberately lean. */
const TICKET_LIST_SELECT = {
  id: true,
  number: true,
  subject: true,
  description: true,
  status: true,
  tier: true,
  priority: true,
  type: true,
  channel: true,
  category: true,
  brandId: true,
  queueId: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
  lastActivityAt: true,
  firstResponseAt: true,
  resolvedAt: true,
  closedAt: true,
  dueAt: true,
  escalationCount: true,
  reopenCount: true,
  publicCommentCount: true,
  internalNoteCount: true,
  attachmentCount: true,
  requester: { select: { id: true, fullName: true, email: true } },
  assignee: { select: { id: true, fullName: true, email: true } },
  brand: { select: { id: true, name: true, slug: true, supportEmail: true } },
  tags: { select: { tag: { select: { name: true, slug: true, color: true } } } },
  customFields: true,
} satisfies Prisma.TicketSelect;

/** Statuses that mean "no longer being worked". */
const TERMINAL_STATUSES = ['CLOSED', 'CANCELLED'] as const;

@Injectable()
export class TicketService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly audit: AuditService,
    private readonly sla: SlaService,
    private readonly media: MediaService,
    private readonly mailService: MailService,
    private readonly storage: StorageService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'TicketService' });
  }

  private gateway?: any;

  registerGateway(gateway: any) {
    this.gateway = gateway;
  }

  // =========================================================================
  // Create
  // =========================================================================

  /**
   * Creates a ticket.
   *
   * Everything happens in one transaction - the number allocation, the row, its first
   * timeline event, tag links and the outbox event. A ticket that exists without its
   * `CREATED` event, or whose number was allocated but never used, is a gap someone
   * has to explain later.
   */
  async create(principal: AuthenticatedPrincipal, dto: CreateTicketDto) {
    const tenantId = this.requireTenant(principal);

    // Raising on someone else's behalf is a staff action. Without this check any
    // customer could attribute a ticket to another user.
    const requesterId = dto.requesterId ?? principal.userId;

    if (dto.requesterId && dto.requesterId !== principal.userId) {
      if (principal.kind !== 'STAFF' && !principal.permissions.has('ticket:update:tenant')) {
        throw AppException.permissionDenied(
          'Raising a ticket on behalf of another user requires tenant-wide ticket rights.',
        );
      }
    }

    const ticket = await this.prisma.run(async (tx) => {
      const brandId = await this.resolveBrandId(tx, tenantId, dto.brandId);

      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { ticketPrefix: true },
      });

      const sequence = await this.prisma.nextTicketSequence(tx, tenantId);
      const number = `${tenant.ticketPrefix}-${sequence}`;

      const requesterUser = await tx.user.findUnique({
        where: { id: requesterId },
        select: { email: true },
      });
      const autoOrg =
        dto.organization || this.detectOrganizationFromEmail(requesterUser?.email || '');
      const autoProd = dto.product || null;

      const mergedCustomFields: Record<string, any> = {
        ...(dto.customFields && typeof dto.customFields === 'object' ? dto.customFields : {}),
        ...(autoOrg ? { organization: autoOrg } : {}),
        ...(autoProd ? { product: autoProd } : {}),
      };

      const created = await tx.ticket.create({
        data: {
          tenantId,
          brandId,
          number,
          sequence,
          subject: dto.subject,
          description: dto.description,
          priority: dto.priority,
          type: dto.type,
          channel: dto.channel,
          category: dto.category ?? null,
          subcategory: dto.subcategory ?? null,
          requesterId,
          status: 'NEW',
          tier: 'L1',
          lastActivityAt: new Date(),
          customFields: mergedCustomFields as Prisma.InputJsonValue,
        },
        select: { id: true, number: true, subject: true, status: true, priority: true },
      });

      await this.recordEvent(tx, {
        tenantId,
        ticketId: created.id,
        type: 'CREATED',
        actorId: principal.userId,
        toValue: created.number,
        metadata: {
          channel: dto.channel,
          priority: dto.priority,
          ...(autoOrg ? { organization: autoOrg } : {}),
          ...(autoProd ? { productName: autoProd } : {}),
        },
      });

      if (dto.tags?.length) {
        await this.attachTags(tx, tenantId, created.id, dto.tags, principal.userId);
      }

      await this.applyAutoDomainTags(tx, tenantId, created.id, requesterId);
      await this.applyAutoCategoryKeywords(tx, tenantId, created.id, created.subject, dto.description, dto.customFields);

      const attachmentCount = await this.media.attachToTicket(
        tx,
        tenantId,
        created.id,
        dto.attachmentIds ?? [],
        principal.userId,
      );

      if (attachmentCount > 0) {
        await tx.ticket.update({
          where: { id: created.id },
          data: { attachmentCount: { increment: attachmentCount } },
        });
      }

      await this.sla.initializeClocksForTicket(tx, tenantId, {
        id: created.id,
        number: created.number,
        priority: created.priority,
        brandId,
        category: dto.category,
        channel: dto.channel,
        tier: 'L1',
        status: created.status,
      });

      await this.emit(tx, tenantId, 'ticket.created', created.id, {
        ticketId: created.id,
        number: created.number,
        priority: created.priority,
        requesterId,
        brandId,
      });

      return created;
    });

    await this.audit.record({
      action: 'ticket.created',
      resourceType: 'ticket',
      resourceId: ticket.id,
      resourceLabel: ticket.number,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
    });

    this.logger.info({ ticketId: ticket.id, number: ticket.number, tenantId }, 'Ticket created');

    const result = await this.findByIdOrThrow(principal, ticket.id);
    if (this.gateway) {
      this.gateway.broadcastTicketCreated(tenantId, result);
    }
    return result;
  }

  // =========================================================================
  // Read
  // =========================================================================

  /**
   * Fetches one ticket within the caller's scope.
   *
   * Returns 404 rather than 403 when the ticket exists but is out of scope. A 403
   * would confirm the ticket's existence, which for a customer probing sequential
   * ticket numbers is an information leak.
   */
  async findByIdOrThrow(principal: AuthenticatedPrincipal, id: string) {
    const scopeFilter = ticketFilterFor(principal);

    if (!scopeFilter) {
      throw AppException.notFound('Ticket', id);
    }

    const ticket = await this.prisma.client.ticket.findFirst({
      where: { id, deletedAt: null, ...scopeFilter },
      select: {
        ...TICKET_LIST_SELECT,
        description: true,
        subcategory: true,
        customFields: true,
        rootCause: true,
        capaNotes: true,
        rcaUpdatedAt: true,
        capaUpdatedAt: true,
        rcaUpdatedBy: { select: { id: true, fullName: true, email: true } },
        capaUpdatedBy: { select: { id: true, fullName: true, email: true } },
        confirmationRequestedAt: true,
        confirmedAt: true,
        lastCustomerReplyAt: true,
        lastAgentReplyAt: true,
        isSpam: true,
        sequence: true,
        brand: { select: { id: true, name: true, slug: true, supportEmail: true } },
        queue: { select: { id: true, name: true, slug: true, tier: true } },
        team: { select: { id: true, name: true, slug: true } },
        diagnosticBundle: { select: { id: true, capturedAt: true } },
        mediaAssets: {
          where: { commentId: null, chatMessageId: null },
          select: { id: true, originalFilename: true, mimeType: true },
        },
        linksTo: {
          select: {
            id: true,
            type: true,
            createdAt: true,
            source: {
              select: {
                id: true,
                number: true,
                subject: true,
                status: true,
                tier: true,
                priority: true,
                requester: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
        linksFrom: {
          select: {
            id: true,
            type: true,
            createdAt: true,
            target: {
              select: {
                id: true,
                number: true,
                subject: true,
                status: true,
                tier: true,
                priority: true,
                requester: { select: { id: true, fullName: true, email: true } },
              },
            },
          },
        },
        _count: { select: { mediaAssets: true, watchers: true, comments: true } },
      },
    });

    if (!ticket) {
      throw AppException.notFound('Ticket', id);
    }

    return ticket;
  }

  /**
   * Lists tickets within the caller's scope.
   *
   * When `q` is present the query runs through PostgreSQL full text: the ranked ids
   * come from a raw query against the maintained `searchVector`, then the rows are
   * fetched through Prisma so the shape and the scope filter stay in one place. Doing
   * the whole thing in raw SQL would duplicate the scope logic, which is the last
   * thing that should exist twice.
   */
  async list(principal: AuthenticatedPrincipal, query: ListTicketsDto) {
    const scopeFilter = ticketFilterFor(principal);

    if (!scopeFilter) {
      return { tickets: [], total: 0, page: query.page, pageSize: query.pageSize, pages: 0 };
    }

    const where = this.buildWhere(principal, query, scopeFilter);

    if (query.q) {
      return this.searchList(principal, query, where);
    }

    const orderBy = this.buildOrderBy(query);
    const skip = (query.page - 1) * query.pageSize;

    const [tickets, total] = await Promise.all([
      this.prisma.client.ticket.findMany({
        where,
        select: TICKET_LIST_SELECT,
        orderBy,
        skip,
        take: query.pageSize,
      }),
      this.prisma.client.ticket.count({ where }),
    ]);

    return {
      tickets,
      total,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(total / query.pageSize),
    };
  }

  /**
   * The activity timeline.
   *
   * Append-only in the database (a trigger refuses UPDATE), so this is the record of
   * what actually happened to a ticket rather than a reconstruction.
   */
  async timeline(principal: AuthenticatedPrincipal, ticketId: string) {
    // Establishes scope: throws 404 if the caller cannot see the ticket at all.
    await this.findByIdOrThrow(principal, ticketId);

    const events = await this.prisma.client.ticketEvent.findMany({
      where: { ticketId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        type: true,
        actorId: true,
        actorType: true,
        actorLabel: true,
        fromValue: true,
        toValue: true,
        metadata: true,
        createdAt: true,
      },
    });

    // Internal-only events must not leak to a customer through the timeline, which
    // would defeat the point of internal notes being restricted.
    const mayReadInternal = canReadInternalNotes(toPolicySubject(principal));

    let filteredEvents = events;
    if (!mayReadInternal) {
      const internalOnly = new Set<TicketEventType>(['INTERNAL_NOTE_ADDED']);
      filteredEvents = events.filter((event) => !internalOnly.has(event.type));
    }

    // Resolve comment details and actor details to enrich the timeline for the client
    const commentIds: string[] = [];
    const userIds = new Set<string>();

    for (const event of filteredEvents) {
      if (event.actorId && event.actorType === 'USER') {
        userIds.add(event.actorId);
      }
      if (
        (event.type === 'COMMENT_ADDED' || event.type === 'INTERNAL_NOTE_ADDED') &&
        event.metadata &&
        typeof event.metadata === 'object' &&
        !Array.isArray(event.metadata)
      ) {
        const metadataObj = event.metadata as Record<string, any>;
        if (metadataObj.commentId && typeof metadataObj.commentId === 'string') {
          commentIds.push(metadataObj.commentId);
        }
      }
    }

    const [comments, users] = await Promise.all([
      commentIds.length > 0
        ? this.prisma.client.ticketComment.findMany({
            where: { id: { in: commentIds } },
            include: {
              author: { select: { id: true, fullName: true, email: true, kind: true } },
              mediaAssets: {
                select: { id: true, originalFilename: true, mimeType: true },
              },
            },
          })
        : [],
      userIds.size > 0
        ? this.prisma.client.user.findMany({
            where: { id: { in: Array.from(userIds) } },
            select: {
              id: true,
              fullName: true,
              displayName: true,
              email: true,
              kind: true,
              avatarUrl: true,
              jobTitle: true,
              roles: {
                include: {
                  role: { select: { id: true, name: true, key: true } },
                },
              },
            },
          })
        : [],
    ]);

    const commentMap = new Map(comments.map((c) => [c.id, c]));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const enrichedEvents = filteredEvents.map((event) => {
      const enrichedEvent: any = { ...event };
      enrichedEvent.rawType = event.type;
      enrichedEvent.eventType = event.type;

      // Attach actor details if resolved
      if (event.actorId && event.actorType === 'USER') {
        const user = userMap.get(event.actorId);
        if (user) {
          const roleName =
            (user as any).roles?.[0]?.role?.name ||
            (user.kind === 'STAFF' ? 'Support Agent' : 'Customer');
          enrichedEvent.actor = {
            id: user.id,
            fullName: user.fullName,
            displayName: (user as any).displayName || user.fullName,
            email: user.email,
            kind: user.kind,
            avatarUrl: (user as any).avatarUrl,
            jobTitle: (user as any).jobTitle,
            roleName,
            role: roleName,
          };
        }
      }

      // If it's a comment event, attach its body and map its type to 'COMMENT' for widget rendering
      if (
        (event.type === 'COMMENT_ADDED' || event.type === 'INTERNAL_NOTE_ADDED') &&
        event.metadata &&
        typeof event.metadata === 'object' &&
        !Array.isArray(event.metadata)
      ) {
        const metadataObj = event.metadata as Record<string, any>;
        const commentId = metadataObj.commentId;
        if (commentId) {
          const comment = commentMap.get(commentId);
          if (comment) {
            enrichedEvent.body = comment.body;
            enrichedEvent.bodyFormat = comment.bodyFormat;
            enrichedEvent.type = 'COMMENT'; // Map to COMMENT so widget-ui renders it correctly
            if (comment.author) {
              const authorUser = userMap.get(comment.author.id);
              const roleName =
                (authorUser as any)?.roles?.[0]?.role?.name ||
                (comment.author.kind === 'STAFF' ? 'Support Agent' : 'Customer');
              enrichedEvent.actor = {
                id: comment.author.id,
                fullName: comment.author.fullName,
                displayName: (authorUser as any)?.displayName || comment.author.fullName,
                email: comment.author.email,
                kind: comment.author.kind,
                avatarUrl: (authorUser as any)?.avatarUrl,
                jobTitle: (authorUser as any)?.jobTitle,
                roleName,
                role: roleName,
              };
            }
            if (comment.visibility) {
              enrichedEvent.visibility = comment.visibility;
            }
            if (comment.mediaAssets) {
              enrichedEvent.attachments = comment.mediaAssets.map((att: any) => ({
                id: att.id,
                originalFilename: att.originalFilename,
                mimeType: att.mimeType,
              }));
            }
          }
        }
      }

      return enrichedEvent;
    });

    const finalEvents = enrichedEvents.filter((event) => {
      if (!mayReadInternal && event.visibility === 'INTERNAL') {
        return false;
      }
      return true;
    });

    return { events: finalEvents };
  }

  // =========================================================================
  // Update
  // =========================================================================

  /**
   * Updates ticket fields.
   *
   * `ticket:update:own` is limited to tickets the caller reported;
   * `ticket:update:tenant` is unrestricted within the tenant. Status is deliberately
   * not settable here - status moves go through the workflow engine, which validates
   * the transition and its permission.
   */
  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateTicketDto) {
    const tenantId = this.requireTenant(principal);
    const existing = await this.findByIdOrThrow(principal, id);

    const editable = canEditTicket(toPolicySubject(principal), {
      requesterId: existing.requester.id,
      tenantId,
    });

    if (!editable) {
      throw AppException.permissionDenied('You may only edit tickets you reported.', {
        ticketId: id,
        requesterId: existing.requester.id,
      });
    }

    if (TERMINAL_STATUSES.includes(existing.status as (typeof TERMINAL_STATUSES)[number])) {
      throw AppException.conflict(
        `Ticket ${existing.number} is ${existing.status.toLowerCase()} and cannot be edited.`,
        { ticketId: id, status: existing.status },
      );
    }

    if (dto.priority !== undefined && dto.priority !== existing.priority) {
      const isAuthorizedForPriority =
        principal.roles.includes('L2_SUPPORT') ||
        principal.roles.includes('L3_SUPPORT') ||
        principal.roles.includes('DEV_TEAM') ||
        principal.roles.includes('DEVOPS_TEAM') ||
        principal.roles.includes('TENANT_ADMIN') ||
        principal.roles.includes('PLATFORM_ADMIN');

      if (!isAuthorizedForPriority) {
        throw AppException.permissionDenied(
          'Only authorized support, engineering, DevOps, and admin roles may adjust ticket priority.',
          { ticketId: id, currentPriority: existing.priority, requestedPriority: dto.priority, roles: principal.roles },
        );
      }
    }

    const updated = await this.prisma.run(async (tx) => {
      const existingCustom =
        existing.customFields && typeof existing.customFields === 'object'
          ? (existing.customFields as Record<string, any>)
          : {};

      const nextOrg =
        dto.organization !== undefined
          ? dto.organization
          : (dto.customFields as any)?.organization !== undefined
            ? (dto.customFields as any).organization
            : undefined;

      const nextProd =
        dto.product !== undefined
          ? dto.product
          : (dto.customFields as any)?.product !== undefined
            ? (dto.customFields as any).product
            : undefined;

      let mergedCustomFields: Record<string, any> | undefined = undefined;
      if (dto.customFields || nextOrg !== undefined || nextProd !== undefined) {
        mergedCustomFields = {
          ...existingCustom,
          ...(dto.customFields && typeof dto.customFields === 'object' ? dto.customFields : {}),
        };
        if (nextOrg !== undefined) {
          if (nextOrg === null || nextOrg === '') {
            delete mergedCustomFields.organization;
          } else {
            mergedCustomFields.organization = nextOrg;
          }
        }
        if (nextProd !== undefined) {
          if (nextProd === null || nextProd === '') {
            delete mergedCustomFields.product;
          } else {
            mergedCustomFields.product = nextProd;
          }
        }
      }

      const result = await tx.ticket.update({
        where: { id },
        data: {
          ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
          ...(dto.description !== undefined ? { description: dto.description } : {}),
          ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
          ...(dto.type !== undefined ? { type: dto.type } : {}),
          ...(dto.category !== undefined ? { category: dto.category } : {}),
          ...(dto.subcategory !== undefined ? { subcategory: dto.subcategory } : {}),
          ...(dto.rootCause !== undefined
            ? {
                rootCause: dto.rootCause,
                rcaUpdatedAt: new Date(),
                rcaUpdatedById: principal.userId,
              }
            : {}),
          ...(dto.capaNotes !== undefined
            ? {
                capaNotes: dto.capaNotes,
                capaUpdatedAt: new Date(),
                capaUpdatedById: principal.userId,
              }
            : {}),
          ...(mergedCustomFields !== undefined
            ? { customFields: mergedCustomFields as Prisma.InputJsonValue }
            : {}),
          lastActivityAt: new Date(),
        },
        select: {
          id: true,
          number: true,
          subject: true,
          priority: true,
          type: true,
          category: true,
          subcategory: true,
          rootCause: true,
          capaNotes: true,
          rcaUpdatedAt: true,
          capaUpdatedAt: true,
        },
      });

      // Priority changes drive SLA targets and escalation, so they belong on the
      // timeline rather than only in the audit log.
      if (dto.priority !== undefined && dto.priority !== existing.priority) {
        await this.recordEvent(tx, {
          tenantId,
          ticketId: id,
          type: 'PRIORITY_CHANGED',
          actorId: principal.userId,
          fromValue: existing.priority,
          toValue: dto.priority,
        });
      }

      if (dto.category !== undefined && dto.category !== existing.category) {
        await this.recordEvent(tx, {
          tenantId,
          ticketId: id,
          type: 'CATEGORY_CHANGED',
          actorId: principal.userId,
          fromValue: existing.category ?? null,
          toValue: dto.category ?? null,
        });
      }

      if (nextOrg !== undefined && nextOrg !== (existingCustom.organization || null)) {
        await this.recordEvent(tx, {
          tenantId,
          ticketId: id,
          type: 'CATEGORY_CHANGED',
          actorId: principal.userId,
          fromValue: existingCustom.organization || '-None-',
          toValue: nextOrg || '-None-',
          metadata: { field: 'organization', label: 'Organization / Account' },
        });
      }

      if (nextProd !== undefined && nextProd !== (existingCustom.product || null)) {
        await this.recordEvent(tx, {
          tenantId,
          ticketId: id,
          type: 'CATEGORY_CHANGED',
          actorId: principal.userId,
          fromValue: existingCustom.product || '-None-',
          toValue: nextProd || '-None-',
          metadata: { field: 'product', label: 'Product Name' },
        });
      }

      await this.emit(tx, tenantId, 'ticket.updated', id, {
        ticketId: id,
        changed: Object.keys(dto),
      });

      return result;
    });

    await this.audit.record({
      action: 'ticket.updated',
      resourceType: 'ticket',
      resourceId: id,
      resourceLabel: updated.number,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
      changes: this.audit.diff(
        existing as unknown as Record<string, unknown>,
        updated as unknown as Record<string, unknown>,
        ['subject', 'priority', 'type', 'category', 'subcategory'],
      ),
    });

    const result = await this.findByIdOrThrow(principal, id);
    if (this.gateway) {
      this.gateway.broadcastTicketUpdated(tenantId, id, result);
    }
    return result;
  }

  // =========================================================================
  // Comments and internal notes
  // =========================================================================

  /**
   * Adds a reply or an internal note.
   *
   * One table with a visibility discriminator, so the timeline is a single ordered
   * read. The permission check is the load-bearing part: `INTERNAL` requires
   * `ticket:note:internal`, which the requirements grant to L1-Dev and withhold from
   * Guest *and* Tenant Admin.
   */
  async addComment(principal: AuthenticatedPrincipal, ticketId: string, dto: AddCommentDto) {
    const tenantId = this.requireTenant(principal);
    const ticket = await this.findByIdOrThrow(principal, ticketId);

    if (dto.visibility === 'INTERNAL' && !principal.permissions.has('ticket:note:internal')) {
      throw AppException.permissionDenied(
        'Internal notes require the ticket:note:internal permission.',
        { ticketId, roles: principal.roles },
      );
    }

    // A customer replying must actually be a participant, not any authenticated user
    // who can see the ticket.
    const isRequester = ticket.requester.id === principal.userId;
    const isStaff = principal.kind === 'STAFF';

    if (!isStaff && !isRequester) {
      throw AppException.permissionDenied('You may only comment on your own tickets.');
    }

    const comment = await this.prisma.run(async (tx) => {
      const created = await tx.ticketComment.create({
        data: {
          tenantId,
          ticketId,
          authorId: principal.userId,
          visibility: dto.visibility,
          body: dto.body,
          bodyFormat: dto.bodyFormat,
        },
        select: {
          id: true,
          body: true,
          visibility: true,
          bodyFormat: true,
          createdAt: true,
          author: { select: { id: true, fullName: true, email: true, kind: true } },
        },
      });

      if (dto.attachments && dto.attachments.length > 0) {
        await tx.mediaAsset.updateMany({
          where: {
            id: { in: dto.attachments },
            tenantId,
          },
          data: {
            commentId: created.id,
            ticketId,
          },
        });
        const linkedAssets = await tx.mediaAsset.findMany({
          where: { commentId: created.id },
          select: { id: true, originalFilename: true, mimeType: true },
        });
        (created as any).mediaAssets = linkedAssets;
      } else {
        (created as any).mediaAssets = [];
      }

      const isPublic = dto.visibility === 'PUBLIC';

      // First response is a headline SLA metric, and it means the first *public*
      // reply from staff. An internal note is not an answer to the customer.
      const isFirstStaffReply = isPublic && isStaff && ticket.firstResponseAt === null;

      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          lastActivityAt: new Date(),
          ...(isPublic
            ? { publicCommentCount: { increment: 1 } }
            : { internalNoteCount: { increment: 1 } }),
          ...(isFirstStaffReply ? { firstResponseAt: new Date() } : {}),
          ...(isPublic && isStaff ? { lastAgentReplyAt: new Date() } : {}),
          ...(isPublic && !isStaff ? { lastCustomerReplyAt: new Date() } : {}),
        },
      });

      if (isFirstStaffReply) {
        await this.sla.recordFirstResponse(tx, tenantId, ticketId, new Date());
      }

      await this.recordEvent(tx, {
        tenantId,
        ticketId,
        type: isPublic ? 'COMMENT_ADDED' : 'INTERNAL_NOTE_ADDED',
        actorId: principal.userId,
        metadata: {
          commentId: created.id,
          visibility: dto.visibility,
          ...(dto.cc && dto.cc.length > 0 ? { cc: dto.cc } : {}),
        },
      });

      await this.emit(tx, tenantId, 'ticket.commented', ticketId, {
        ticketId,
        commentId: created.id,
        visibility: dto.visibility,
        authorId: principal.userId,
        isFirstResponse: isFirstStaffReply,
      });

      // Outbound email notification for staff public comments on email/support tickets:
      if (isPublic && isStaff) {
        this.mailService.sendTicketMail({
          to: {
            email: ticket.requester.email,
            name: ticket.requester.fullName,
          },
          ...(dto.cc && dto.cc.length > 0 ? { cc: dto.cc } : {}),
          subject: `Re: [Ticket #${ticket.number}] ${ticket.subject}`,
          text: dto.body,
          html: `<div style="white-space: pre-wrap; font-family: sans-serif; font-size: 14px; color: #333333;">${dto.body}</div>`,
          tag: 'ticket.reply',
          ...(ticket.brand?.supportEmail ? { replyTo: ticket.brand.supportEmail } : {}),
        }).catch((err) => {
          this.logger.error({ err, ticketId }, 'Failed to send outbound reply email to customer');
        });
      }

      return created;
    });

    await this.audit.record({
      action: dto.visibility === 'INTERNAL' ? 'ticket.note_added' : 'ticket.comment_added',
      resourceType: 'ticket',
      resourceId: ticketId,
      resourceLabel: ticket.number,
      tenantId,
      actorId: principal.userId,
      actorEmail: principal.email,
    });

    if (this.gateway) {
      this.gateway.broadcastTicketCommented(tenantId, ticketId, comment, ticket.number);
    }

    return comment;
  }

  /**
   * Lists comments, filtered by what the caller may see.
   *
   * The visibility filter is applied server-side and cannot be widened by a query
   * parameter - passing `visibility=INTERNAL` without the permission narrows to
   * nothing rather than escalating.
   */
  async listComments(principal: AuthenticatedPrincipal, ticketId: string, query: ListCommentsDto) {
    await this.findByIdOrThrow(principal, ticketId);

    const mayReadInternal = canReadInternalNotes(toPolicySubject(principal));

    // The effective filter is the intersection of what was asked for and what the
    // caller may see - never the union. A caller without the permission who asks for
    // INTERNAL gets an empty list, not a silent downgrade to PUBLIC: returning
    // public comments in response to a request for internal ones would be a
    // misleading answer, and returning internal ones would be a leak.
    const requestedInternalWithoutPermission = query.visibility === 'INTERNAL' && !mayReadInternal;

    const visibilityFilter: Prisma.TicketCommentWhereInput = mayReadInternal
      ? query.visibility
        ? { visibility: query.visibility }
        : {}
      : { visibility: 'PUBLIC' };

    const where: Prisma.TicketCommentWhereInput = {
      ticketId,
      deletedAt: null,
      ...visibilityFilter,
      // Matches nothing, without needing a separate early-return branch.
      ...(requestedInternalWithoutPermission ? { id: { in: [] } } : {}),
    };

    const skip = (query.page - 1) * query.pageSize;

    const [comments, total] = await Promise.all([
      this.prisma.client.ticketComment.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: query.pageSize,
        select: {
          id: true,
          body: true,
          bodyFormat: true,
          visibility: true,
          isSystem: true,
          systemLabel: true,
          editedAt: true,
          createdAt: true,
          author: { select: { id: true, fullName: true, email: true, kind: true } },
          mediaAssets: {
            select: { id: true, originalFilename: true, mimeType: true },
          },
        },
      }),
      this.prisma.client.ticketComment.count({ where }),
    ]);

    return { comments, total, page: query.page, pageSize: query.pageSize };
  }

  // =========================================================================
  // Watchers and tags
  // =========================================================================

  async addWatcher(principal: AuthenticatedPrincipal, ticketId: string, userId?: string) {
    const tenantId = this.requireTenant(principal);
    const ticket = await this.findByIdOrThrow(principal, ticketId);
    const target = userId ?? principal.userId;

    if (target !== principal.userId && !principal.permissions.has('ticket:update:tenant')) {
      throw AppException.permissionDenied('You may only add yourself as a watcher.');
    }

    await this.prisma.run(async (tx) => {
      const existing = await tx.ticketWatcher.findFirst({
        where: { ticketId, userId: target },
        select: { id: true },
      });

      // Idempotent: watching twice is a no-op, not a 409. The client may retry.
      if (existing) return;

      await tx.ticketWatcher.create({ data: { tenantId, ticketId, userId: target } });

      await this.recordEvent(tx, {
        tenantId,
        ticketId,
        type: 'WATCHER_ADDED',
        actorId: principal.userId,
        toValue: target,
      });
    });

    return { ticketId, number: ticket.number, watching: true };
  }

  async removeWatcher(principal: AuthenticatedPrincipal, ticketId: string, userId?: string) {
    const tenantId = this.requireTenant(principal);
    await this.findByIdOrThrow(principal, ticketId);
    const target = userId ?? principal.userId;

    if (target !== principal.userId && !principal.permissions.has('ticket:update:tenant')) {
      throw AppException.permissionDenied('You may only remove yourself as a watcher.');
    }

    await this.prisma.run(async (tx) => {
      const deleted = await tx.ticketWatcher.deleteMany({ where: { ticketId, userId: target } });

      if (deleted.count > 0) {
        await this.recordEvent(tx, {
          tenantId,
          ticketId,
          type: 'WATCHER_REMOVED',
          actorId: principal.userId,
          fromValue: target,
        });
      }
    });

    return { ticketId, watching: false };
  }

  async addTags(principal: AuthenticatedPrincipal, ticketId: string, tags: string[]) {
    const tenantId = this.requireTenant(principal);
    const ticket = await this.findByIdOrThrow(principal, ticketId);

    await this.prisma.run((tx) => this.attachTags(tx, tenantId, ticketId, tags, principal.userId));

    await this.audit.record({
      action: 'ticket.tagged',
      resourceType: 'ticket',
      resourceId: ticketId,
      resourceLabel: ticket.number,
      tenantId,
      actorId: principal.userId,
      changes: { tags: { from: null, to: tags } },
    });

    return this.findByIdOrThrow(principal, ticketId);
  }

  async removeTag(principal: AuthenticatedPrincipal, ticketId: string, slug: string) {
    const tenantId = this.requireTenant(principal);
    await this.findByIdOrThrow(principal, ticketId);

    await this.prisma.run(async (tx) => {
      const tag = await tx.tag.findFirst({
        where: { tenantId, slug: slugify(slug) },
        select: { id: true, name: true },
      });

      if (!tag) return;

      const deleted = await tx.ticketTag.deleteMany({ where: { ticketId, tagId: tag.id } });

      if (deleted.count > 0) {
        // Keep the denormalised counter honest; tag pickers order by it.
        await tx.tag.update({
          where: { id: tag.id },
          data: { usageCount: { decrement: 1 } },
        });

        await this.recordEvent(tx, {
          tenantId,
          ticketId,
          type: 'TAG_REMOVED',
          actorId: principal.userId,
          fromValue: tag.name,
        });
      }
    });

    return this.findByIdOrThrow(principal, ticketId);
  }

  /** Relates two tickets. Both must be inside the caller's scope. */
  async link(
    principal: AuthenticatedPrincipal,
    ticketId: string,
    targetId: string,
    type: 'RELATED' | 'DUPLICATE_OF' | 'BLOCKS' | 'BLOCKED_BY' | 'CAUSED_BY' | 'MERGED_INTO',
  ) {
    const tenantId = this.requireTenant(principal);

    if (ticketId === targetId) {
      throw AppException.badRequest('A ticket cannot be linked to itself.');
    }

    // Resolving both through the scoped reader is what stops a link being used to
    // discover the existence of a ticket the caller cannot see.
    const [source, target] = await Promise.all([
      this.findByIdOrThrow(principal, ticketId),
      this.findByIdOrThrow(principal, targetId),
    ]);

    await this.prisma.run(async (tx) => {
      const existing = await tx.ticketLink.findFirst({
        where: { sourceId: ticketId, targetId, type },
        select: { id: true },
      });

      if (existing) return;

      await tx.ticketLink.create({
        data: { tenantId, sourceId: ticketId, targetId, type, createdById: principal.userId },
      });

      await this.recordEvent(tx, {
        tenantId,
        ticketId,
        type: 'LINKED',
        actorId: principal.userId,
        toValue: target.number,
        metadata: { linkType: type, targetTicketId: targetId },
      });
    });

    return { source: source.number, target: target.number, type };
  }

  /**
   * Merges one or more secondary tickets into a primary master ticket.
   * - Creates TicketLink (MERGED_INTO) records
   * - Adds internal notes summarizing the merge on all involved tickets
   * - Transitions secondary tickets to CLOSED
   * - Emits MERGED ticket events for audit timeline
   */
  async merge(principal: AuthenticatedPrincipal, dto: MergeTicketsDto) {
    const tenantId = this.requireTenant(principal);
    const { primaryTicketId, secondaryTicketIds, note } = dto;

    if (secondaryTicketIds.includes(primaryTicketId)) {
      throw AppException.badRequest('Primary ticket cannot be included in secondary tickets to merge.');
    }

    const uniqueSecondaryIds = Array.from(new Set(secondaryTicketIds));
    if (uniqueSecondaryIds.length === 0) {
      throw AppException.badRequest('At least one secondary ticket is required to merge.');
    }

    const primary = await this.findByIdOrThrow(principal, primaryTicketId);
    const secondaries = await Promise.all(
      uniqueSecondaryIds.map((id) => this.findByIdOrThrow(principal, id)),
    );

    await this.prisma.run(async (tx) => {
      const secondarySummaries: string[] = [];

      for (const sec of secondaries) {
        // 1. Create or ensure TicketLink
        const existingLink = await tx.ticketLink.findFirst({
          where: { sourceId: sec.id, targetId: primary.id, type: 'MERGED_INTO' },
        });

        if (!existingLink) {
          await tx.ticketLink.create({
            data: {
              tenantId,
              sourceId: sec.id,
              targetId: primary.id,
              type: 'MERGED_INTO',
              createdById: principal.userId,
            },
          });
        }

        // 2. Close secondary ticket
        await tx.ticket.update({
          where: { id: sec.id },
          data: {
            status: 'CLOSED',
            closedAt: new Date(),
            lastActivityAt: new Date(),
          },
        });

        // 3. Record MERGED event on secondary ticket
        await this.recordEvent(tx, {
          tenantId,
          ticketId: sec.id,
          type: 'MERGED',
          actorId: principal.userId,
          toValue: primary.number,
          metadata: {
            action: 'MERGED_INTO_PRIMARY',
            primaryTicketId: primary.id,
            primaryTicketNumber: primary.number,
            previousStatus: sec.status,
            note,
          },
        });

        secondarySummaries.push(
          `- **#${sec.number}**: ${sec.subject} (Requester: ${sec.requester?.fullName || sec.requester?.email || 'Unknown'})`,
        );
      }

      await tx.ticket.update({
        where: { id: primary.id },
        data: {
          lastActivityAt: new Date(),
        },
      });

      // 4. Record MERGED event on primary ticket
      await this.recordEvent(tx, {
        tenantId,
        ticketId: primary.id,
        type: 'MERGED',
        actorId: principal.userId,
        toValue: secondaries.map((s) => s.number).join(', '),
        metadata: {
          action: 'MERGED_SECONDARY_TICKETS',
          secondaryTicketIds: secondaries.map((s) => s.id),
          secondaryTicketNumbers: secondaries.map((s) => s.number),
          note,
        },
      });
    });

    return this.findByIdOrThrow(principal, primary.id);
  }

  /**
   * Unmerges a secondary ticket from a primary ticket.
   * - Deletes MERGED_INTO TicketLink
   * - Reopens secondary ticket to OPEN
   * - Emits REOPENED and LINKED timeline events
   */
  async unmerge(principal: AuthenticatedPrincipal, primaryTicketId: string, dto: UnmergeTicketDto) {
    const tenantId = this.requireTenant(principal);
    const { secondaryTicketId, note } = dto;

    const [primary, secondary] = await Promise.all([
      this.findByIdOrThrow(principal, primaryTicketId),
      this.findByIdOrThrow(principal, secondaryTicketId),
    ]);

    await this.prisma.run(async (tx) => {
      // 1. Delete merge link
      await tx.ticketLink.deleteMany({
        where: {
          sourceId: secondary.id,
          targetId: primary.id,
          type: 'MERGED_INTO',
        },
      });

      // 2. Find pre-merge status if available
      const lastMergeEvent = await tx.ticketEvent.findFirst({
        where: {
          ticketId: secondary.id,
          type: 'MERGED',
        },
        orderBy: { createdAt: 'desc' },
      });
      const restoredStatus = (lastMergeEvent?.metadata as any)?.previousStatus || 'OPEN';

      // 3. Reopen secondary ticket to its exact pre-merge status
      await tx.ticket.update({
        where: { id: secondary.id },
        data: {
          status: restoredStatus,
          closedAt: null,
          reopenedAt: new Date(),
          reopenCount: { increment: 1 },
          lastActivityAt: new Date(),
        },
      });

      await tx.ticket.update({
        where: { id: primary.id },
        data: {
          lastActivityAt: new Date(),
        },
      });

      // 4. Record events
      await this.recordEvent(tx, {
        tenantId,
        ticketId: secondary.id,
        type: 'REOPENED',
        actorId: principal.userId,
        toValue: restoredStatus,
        metadata: {
          action: 'UNMERGED_FROM_PRIMARY',
          primaryTicketId: primary.id,
          primaryTicketNumber: primary.number,
          restoredStatus,
          note,
        },
      });

      await this.recordEvent(tx, {
        tenantId,
        ticketId: primary.id,
        type: 'LINKED',
        actorId: principal.userId,
        fromValue: secondary.number,
        metadata: {
          action: 'UNMERGED_SECONDARY_TICKET',
          secondaryTicketId: secondary.id,
          secondaryTicketNumber: secondary.number,
          note,
        },
      });
    });

    return this.findByIdOrThrow(principal, primary.id);
  }

  /**
   * Splits a specific comment into a new standalone ticket (Zoho Desk model).
   * - Creates new Ticket with the comment content as its initial description
   * - Sets requester to the comment author (if customer) or source ticket requester
   * - Links parent ticket and split ticket via TicketLink (RELATED)
   * - Emits audit events on both parent and split tickets
   * - Initializes SLA clocks for the new ticket
   */
  async split(principal: AuthenticatedPrincipal, sourceTicketId: string, dto: SplitTicketDto) {
    const tenantId = this.requireTenant(principal);
    const { commentId, subject, description, priority, type, category, subcategory, tier, organization, product, teamId, assigneeId } = dto;

    const source = await this.findByIdOrThrow(principal, sourceTicketId);

    // Find the comment in the database
    const comment = await this.prisma.client.ticketComment.findFirst({
      where: {
        id: commentId,
        ticketId: source.id,
        tenantId,
      },
      include: {
        author: {
          select: { id: true, email: true, fullName: true, kind: true },
        },
      },
    });

    if (!comment) {
      throw AppException.notFound('Comment not found on the specified ticket.');
    }

    // Determine requester: if comment author is CUSTOMER, use author; else fallback to source ticket's requester
    const requesterId = comment.author?.kind === 'CUSTOMER' ? comment.author.id : source.requester?.id || principal.userId;

    const createdSplitTicket = await this.prisma.run(async (tx) => {
      const brandId = source.brandId;

      const tenant = await tx.tenant.findUniqueOrThrow({
        where: { id: tenantId },
        select: { ticketPrefix: true },
      });

      const sequence = await this.prisma.nextTicketSequence(tx, tenantId);
      const number = `${tenant.ticketPrefix}-${sequence}`;

      const targetPriority = priority || source.priority || 'NORMAL';
      const targetType = type || source.type || 'INCIDENT';
      const targetCategory = category !== undefined ? category : source.category;
      const targetSubcategory = subcategory !== undefined ? subcategory : source.subcategory;
      const targetTier = tier || 'L1';

      const customFields = (source.customFields && typeof source.customFields === 'object') ? { ...(source.customFields as any) } : {};
      if (organization !== undefined) {
        if (organization) customFields.organization = organization;
        else delete customFields.organization;
      }
      if (product !== undefined) {
        if (product) customFields.product = product;
        else delete customFields.product;
      }

      const finalDescription = (description && description.trim().length > 0) ? description.trim() : comment.body;

      const created = await tx.ticket.create({
        data: {
          tenantId,
          brandId,
          number,
          sequence,
          subject: subject.trim(),
          description: finalDescription,
          priority: targetPriority,
          type: targetType,
          channel: source.channel || 'EMAIL',
          category: targetCategory ?? null,
          subcategory: targetSubcategory ?? null,
          requesterId,
          status: 'OPEN',
          tier: targetTier,
          teamId: teamId ?? null,
          assigneeId: assigneeId ?? null,
          lastActivityAt: new Date(),
          customFields: customFields as Prisma.InputJsonValue,
        },
        select: { id: true, number: true, subject: true, status: true, priority: true, tier: true },
      });

      // Link source ticket -> new split ticket (RELATED)
      await tx.ticketLink.create({
        data: {
          tenantId,
          sourceId: source.id,
          targetId: created.id,
          type: 'RELATED',
          createdById: principal.userId,
        },
      });

      // Record CREATED event on new ticket
      await this.recordEvent(tx, {
        tenantId,
        ticketId: created.id,
        type: 'CREATED',
        actorId: principal.userId,
        toValue: created.number,
        metadata: {
          action: 'SPLIT_FROM_PARENT',
          parentTicketId: source.id,
          parentTicketNumber: source.number,
          commentId: comment.id,
          channel: source.channel,
          priority: targetPriority,
          ...(customFields.organization ? { organization: customFields.organization } : {}),
          ...(customFields.product ? { productName: customFields.product } : {}),
        },
      });

      // Record LINKED event on parent ticket
      await this.recordEvent(tx, {
        tenantId,
        ticketId: source.id,
        type: 'LINKED',
        actorId: principal.userId,
        toValue: created.number,
        metadata: {
          action: 'SPLIT_TO_NEW_TICKET',
          splitTicketId: created.id,
          splitTicketNumber: created.number,
          commentId: comment.id,
        },
      });

      await this.applyAutoDomainTags(tx, tenantId, created.id, requesterId);
      if (targetCategory) {
        await this.applyAutoCategoryKeywords(tx, tenantId, created.id, created.subject, comment.body, customFields);
      }

      await this.sla.initializeClocksForTicket(tx, tenantId, {
        id: created.id,
        number: created.number,
        priority: created.priority,
        brandId,
        category: targetCategory,
        createdAt: new Date(),
      });

      return created;
    });

    return this.findByIdOrThrow(principal, createdSplitTicket.id);
  }

  // =========================================================================
  // Internals
  // =========================================================================

  private requireTenant(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantId) {
      throw new AppException(
        ErrorCode.TENANT_CONTEXT_MISSING,
        400,
        'This operation requires a tenant context. Platform operators must act within a tenant.',
      );
    }

    return principal.tenantId;
  }

  /** Resolves the target brand, defaulting to the tenant's default brand. */
  private async resolveBrandId(
    tx: TenantTransaction,
    tenantId: string,
    requested?: string,
  ): Promise<string> {
    if (requested) {
      const brand = await tx.brand.findFirst({
        where: { id: requested, tenantId, deletedAt: null, isActive: true },
        select: { id: true },
      });

      if (!brand) {
        throw AppException.unprocessable('Unknown or inactive brand.', [
          { path: 'brandId', message: 'not found for this tenant' },
        ]);
      }

      return brand.id;
    }

    const fallback = await tx.brand.findFirst({
      where: { tenantId, isDefault: true, deletedAt: null },
      select: { id: true },
    });

    if (!fallback) {
      // A tenant without a default brand is a provisioning fault, not a client error.
      throw AppException.internal(`Tenant ${tenantId} has no default brand configured.`, {
        logContext: { tenantId },
      });
    }

    return fallback.id;
  }

  /** Creates tags on demand and links them, keeping the usage counter accurate. */
  private async attachTags(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    names: string[],
    actorId: string,
  ): Promise<void> {
    for (const rawName of [...new Set(names)]) {
      const name = rawName.trim();
      if (!name) continue;

      const slug = slugify(name);

      const tag = await tx.tag.upsert({
        where: { tenantId_slug: { tenantId, slug } },
        update: {},
        create: { tenantId, name, slug },
        select: { id: true, name: true },
      });

      const existing = await tx.ticketTag.findFirst({
        where: { ticketId, tagId: tag.id },
        select: { ticketId: true },
      });

      if (existing) continue;

      await tx.ticketTag.create({
        data: { tenantId, ticketId, tagId: tag.id, addedById: actorId },
      });

      await tx.tag.update({ where: { id: tag.id }, data: { usageCount: { increment: 1 } } });

      await this.recordEvent(tx, {
        tenantId,
        ticketId,
        type: 'TAG_ADDED',
        actorId,
        toValue: tag.name,
      });
    }
  }

  /** List all tags for the tenant with usage counts and auto-tagging domain rules. */
  async listTags(principal: AuthenticatedPrincipal) {
    const tenantId = this.requireTenant(principal);
    return this.prisma.client.tag.findMany({
      where: { tenantId },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
    });
  }

  /** Creates a new tag or updates its domain rules. */
  async createTag(principal: AuthenticatedPrincipal, dto: CreateTagDto) {
    const tenantId = this.requireTenant(principal);
    const slug = slugify(dto.name);
    return this.prisma.client.tag.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {
        name: dto.name,
        color: dto.color ?? undefined,
        domains: dto.domains !== undefined ? dto.domains : undefined,
        organization: dto.organization !== undefined ? dto.organization : undefined,
        product: dto.product !== undefined ? dto.product : undefined,
      },
      create: {
        tenantId,
        name: dto.name,
        slug,
        color: dto.color ?? '#64748B',
        domains: dto.domains ?? null,
        organization: dto.organization ?? null,
        product: dto.product ?? null,
      },
    });
  }

  /** Updates an existing tag by id. */
  async updateTag(principal: AuthenticatedPrincipal, id: string, dto: UpdateTagDto) {
    const tenantId = this.requireTenant(principal);
    const existing = await this.prisma.client.tag.findFirstOrThrow({
      where: { id, tenantId },
    });

    const slug = dto.name ? slugify(dto.name) : undefined;
    return this.prisma.client.tag.update({
      where: { id: existing.id },
      data: {
        name: dto.name ?? undefined,
        slug,
        color: dto.color ?? undefined,
        domains: dto.domains !== undefined ? dto.domains : undefined,
        organization: dto.organization !== undefined ? dto.organization : undefined,
        product: dto.product !== undefined ? dto.product : undefined,
      },
    });
  }

  /** Deletes a tag by id. */
  async deleteTag(principal: AuthenticatedPrincipal, id: string) {
    const tenantId = this.requireTenant(principal);
    const existing = await this.prisma.client.tag.findFirstOrThrow({
      where: { id, tenantId },
    });
    await this.prisma.client.tag.delete({
      where: { id: existing.id },
    });
  }

  /** List all ticket categories for the tenant with usage counts and keyword rules. */
  async listCategories(principal: AuthenticatedPrincipal) {
    const tenantId = this.requireTenant(principal);
    const categoryDelegate = (this.prisma.client as any).category;
    return categoryDelegate.findMany({
      where: { tenantId },
      orderBy: [{ usageCount: 'desc' }, { name: 'asc' }],
    });
  }

  /** Creates a new category or updates its keyword rules. */
  async createCategory(principal: AuthenticatedPrincipal, dto: CreateCategoryDto) {
    const tenantId = this.requireTenant(principal);
    const slug = slugify(dto.name);
    const categoryDelegate = (this.prisma.client as any).category;
    return categoryDelegate.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {
        name: dto.name,
        color: dto.color ?? undefined,
        keywords: dto.keywords !== undefined ? dto.keywords : undefined,
      },
      create: {
        tenantId,
        name: dto.name,
        slug,
        color: dto.color ?? '#6366f1',
        keywords: dto.keywords ?? null,
      },
    });
  }

  /** Updates an existing category by id. */
  async updateCategory(principal: AuthenticatedPrincipal, id: string, dto: UpdateCategoryDto) {
    const tenantId = this.requireTenant(principal);
    const categoryDelegate = (this.prisma.client as any).category;
    const existing = await categoryDelegate.findFirstOrThrow({
      where: { id, tenantId },
    });

    const slug = dto.name ? slugify(dto.name) : undefined;
    return categoryDelegate.update({
      where: { id: existing.id },
      data: {
        name: dto.name ?? undefined,
        slug,
        color: dto.color ?? undefined,
        keywords: dto.keywords !== undefined ? dto.keywords : undefined,
      },
    });
  }

  /** Deletes a category by id. */
  async deleteCategory(principal: AuthenticatedPrincipal, id: string) {
    const tenantId = this.requireTenant(principal);
    const categoryDelegate = (this.prisma.client as any).category;
    const existing = await categoryDelegate.findFirstOrThrow({
      where: { id, tenantId },
    });
    await categoryDelegate.delete({
      where: { id: existing.id },
    });
  }

  /** List all client organizations for the tenant. */
  async listOrganizations(principal: AuthenticatedPrincipal) {
    const tenantId = this.requireTenant(principal);
    const orgDelegate = (this.prisma.client as any).organization;
    return orgDelegate.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }],
    });
  }

  /** Creates a new organization or updates an existing one by slug. */
  async createOrganization(principal: AuthenticatedPrincipal, dto: CreateOrganizationDto) {
    const tenantId = this.requireTenant(principal);
    const slug = slugify(dto.name);
    const orgDelegate = (this.prisma.client as any).organization;
    return orgDelegate.upsert({
      where: { tenantId_slug: { tenantId, slug } },
      update: {
        name: dto.name,
        domains: dto.domains !== undefined ? dto.domains : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        website: dto.website !== undefined ? dto.website : undefined,
        contactName: dto.contactName !== undefined ? dto.contactName : undefined,
        contactEmail: dto.contactEmail !== undefined ? dto.contactEmail : undefined,
        contactPhone: dto.contactPhone !== undefined ? dto.contactPhone : undefined,
        product: dto.product !== undefined ? dto.product : undefined,
      },
      create: {
        tenantId,
        name: dto.name,
        slug,
        domains: dto.domains ?? null,
        description: dto.description ?? null,
        website: dto.website ?? null,
        contactName: dto.contactName ?? null,
        contactEmail: dto.contactEmail || null,
        contactPhone: dto.contactPhone ?? null,
        product: dto.product ?? null,
      },
    });
  }

  /** Updates an organization by id. */
  async updateOrganization(principal: AuthenticatedPrincipal, id: string, dto: UpdateOrganizationDto) {
    const tenantId = this.requireTenant(principal);
    const orgDelegate = (this.prisma.client as any).organization;
    const existing = await orgDelegate.findFirstOrThrow({
      where: { id, tenantId },
    });

    const slug = dto.name ? slugify(dto.name) : undefined;
    return orgDelegate.update({
      where: { id: existing.id },
      data: {
        name: dto.name ?? undefined,
        slug,
        domains: dto.domains !== undefined ? dto.domains : undefined,
        description: dto.description !== undefined ? dto.description : undefined,
        website: dto.website !== undefined ? dto.website : undefined,
        contactName: dto.contactName !== undefined ? dto.contactName : undefined,
        contactEmail: dto.contactEmail !== undefined ? (dto.contactEmail || null) : undefined,
        contactPhone: dto.contactPhone !== undefined ? dto.contactPhone : undefined,
        product: dto.product !== undefined ? dto.product : undefined,
      },
    });
  }

  /** Deletes an organization by id. */
  async deleteOrganization(principal: AuthenticatedPrincipal, id: string) {
    const tenantId = this.requireTenant(principal);
    const orgDelegate = (this.prisma.client as any).organization;
    const existing = await orgDelegate.findFirstOrThrow({
      where: { id, tenantId },
    });
    await orgDelegate.delete({
      where: { id: existing.id },
    });
  }

  /** Bulk imports / upserts multiple organizations for the tenant. */
  async bulkImportOrganizations(principal: AuthenticatedPrincipal, items: CreateOrganizationDto[]) {
    const tenantId = this.requireTenant(principal);
    const orgDelegate = (this.prisma.client as any).organization;
    let created = 0;
    let updated = 0;

    for (const dto of items) {
      if (!dto.name || !dto.name.trim()) continue;
      const slug = slugify(dto.name);

      const existing = await orgDelegate.findUnique({
        where: { tenantId_slug: { tenantId, slug } },
      });

      if (existing) {
        // Merge domains
        const existingDomains = (existing.domains || '')
          .split(/[\s,;]+/)
          .map((d: string) => d.trim().toLowerCase().replace(/^@/, ''))
          .filter(Boolean);
        const incomingDomains = (dto.domains || '')
          .split(/[\s,;]+/)
          .map((d: string) => d.trim().toLowerCase().replace(/^@/, ''))
          .filter(Boolean);

        for (const d of incomingDomains) {
          if (!existingDomains.includes(d)) {
            existingDomains.push(d);
          }
        }

        await orgDelegate.update({
          where: { id: existing.id },
          data: {
            domains: existingDomains.join(', ') || null,
            website: dto.website !== undefined && dto.website !== null && dto.website !== '' ? dto.website : existing.website,
            description: dto.description !== undefined && dto.description !== null && dto.description !== '' ? dto.description : existing.description,
            contactName: dto.contactName !== undefined && dto.contactName !== null && dto.contactName !== '' ? dto.contactName : existing.contactName,
            contactEmail: dto.contactEmail !== undefined && dto.contactEmail !== null && dto.contactEmail !== '' ? (dto.contactEmail || null) : existing.contactEmail,
            contactPhone: dto.contactPhone !== undefined && dto.contactPhone !== null && dto.contactPhone !== '' ? dto.contactPhone : existing.contactPhone,
            product: dto.product !== undefined && dto.product !== null && dto.product !== '' ? dto.product : existing.product,
          },
        });
        updated++;
      } else {
        await orgDelegate.create({
          data: {
            tenantId,
            name: dto.name.trim(),
            slug,
            domains: dto.domains ?? null,
            description: dto.description ?? null,
            website: dto.website ?? null,
            contactName: dto.contactName ?? null,
            contactEmail: dto.contactEmail || null,
            contactPhone: dto.contactPhone ?? null,
            product: dto.product ?? null,
          },
        });
        created++;
      }
    }

    return { total: items.length, created, updated };
  }

  /** Bulk deletes organizations by ids. */
  async bulkDeleteOrganizations(principal: AuthenticatedPrincipal, ids: string[]) {
    const tenantId = this.requireTenant(principal);
    const orgDelegate = (this.prisma.client as any).organization;
    const res = await orgDelegate.deleteMany({
      where: {
        id: { in: ids },
        tenantId,
      },
    });
    return { count: res.count };
  }

  /** Automatically matches ticket subject, description, and custom fields against category keyword rules. */
  private async applyAutoCategoryKeywords(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    subject: string,
    description?: string | null,
    customFields?: any,
  ): Promise<void> {
    try {
      const currentTicket = await tx.ticket.findUnique({
        where: { id: ticketId },
        select: { category: true },
      });
      if (currentTicket?.category) return;

      const categoryDelegate = (tx as any).category || (this.prisma.client as any).category;
      const allCategories = await categoryDelegate.findMany({
        where: { tenantId, keywords: { not: null } },
      });

      if (allCategories.length === 0) return;

      const searchableText = [
        subject || '',
        description || '',
        typeof customFields === 'object' && customFields !== null
          ? JSON.stringify(customFields)
          : String(customFields || ''),
      ]
        .join(' ')
        .toLowerCase();

      for (const cat of allCategories) {
        if (!cat.keywords) continue;
        const keywordList = Array.from<string>(
          new Set(
            cat.keywords
              .split(/[,;\n]+/)
              .map((k: string) => k.toLowerCase().trim())
              .filter((k: string) => k.length >= 2),
          ),
        );

        const isMatch = keywordList.some((kw: string) => {
          if (kw.length < 2) return false;
          // Word boundary or substring match in content
          return searchableText.includes(kw);
        });

        if (isMatch) {
          await tx.ticket.update({
            where: { id: ticketId },
            data: { category: cat.name },
          });

          await categoryDelegate.update({
            where: { id: cat.id },
            data: { usageCount: { increment: 1 } },
          });

          await this.recordEvent(tx, {
            tenantId,
            ticketId,
            type: 'CATEGORY_CHANGED',
            toValue: cat.name,
            metadata: { autoCategoryRule: cat.name },
          });

          break; // Stop after first matched category
        }
      }
    } catch (err) {
      this.logger.warn({ err, ticketId }, 'Failed to apply auto category keywords');
    }
  }

  /** Automatically matches requester email or email domain against tag auto-rules and tags ticket. */
  private async applyAutoDomainTags(
    tx: TenantTransaction,
    tenantId: string,
    ticketId: string,
    requesterId: string,
  ): Promise<void> {
    try {
      const requester = await tx.user.findUnique({
        where: { id: requesterId },
        select: { email: true },
      });
      if (!requester?.email || !requester.email.includes('@')) return;

      const requesterEmail = requester.email.toLowerCase().trim();
      const emailDomain = requesterEmail.split('@')[1]?.toLowerCase().trim();
      if (!emailDomain) return;

      const allTags = await tx.tag.findMany({
        where: { tenantId, domains: { not: null } },
      });

      for (const tag of allTags) {
        if (!tag.domains) continue;
        const ruleList = tag.domains
          .split(/[\s,;]+/)
          .map((d) => d.toLowerCase().trim())
          .filter(Boolean);

        // Matches exact full email (e.g. "vip.client@gmail.com") OR domain (e.g. "company.com" or "@company.com")
        const isMatch = ruleList.some((rule) => {
          const cleanRule = rule.replace(/^@/, '');
          return rule === requesterEmail || cleanRule === requesterEmail || cleanRule === emailDomain;
        });

        if (isMatch) {
          const existing = await tx.ticketTag.findFirst({
            where: { ticketId, tagId: tag.id },
            select: { ticketId: true },
          });
          if (!existing) {
            await tx.ticketTag.create({
              data: { tenantId, ticketId, tagId: tag.id },
            });
            await tx.tag.update({
              where: { id: tag.id },
              data: { usageCount: { increment: 1 } },
            });
            await this.recordEvent(tx, {
              tenantId,
              ticketId,
              type: 'TAG_ADDED',
              toValue: tag.name,
              metadata: { autoTagRule: requesterEmail },
            });
          }

          // Automatically assign mapped organization and/or product if configured on this tag
          if (tag.organization || tag.product) {
            const ticketRecord = await tx.ticket.findUnique({
              where: { id: ticketId },
              select: { customFields: true },
            });
            const currentFields = (ticketRecord?.customFields && typeof ticketRecord.customFields === 'object'
              ? { ...(ticketRecord.customFields as Record<string, any>) }
              : {}) as Record<string, any>;

            let fieldsUpdated = false;
            if (tag.organization && !currentFields.organization) {
              currentFields.organization = tag.organization;
              fieldsUpdated = true;
            }
            if (tag.product && !currentFields.product) {
              currentFields.product = tag.product;
              fieldsUpdated = true;
            }

            if (fieldsUpdated) {
              await tx.ticket.update({
                where: { id: ticketId },
                data: { customFields: currentFields as Prisma.InputJsonValue },
              });
            }
          }
        }
      }
    } catch (err) {
      this.logger.warn({ err, ticketId }, 'Failed to apply auto domain tags');
    }
  }

  /**
   * Intelligently detects organization/hospital/client name from sender email domain.
   * Special domain mappings for known hospital groups + dynamic title-casing for corporate/hospital domains.
   */
  detectOrganizationFromEmail(email: string): string | null {
    if (!email || !email.includes('@')) return null;
    const domain = email.split('@')[1]?.toLowerCase().trim();
    if (!domain) return null;

    // Common public email providers to ignore
    const genericProviders = [
      'gmail.com',
      'yahoo.com',
      'hotmail.com',
      'outlook.com',
      'icloud.com',
      'aol.com',
      'protonmail.com',
      'zoho.com',
      'mail.com',
      'yandex.com',
      'abi-health.com',
      'abihealth.in',
    ];
    if (genericProviders.includes(domain)) return null;

    // Known healthcare & enterprise hospital domain overrides
    const domainMap: Record<string, string> = {
      'sriramachandra.edu.in': 'Sri Ramachandra Medical Center',
      'srmc.org': 'Sri Ramachandra Medical Center',
      'kdhospital.com': 'Kusum Dhirajlal Hospital',
      'kusum.org': 'Kusum Dhirajlal Hospital',
      'apollohospitals.com': 'Apollo Hospitals',
      'fortishealthcare.com': 'Fortis Healthcare',
      'manipalhospitals.com': 'Manipal Hospitals',
      'narayanahealth.org': 'Narayana Health',
      'maxhealthcare.com': 'Max Healthcare',
      'asterdmhealthcare.com': 'Aster DM Healthcare',
      'medanta.org': 'Medanta - The Medicity',
    };

    if (domainMap[domain]) {
      return domainMap[domain];
    }

    // Auto-generate clean organization name from domain (e.g. "kdhospital.in" -> "Kd Hospital")
    const mainPart = domain.split('.')[0];
    if (!mainPart || mainPart.length < 3) return null;

    return mainPart
      .replace(/[-_]+/g, ' ')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /** Appends a timeline event. */
  private async recordEvent(
    tx: TenantTransaction,
    event: {
      tenantId: string;
      ticketId: string;
      type: TicketEventType;
      actorId?: string | null;
      actorLabel?: string | null;
      fromValue?: string | null;
      toValue?: string | null;
      metadata?: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await tx.ticketEvent.create({
      data: {
        tenantId: event.tenantId,
        ticketId: event.ticketId,
        type: event.type,
        actorId: event.actorId ?? null,
        actorType: event.actorId ? 'USER' : 'SYSTEM',
        actorLabel: event.actorLabel ?? null,
        fromValue: event.fromValue ?? null,
        toValue: event.toValue ?? null,
        ...(event.metadata ? { metadata: event.metadata } : {}),
      },
    });
  }

  /**
   * Writes a transactional outbox row.
   *
   * Committed with the domain change, published later by the worker. Enqueueing
   * directly would risk losing the event if the process died between the commit and
   * the enqueue - which is exactly what makes webhook delivery untrustworthy.
   */
  private async emit(
    tx: TenantTransaction,
    tenantId: string,
    eventType: string,
    aggregateId: string,
    payload: Prisma.InputJsonValue,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: { tenantId, eventType, aggregateType: 'ticket', aggregateId, payload },
    });
  }

  private buildWhere(
    principal: AuthenticatedPrincipal,
    query: ListTicketsDto,
    scopeFilter: Prisma.TicketWhereInput,
  ): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = { deletedAt: null, ...scopeFilter };

    if (query.status?.length) where.status = { in: query.status };
    if (query.priority?.length) where.priority = { in: query.priority };
    if (query.tier?.length) where.tier = { in: query.tier };
    if (query.type?.length) where.type = { in: query.type };
    if (query.channel?.length) where.channel = { in: query.channel };

    if (query.assignee === 'me') where.assigneeId = principal.userId;
    else if (query.assigneeId) where.assigneeId = query.assigneeId;

    if (query.unassigned) where.assigneeId = null;
    if (query.requesterId) where.requesterId = query.requesterId;
    if (query.queueId) where.queueId = query.queueId;
    if (query.teamId) where.teamId = query.teamId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.category) where.category = query.category;

    if (query.openOnly) {
      where.status = { notIn: ['CLOSED', 'CANCELLED', 'RESOLVED'] };
    }

    if (query.breached) {
      // A breach is recorded on the SLA clock, not the ticket, so this filters
      // through the relation rather than a denormalised flag that could drift.
      where.slaStates = { some: { status: 'BREACHED' } };
    }

    if (query.tag) {
      where.tags = { some: { tag: { slug: slugify(query.tag) } } };
    }

    const andFilters: Prisma.TicketWhereInput[] = [];

    if (query.organization) {
      andFilters.push({
        customFields: {
          path: ['organization'],
          string_contains: query.organization,
        },
      });
    }

    if (query.product) {
      andFilters.push({
        customFields: {
          path: ['product'],
          string_contains: query.product,
        },
      });
    }

    if (andFilters.length > 0) {
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        ...andFilters,
      ];
    }

    if (query.createdAfter || query.createdBefore) {
      where.createdAt = {
        ...(query.createdAfter ? { gte: query.createdAfter } : {}),
        ...(query.createdBefore ? { lte: query.createdBefore } : {}),
      };
    }

    return where;
  }

  private buildOrderBy(query: ListTicketsDto): Prisma.TicketOrderByWithRelationInput[] {
    const direction = query.order;

    switch (query.sort) {
      case 'priority':
        // Enum ordering follows declaration order (LOW..CRITICAL), so descending puts
        // the most urgent first. `id` breaks ties for a stable page boundary.
        return [{ priority: direction }, { lastActivityAt: 'desc' }, { id: 'asc' }];
      case 'number':
        return [{ sequence: direction }, { id: 'asc' }];
      case 'createdAt':
        return [{ createdAt: direction }, { id: 'asc' }];
      case 'updatedAt':
        return [{ updatedAt: direction }, { id: 'asc' }];
      case 'relevance':
      case 'lastActivityAt':
      default:
        return [{ lastActivityAt: direction }, { id: 'asc' }];
    }
  }

  /**
   * Full-text search path.
   *
   * `websearch_to_tsquery` is used rather than `to_tsquery` because it accepts what
   * users actually type - quoted phrases, `or`, a stray hyphen - instead of throwing a
   * syntax error on unbalanced input.
   */
  private async searchList(
    principal: AuthenticatedPrincipal,
    query: ListTicketsDto,
    where: Prisma.TicketWhereInput,
  ) {
    const term = query.q!.trim();
    const skip = (query.page - 1) * query.pageSize;
    const likePattern = `%${term}%`;

    const scoped = await this.prisma.client.ticket.findMany({
      where,
      select: { id: true },
      // Bounded: full-text candidates are intersected with the scope filter in
      // memory, so the ceiling keeps a pathological query from loading the backlog.
      take: 5_000,
    });

    if (scoped.length === 0) {
      return { tickets: [], total: 0, page: query.page, pageSize: query.pageSize, pages: 0 };
    }

    const allowedIds = scoped.map((row) => row.id);

    const ranked = await this.prisma.client.$queryRaw<Array<{ id: string; rank: number }>>`
      SELECT t.id,
        (
          COALESCE(ts_rank(t."searchVector", websearch_to_tsquery('english', ${term})), 0.0) +
          CASE WHEN t.number ILIKE ${likePattern} THEN 3.0 ELSE 0.0 END +
          CASE WHEN u.email ILIKE ${likePattern} THEN 2.5 ELSE 0.0 END +
          CASE WHEN u."fullName" ILIKE ${likePattern} THEN 2.0 ELSE 0.0 END +
          CASE WHEN EXISTS (
            SELECT 1 FROM ticket_tag tt 
            JOIN tag tg ON tt."tagId" = tg.id 
            WHERE tt."ticketId" = t.id AND (tg.name ILIKE ${likePattern} OR tg.slug ILIKE ${likePattern})
          ) THEN 2.0 ELSE 0.0 END +
          CASE WHEN t."customFields"::text ILIKE ${likePattern} THEN 1.0 ELSE 0.0 END
        )::float AS rank
      FROM ticket t
      LEFT JOIN "user" u ON t."requesterId" = u.id
      WHERE t.id = ANY(${allowedIds}::uuid[])
        AND (
          t."searchVector" @@ websearch_to_tsquery('english', ${term})
          OR t.number ILIKE ${likePattern}
          OR u.email ILIKE ${likePattern}
          OR u."fullName" ILIKE ${likePattern}
          OR t."customFields"::text ILIKE ${likePattern}
          OR EXISTS (
            SELECT 1 FROM ticket_tag tt 
            JOIN tag tg ON tt."tagId" = tg.id 
            WHERE tt."ticketId" = t.id AND (tg.name ILIKE ${likePattern} OR tg.slug ILIKE ${likePattern})
          )
        )
      ORDER BY rank DESC, t."lastActivityAt" DESC
      LIMIT ${query.pageSize} OFFSET ${skip}
    `;

    const total = await this.prisma.client.$queryRaw<Array<{ count: bigint }>>`
      SELECT count(*)::bigint AS count
      FROM ticket t
      LEFT JOIN "user" u ON t."requesterId" = u.id
      WHERE t.id = ANY(${allowedIds}::uuid[])
        AND (
          t."searchVector" @@ websearch_to_tsquery('english', ${term})
          OR t.number ILIKE ${likePattern}
          OR u.email ILIKE ${likePattern}
          OR u."fullName" ILIKE ${likePattern}
          OR t."customFields"::text ILIKE ${likePattern}
          OR EXISTS (
            SELECT 1 FROM ticket_tag tt 
            JOIN tag tg ON tt."tagId" = tg.id 
            WHERE tt."ticketId" = t.id AND (tg.name ILIKE ${likePattern} OR tg.slug ILIKE ${likePattern})
          )
        )
    `;

    const rankedIds = ranked.map((row) => row.id);

    const rows = await this.prisma.client.ticket.findMany({
      where: { id: { in: rankedIds } },
      select: TICKET_LIST_SELECT,
    });

    // Restore relevance order, which `findMany` does not preserve.
    const byId = new Map(rows.map((row) => [row.id, row]));
    const tickets = rankedIds
      .map((id) => byId.get(id))
      .filter((row): row is (typeof rows)[number] => row !== undefined);

    const count = Number(total[0]?.count ?? 0);

    return {
      tickets,
      total: count,
      page: query.page,
      pageSize: query.pageSize,
      pages: Math.ceil(count / query.pageSize),
    };
  }

  async createFromInboundEmail(payload: {
    from: string;
    to: string;
    subject: string;
    body: string;
    attachments?: Array<{
      file_name?: string;
      fileName?: string;
      filename?: string;
      name?: string;
      content_type?: string;
      contentType?: string;
      type?: string;
      content?: string;
      data?: string;
      base64?: string;
      size?: number;
    }>;
    inReplyTo?: string;
    references?: string;
    messageId?: string;
  }) {
    const senderEmail = parseEmailAddress(payload.from);
    const senderName = parseEmailName(payload.from);

    const recipient = parseEmailAddress(payload.to);
    const tenantSlug = resolveTenantSlug(recipient);
    if (!tenantSlug) {
      throw AppException.badRequest('Inbound email recipient is not formatted correctly with a tenant slug.');
    }

    const ticket = await this.prisma.unsafeRawClient.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;

      const tenant = await tx.tenant.findUnique({
        where: { slug: tenantSlug },
        select: { id: true, ticketPrefix: true },
      });
      if (!tenant) {
        throw AppException.notFound(`Tenant with slug "${tenantSlug}" was not found.`);
      }
      const tenantId = tenant.id;

      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'off', true)`;
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}::text, true)`;

      const brandId = await this.resolveBrandId(tx, tenantId);

      let requester = await tx.user.findFirst({
        where: { tenantId, email: senderEmail },
        select: { id: true },
      });

      if (!requester) {
        const guestRole = await tx.role.findUnique({
          where: { key: 'GUEST_CUSTOMER' },
          select: { id: true },
        });

        requester = await tx.user.create({
          data: {
            tenantId,
            email: senderEmail,
            fullName: senderName || senderEmail.split('@')[0] || 'Email Requester',
            kind: 'CUSTOMER',
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
            isAvailable: false,
            ...(guestRole ? {
              roles: {
                create: { roleId: guestRole.id, tenantId },
              },
            } : {}),
          },
          select: { id: true },
        });
      }

      // Check if this inbound email is a reply to an existing ticket.
      const subject = payload.subject || '';
      const cleanSubject = stripSubjectPrefixes(subject);
      const isReplyOrFwd = isReplySubject(subject) || Boolean(payload.inReplyTo || payload.references);

      let existingTicket: { id: string; status: any; number?: string; subject?: string } | null = null;

      // Strategy 1: Explicit Ticket Number in Subject (e.g. "[Ticket #ABI-4556]" or "ABI-4556")
      const subjectTicketMatch = subject.match(/\[Ticket #([A-Z0-9]+-\d+)\]/i) || subject.match(/\b([A-Z0-9]+-\d+)\b/i);
      if (subjectTicketMatch && subjectTicketMatch[1]) {
        const ticketNumber = subjectTicketMatch[1].toUpperCase();
        existingTicket = await tx.ticket.findFirst({
          where: { tenantId, number: ticketNumber, deletedAt: null },
          select: { id: true, status: true, number: true },
        });
      }

      // Strategy 2: Explicit Ticket Number in Quoted Email Body (e.g. "[Ticket #ABI-4556]" or "Ticket #ABI-4556")
      if (!existingTicket && payload.body) {
        const bodyTicketMatch = payload.body.match(/\[Ticket #([A-Z0-9]+-\d+)\]/i) || payload.body.match(/Ticket #\s*([A-Z0-9]+-\d+)/i);
        if (bodyTicketMatch && bodyTicketMatch[1]) {
          const ticketNumber = bodyTicketMatch[1].toUpperCase();
          existingTicket = await tx.ticket.findFirst({
            where: { tenantId, number: ticketNumber, deletedAt: null },
            select: { id: true, status: true, number: true },
          });
        }
      }

      // Strategy 3: Email Thread Subject Matching for this Requester
      // If it's a reply/forward (e.g. "Re: testing") or has In-Reply-To/References,
      // match against recent tickets created by the same requester with matching base subject.
      if (!existingTicket && cleanSubject && (isReplyOrFwd || cleanSubject.length > 0)) {
        const candidateTickets = await tx.ticket.findMany({
          where: {
            tenantId,
            requesterId: requester.id,
            deletedAt: null,
          },
          orderBy: { createdAt: 'desc' },
          take: 15,
          select: { id: true, status: true, number: true, subject: true },
        });

        for (const candidate of candidateTickets) {
          const candidateClean = stripSubjectPrefixes(candidate.subject);
          if (candidateClean.toLowerCase() === cleanSubject.toLowerCase()) {
            existingTicket = candidate;
            break;
          }
        }
      }

      if (existingTicket) {
          const createdComment = await tx.ticketComment.create({
            data: {
              tenantId,
              ticketId: existingTicket.id,
              authorId: requester.id,
              visibility: 'PUBLIC',
              body: payload.body || '(No content)',
              bodyFormat: 'PLAIN',
            },
            select: { id: true },
          });

          // Upload and record any attachments on the comment
          let commentAttachmentCount = 0;
          if (payload.attachments && payload.attachments.length > 0) {
            for (const att of payload.attachments) {
              const rawContent = att.content || att.data || att.base64;
              if (!rawContent) continue;

              const filename = sanitizeFilename(att.file_name || att.fileName || att.filename || att.name || 'attachment');
              const mimeType = att.content_type || att.contentType || att.type || 'application/octet-stream';
              const buffer = Buffer.from(rawContent, 'base64');
              if (buffer.length === 0) continue;

              const mediaId = randomUUID();
              const storageKey = buildInboundStorageKey(tenantId, mediaId, mimeType);
              const checksum = createHash('sha256').update(buffer).digest('hex');

              await this.storage.putObjectBuffer(storageKey, buffer, mimeType);

              await tx.mediaAsset.create({
                data: {
                  id: mediaId,
                  tenantId,
                  ticketId: existingTicket.id,
                  commentId: createdComment.id,
                  uploadedById: requester.id,
                  kind: 'ATTACHMENT',
                  status: 'UPLOADED',
                  storageKey,
                  bucket: this.storage.bucket,
                  originalFilename: filename,
                  mimeType,
                  declaredMimeType: mimeType,
                  sizeBytes: BigInt(buffer.length),
                  checksumSha256: checksum,
                  scanStatus: 'CLEAN',
                  uploadedAt: new Date(),
                },
              });
              commentAttachmentCount++;
            }
          }

          const shouldReopen = existingTicket.status === 'CLOSED' || existingTicket.status === 'RESOLVED';

          await tx.ticket.update({
            where: { id: existingTicket.id },
            data: {
              ...(shouldReopen ? { status: 'OPEN' } : {}),
              lastActivityAt: new Date(),
              publicCommentCount: { increment: 1 },
              lastCustomerReplyAt: new Date(),
              ...(commentAttachmentCount > 0 ? { attachmentCount: { increment: commentAttachmentCount } } : {}),
            },
          });

          if (shouldReopen) {
            await this.recordEvent(tx, {
              tenantId,
              ticketId: existingTicket.id,
              type: 'STATUS_CHANGED',
              actorId: requester.id,
              fromValue: existingTicket.status,
              toValue: 'OPEN',
              metadata: { reason: 'Customer email reply received' },
            });
          }

          await this.recordEvent(tx, {
            tenantId,
            ticketId: existingTicket.id,
            type: 'COMMENT_ADDED',
            actorId: requester.id,
            metadata: { commentId: createdComment.id, visibility: 'PUBLIC', attachmentsAdded: commentAttachmentCount },
          });

          await this.emit(tx, tenantId, 'ticket.commented', existingTicket.id, {
            ticketId: existingTicket.id,
            commentId: createdComment.id,
            visibility: 'PUBLIC',
            authorId: requester.id,
            isFirstResponse: false,
          });

          const ticketToReturn = await tx.ticket.findUniqueOrThrow({
            where: { id: existingTicket.id },
            select: { id: true, number: true, subject: true, status: true, priority: true },
          });

          if (this.gateway) {
            this.gateway.broadcastTicketCommented(tenantId, existingTicket.id, {
              id: createdComment.id,
              body: payload.body,
              createdAt: new Date(),
              author: { id: requester.id, fullName: senderName || senderEmail.split('@')[0] || 'Customer', email: senderEmail },
              visibility: 'PUBLIC',
            }, existingTicket.number || ticketToReturn.number);
            if (shouldReopen) {
              this.gateway.broadcastTicketUpdated(tenantId, existingTicket.id, {
                id: existingTicket.id,
                status: 'OPEN',
              });
            }
          }

          return ticketToReturn;
        }

      const sequence = await this.prisma.nextTicketSequence(tx, tenantId);
      const number = `${tenant.ticketPrefix}-${sequence}`;

      const autoOrg = this.detectOrganizationFromEmail(senderEmail);

      const created = await tx.ticket.create({
        data: {
          tenantId,
          brandId,
          number,
          sequence,
          subject: payload.subject || '(No Subject)',
          description: payload.body || '',
          priority: 'NORMAL',
          type: 'QUESTION',
          channel: 'EMAIL',
          requesterId: requester.id,
          status: 'NEW',
          tier: 'L1',
          lastActivityAt: new Date(),
          customFields: autoOrg ? { organization: autoOrg } : {},
        },
        select: {
          id: true,
          number: true,
          subject: true,
          status: true,
          priority: true,
          tier: true,
          channel: true,
          createdAt: true,
          updatedAt: true,
          lastActivityAt: true,
          description: true,
        },
      });

      // Upload and record any attachments on the ticket
      let ticketAttachmentCount = 0;
      if (payload.attachments && payload.attachments.length > 0) {
        for (const att of payload.attachments) {
          const rawContent = att.content || att.data || att.base64;
          if (!rawContent) continue;

          const filename = sanitizeFilename(att.file_name || att.fileName || att.filename || att.name || 'attachment');
          const mimeType = att.content_type || att.contentType || att.type || 'application/octet-stream';
          const buffer = Buffer.from(rawContent, 'base64');
          if (buffer.length === 0) continue;

          const mediaId = randomUUID();
          const storageKey = buildInboundStorageKey(tenantId, mediaId, mimeType);
          const checksum = createHash('sha256').update(buffer).digest('hex');

          await this.storage.putObjectBuffer(storageKey, buffer, mimeType);

          await tx.mediaAsset.create({
            data: {
              id: mediaId,
              tenantId,
              ticketId: created.id,
              commentId: null,
              uploadedById: requester.id,
              kind: 'ATTACHMENT',
              status: 'UPLOADED',
              storageKey,
              bucket: this.storage.bucket,
              originalFilename: filename,
              mimeType,
              declaredMimeType: mimeType,
              sizeBytes: BigInt(buffer.length),
              checksumSha256: checksum,
              scanStatus: 'CLEAN',
              uploadedAt: new Date(),
            },
          });
          ticketAttachmentCount++;
        }
      }

      if (ticketAttachmentCount > 0) {
        await tx.ticket.update({
          where: { id: created.id },
          data: { attachmentCount: ticketAttachmentCount },
        });
      }

      await this.recordEvent(tx, {
        tenantId,
        ticketId: created.id,
        type: 'CREATED',
        actorId: requester.id,
        toValue: created.number,
        metadata: {
          channel: 'EMAIL',
          priority: 'NORMAL',
          attachmentCount: ticketAttachmentCount,
          ...(autoOrg ? { organization: autoOrg } : {}),
        },
      });

      await this.applyAutoDomainTags(tx, tenantId, created.id, requester.id);
      await this.applyAutoCategoryKeywords(tx, tenantId, created.id, created.subject, payload.body || created.description);

      // Fetch fresh ticket with all tags, customFields (org/product), and category
      const freshTicket = await tx.ticket.findUnique({
        where: { id: created.id },
        select: TICKET_LIST_SELECT,
      });

      if (this.gateway) {
        this.gateway.broadcastTicketCreated(tenantId, {
          ...(freshTicket || created),
          description: payload.body || created.description,
          requester: {
            id: requester.id,
            fullName: senderName || senderEmail.split('@')[0] || 'Customer',
            email: senderEmail,
          },
        });
      }

      // Send automated acknowledgment email to customer via ServiceDesk SMTP
      this.mailService.sendTicketMail({
        to: { email: senderEmail, name: senderName || senderEmail.split('@')[0] || 'Customer' },
        subject: `[Ticket #${created.number}] Received: ${created.subject}`,
        text: `Hello ${senderName || senderEmail.split('@')[0] || 'Customer'},\n\nWe have received your support request regarding "${created.subject}" (Ticket #${created.number}). Our team is actively reviewing it and will get back to you shortly.\n\nYou can reply directly to this email at any time to provide additional details.\n\nBest regards,\nSupport Team`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px; background-color: #ffffff;">
            <div style="margin-bottom: 20px; border-bottom: 2px solid #2563eb; padding-bottom: 12px;">
              <h2 style="margin: 0; color: #2563eb; font-size: 20px;">Support Request Received</h2>
            </div>
            <p style="font-size: 15px; margin-bottom: 16px;">Hello <strong>${senderName || senderEmail.split('@')[0] || 'Customer'}</strong>,</p>
            <p style="font-size: 14px; line-height: 1.6; color: #334155; margin-bottom: 20px;">
              We have received your support request regarding <strong>"${created.subject}"</strong>. Our team is actively reviewing it and will respond as soon as possible.
            </p>
            <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px; border-radius: 0 6px 6px 0;">
              <p style="margin: 0; font-size: 13px; color: #64748b;">Ticket Reference:</p>
              <p style="margin: 4px 0 0 0; font-size: 16px; font-weight: bold; color: #0f172a;">#${created.number}</p>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
              You can reply directly to this email at any time to attach further details or follow up with our team.
            </p>
          </div>
        `,
        tag: 'ticket.created_ack',
      }).catch((err) => {
        this.logger.error({ err, ticketId: created.id }, 'Failed to send ticket creation ack email');
      });

      return created;
    });

    return ticket;
  }
}

/** URL-safe tag slug. Deterministic, so the same label always maps to one tag. */
function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function parseEmailAddress(raw: string): string {
  if (typeof raw !== 'string') {
    return String(raw || '').trim().toLowerCase();
  }
  const match = raw.match(/<([^>]+)>/);
  if (match && match[1]) {
    return match[1].trim().toLowerCase();
  }
  return raw.trim().toLowerCase();
}

function parseEmailName(raw: string): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  const match = raw.match(/^([^<]+)</);
  if (match && match[1]) {
    return match[1].trim().replace(/^['"]|['"]$/g, '');
  }
  return null;
}

function resolveTenantSlug(email: string): string | null {
  const localPart = email.split('@')[0];
  if (!localPart) return null;

  if (localPart.includes('+')) {
    return localPart.split('+')[1] || null;
  }

  if (localPart !== 'support' && localPart !== 'tickets' && localPart !== 'info') {
    return localPart;
  }

  const domainPart = email.split('@')[1];
  if (domainPart) {
    const parts = domainPart.split('.');
    if (parts.length > 2) {
      return parts[0] || null;
    }
  }
  return null;
}

function buildInboundStorageKey(
  tenantId: string,
  mediaId: string,
  mimeType: string,
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extensionForMime(mimeType);

  return `tenants/${tenantId}/attachment/${year}/${month}/${mediaId}.${ext}`;
}

function extensionForMime(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
    'application/zip': 'zip',
    'application/x-zip-compressed': 'zip',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.ms-excel': 'xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  };
  return map[mimeType.toLowerCase()] ?? 'bin';
}

function sanitizeFilename(name: string): string {
  return name.replace(/["\r\n/\\]/g, '').slice(0, 255);
}

function isReplySubject(subject: string): boolean {
  if (!subject) return false;
  return /^\s*(re|fwd|fw|aw|sv|vs|antw)\s*:/i.test(subject);
}

function stripSubjectPrefixes(subject: string): string {
  if (!subject) return '';
  return subject
    .replace(/^(\s*(re|fwd|fw|aw|sv|vs|antw)\s*:\s*)+/gi, '')
    .replace(/\[Ticket #[^\]]+\]\s*/gi, '')
    .trim();
}


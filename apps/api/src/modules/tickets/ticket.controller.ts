import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  Audited,
  CurrentUser,
  Public,
  RequireAnyPermission,
  RequirePermission,
} from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { AppException } from '../../common/errors/app-exception';
import {
  AddCommentDto,
  CreateTicketDto,
  LinkTicketDto,
  ListCommentsDto,
  ListTicketsDto,
  TagTicketDto,
  TicketIdParamDto,
  UpdateTicketDto,
} from './ticket.dto';
import { TicketService } from './ticket.service';

/**
 * Ticket endpoints.
 *
 * Each route carries the permission from the requirements' RBAC matrix. Two things
 * worth noting about how authorization is split:
 *
 *  - `@RequirePermission` decides whether the endpoint may be *called*.
 *  - The service decides which *rows* come back, via `resolveTicketScope`.
 *
 * Both are necessary. Reading is gated on holding either `ticket:read:own` or
 * `ticket:read:tenant` - the endpoint is the same for a customer and an agent, and the
 * scope resolver is what makes them see different things. Gating the endpoint on
 * `read:tenant` alone would lock customers out of their own tickets; gating on
 * `read:own` alone and filtering nothing would expose the whole tenant.
 */
@Controller({ path: 'tickets', version: '1' })
export class TicketController {
  constructor(private readonly tickets: TicketService) {}

  /** Matrix row: Create Ticket — granted to every role. */
  @Post()
  @RequirePermission('ticket:create')
  @Audited({ action: 'ticket.created', resourceType: 'ticket' })
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateTicketDto) {
    return this.tickets.create(principal, dto);
  }

  @Post('inbound-email')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  async handleInboundEmail(
    @Query('secret') secret: string,
    @Body() body: any,
  ) {
    const expectedSecret = process.env.INBOUND_EMAIL_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      throw AppException.permissionDenied('Invalid inbound email webhook secret.');
    }

    const headers = body.headers || {};

    const extractHeader = (key: string): string | undefined => {
      if (!headers || typeof headers !== 'object') return undefined;
      if (headers[key] !== undefined) {
        const val = headers[key];
        return Array.isArray(val) ? val[0] : (typeof val === 'string' ? val : undefined);
      }
      const lowerKey = key.toLowerCase();
      for (const [k, v] of Object.entries(headers)) {
        if (k.toLowerCase() === lowerKey) {
          return Array.isArray(v) ? v[0] : (typeof v === 'string' ? v : undefined);
        }
      }
      return undefined;
    };

    const extractEmailString = (val: any): string | undefined => {
      if (!val) return undefined;
      if (typeof val === 'string') return val.trim() || undefined;
      if (typeof val === 'object') {
        if (val.address) {
          return val.name ? `"${val.name}" <${val.address}>` : String(val.address);
        }
        if (val.email) {
          return val.name ? `"${val.name}" <${val.email}>` : String(val.email);
        }
      }
      return undefined;
    };

    // Prioritize MIME headers (From / Reply-To) because SMTP envelope.from (body.envelope?.from)
    // is rewritten by email forwarders (e.g., Gmail's +caf_= SRS forwarding).
    const headerFrom = extractHeader('from');
    const headerReplyTo = extractHeader('reply-to') || extractHeader('reply_to');
    const bodyFrom = extractEmailString(body.from);
    const envelopeFrom = extractEmailString(body.envelope?.from);

    const isForwardingEnvelope = (addr?: string) =>
      Boolean(addr && (addr.includes('+caf_=') || addr.toLowerCase().startsWith('srs0=') || addr.toLowerCase().startsWith('srs1=')));

    let from = headerFrom || headerReplyTo;
    if (!from) {
      if (bodyFrom && !isForwardingEnvelope(bodyFrom)) {
        from = bodyFrom;
      } else if (envelopeFrom && !isForwardingEnvelope(envelopeFrom)) {
        from = envelopeFrom;
      } else {
        from = bodyFrom || envelopeFrom;
      }
    }

    // For tenant routing, envelope.to or body.to carries the CloudMailin address (+tenantSlug).
    const envelopeTo = extractEmailString(body.envelope?.to);
    const bodyTo = extractEmailString(body.to);
    const headerTo = extractHeader('to');
    const to = envelopeTo || bodyTo || headerTo;

    const subject =
      (typeof body.subject === 'string' && body.subject) ||
      extractHeader('subject') ||
      '';

    let text = (body.text || body.plain || '').trim();
    if (!text && body.html) {
      text = String(body.html)
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<br\s*[\/]?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<\/div>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .trim();
    }

    if (!from || !to) {
      throw AppException.badRequest('Inbound email must specify "from" and "to" addresses.');
    }

    const rawAttachments = body.attachments || body.attachment || [];
    const attachments = Array.isArray(rawAttachments) ? rawAttachments : [rawAttachments];

    return this.tickets.createFromInboundEmail({
      from,
      to,
      subject,
      body: text,
      attachments,
    });
  }

  /** Matrix rows: View Own Tickets / View All Tenant Tickets. */
  @Get()
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Query() query: ListTicketsDto) {
    return this.tickets.list(principal, query);
  }

  @Get(':id')
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  findOne(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: TicketIdParamDto) {
    return this.tickets.findByIdOrThrow(principal, params.id);
  }

  /** The append-only activity trail. Internal events are filtered per caller. */
  @Get(':id/timeline')
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  timeline(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: TicketIdParamDto) {
    return this.tickets.timeline(principal, params.id);
  }

  /**
   * Matrix row: Edit Own Ticket.
   *
   * Gated on either permission because the service enforces the difference:
   * `update:own` is restricted to tickets the caller reported, `update:tenant` is not.
   * Status is not editable here — status moves go through the workflow engine.
   */
  @Patch(':id')
  @RequireAnyPermission('ticket:update:own', 'ticket:update:tenant')
  @Audited({ action: 'ticket.updated', resourceType: 'ticket', idParam: 'id' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.update(principal, params.id, dto);
  }

  // -- Comments and internal notes -----------------------------------------

  @Get(':id/comments')
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  listComments(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Query() query: ListCommentsDto,
  ) {
    return this.tickets.listComments(principal, params.id, query);
  }

  /**
   * Adds a public reply or an internal note.
   *
   * Not gated on `ticket:note:internal` at the route, because a customer must be able
   * to reply publicly on their own ticket. The service checks that permission only
   * when `visibility` is INTERNAL, which is what keeps Guest and Tenant Admin out of
   * internal notes while still letting them comment.
   */
  @Post(':id/comments')
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  @Audited({ action: 'ticket.comment_added', resourceType: 'ticket', idParam: 'id' })
  @HttpCode(HttpStatus.CREATED)
  addComment(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: AddCommentDto,
  ) {
    return this.tickets.addComment(principal, params.id, dto);
  }

  // -- Watchers -------------------------------------------------------------

  @Post(':id/watch')
  @RequirePermission('ticket:watch')
  @HttpCode(HttpStatus.OK)
  watch(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: TicketIdParamDto) {
    return this.tickets.addWatcher(principal, params.id);
  }

  @Delete(':id/watch')
  @RequirePermission('ticket:watch')
  @HttpCode(HttpStatus.OK)
  unwatch(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: TicketIdParamDto) {
    return this.tickets.removeWatcher(principal, params.id);
  }

  // -- Tags and links -------------------------------------------------------

  @Post(':id/tags')
  @RequirePermission('ticket:tag')
  @Audited({ action: 'ticket.tagged', resourceType: 'ticket', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  addTags(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: TagTicketDto,
  ) {
    return this.tickets.addTags(principal, params.id, dto.tags);
  }

  @Delete(':id/tags/:slug')
  @RequirePermission('ticket:tag')
  @Audited({ action: 'ticket.untagged', resourceType: 'ticket', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  removeTag(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Param('slug') slug: string,
  ) {
    return this.tickets.removeTag(principal, params.id, slug);
  }

  @Post(':id/links')
  @RequirePermission('ticket:link')
  @Audited({ action: 'ticket.linked', resourceType: 'ticket', idParam: 'id' })
  @HttpCode(HttpStatus.CREATED)
  link(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: TicketIdParamDto,
    @Body() dto: LinkTicketDto,
  ) {
    return this.tickets.link(principal, params.id, dto.targetId, dto.type);
  }
}

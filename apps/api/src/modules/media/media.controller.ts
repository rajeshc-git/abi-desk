import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import {
  Audited,
  CurrentUser,
  RequireAnyPermission,
  RequirePermission,
} from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { ConfirmUploadDto, RequestUploadDto } from './media.dto';
import { MediaService } from './media.service';

/**
 * Media endpoints.
 *
 * The upload path is three calls rather than one multipart POST, because bytes must not
 * pass through this process: a 25 MB attachment proxied through Node costs memory and a
 * blocked event loop per concurrent upload, and that is the first thing to fall over
 * under load. `POST /media/uploads` reserves and signs, the client PUTs to storage, then
 * `POST /media/:id/confirm` verifies.
 */
@Controller({ path: 'media', version: '1' })
export class MediaController {
  constructor(private readonly media: MediaService) {}

  /**
   * Reserves an asset and returns a presigned PUT.
   *
   * `RequireAnyPermission` over all six capture permissions is the coarse gate; the
   * service then enforces the one that matches the requested `kind`. Two levels because
   * the guard cannot see the request body, and a caller who may upload an attachment
   * should not thereby be able to submit a screen recording.
   */
  @Post('uploads')
  @RequireAnyPermission(
    'capture:screenshot',
    'capture:annotate',
    'capture:screen_recording',
    'capture:voice_recording',
    'capture:attachment',
  )
  @Audited({ action: 'media.upload_requested', resourceType: 'media_asset' })
  requestUpload(@CurrentUser() principal: AuthenticatedPrincipal, @Body() body: RequestUploadDto) {
    return this.media.requestUpload(principal, body);
  }

  /** Verifies the uploaded bytes and promotes the asset out of PENDING_UPLOAD. */
  @Post(':id/confirm')
  @RequireAnyPermission(
    'capture:screenshot',
    'capture:annotate',
    'capture:screen_recording',
    'capture:voice_recording',
    'capture:attachment',
  )
  @Audited({ action: 'media.upload_confirmed', resourceType: 'media_asset', idParam: 'id' })
  confirmUpload(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body: ConfirmUploadDto,
  ) {
    return this.media.confirmUpload(principal, id, body);
  }

  /**
   * Issues a short-lived download URL.
   *
   * A POST, not a GET, despite reading: it mints a credential. Keeping it out of GET
   * keeps signed URLs out of browser history, `Referer` headers and access logs.
   */
  @Post(':id/download')
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  @Audited({ action: 'media.downloaded', resourceType: 'media_asset', idParam: 'id' })
  createDownloadUrl(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param('id') id: string,
    @Body() body?: { disposition?: 'inline' | 'attachment' },
  ) {
    return this.media.createDownloadUrl(principal, id, body?.disposition);
  }

  @Delete(':id')
  @RequirePermission('ticket:read:own')
  @Audited({ action: 'media.deleted', resourceType: 'media_asset', idParam: 'id' })
  remove(@CurrentUser() principal: AuthenticatedPrincipal, @Param('id') id: string) {
    return this.media.remove(principal, id);
  }
}

/**
 * Ticket-scoped media listing.
 *
 * Separate controller so the route reads `/tickets/:ticketId/media`, which is how a
 * client actually thinks about it, without the ticket controller taking a dependency on
 * the media service.
 */
@Controller({ path: 'tickets/:ticketId/media', version: '1' })
export class TicketMediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequireAnyPermission('ticket:read:own', 'ticket:read:tenant')
  list(@CurrentUser() principal: AuthenticatedPrincipal, @Param('ticketId') ticketId: string) {
    return this.media.listForTicket(principal, ticketId);
  }
}

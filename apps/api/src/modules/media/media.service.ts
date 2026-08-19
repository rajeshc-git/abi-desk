import { Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { type Prisma } from '@abi-desk/db';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { StorageService } from '../../infra/storage/storage.service';
import {
  ALLOWED_MIME_TYPES,
  detectType,
  isCompatibleType,
  resolveStoredType,
} from '../../infra/storage/magic-bytes';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { ticketFilterFor } from '../tickets/ticket-scope';
import { PERMISSION_FOR_KIND, type RequestUploadDto, type ConfirmUploadDto } from './media.dto';

/** How long a presigned upload URL stays valid. */
const UPLOAD_URL_TTL_SECONDS = 15 * 60;
/** How long a presigned download URL stays valid. Short: it is re-issued per request. */
const DOWNLOAD_URL_TTL_SECONDS = 5 * 60;
/** Bytes read from the head of an object to identify its real type. */
const SNIFF_BYTES = 64;

type MediaKindValue = keyof typeof PERMISSION_FOR_KIND;

/**
 * Attachment, screenshot and recording lifecycle.
 *
 * The flow is deliberately three-legged - reserve, upload, confirm:
 *
 *   1. `requestUpload` validates limits and writes a `PENDING_UPLOAD` row, returning a
 *      presigned PUT.
 *   2. The client uploads the bytes straight to object storage. The API never sees them,
 *      so memory and bandwidth here are independent of file size and concurrency.
 *   3. `confirmUpload` verifies the object really exists, is the size that was approved,
 *      and contains the type it claims - then promotes the row to `UPLOADED`.
 *
 * A two-step "just presign it" design would be simpler and wrong: nothing would stop a
 * client from declaring a 1 KB PNG, uploading a 400 MB executable, and having the row
 * recorded as a small image. Step 3 is where the client's claims stop being trusted.
 */
@Injectable()
export class MediaService {
  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly storage: StorageService,
  ) {}

  // -------------------------------------------------------------------------
  // Step 1: reserve
  // -------------------------------------------------------------------------

  async requestUpload(principal: AuthenticatedPrincipal, input: RequestUploadDto) {
    const tenantId = this.requireTenant(principal);

    // The capture permission for this specific kind. The matrix grants all six to
    // every role today, but a tenant override could withdraw one.
    const required = PERMISSION_FOR_KIND[input.kind as MediaKindValue];

    if (!principal.permissions.has(required)) {
      throw AppException.permissionDenied(
        `Uploading ${input.kind} requires the ${required} permission.`,
        { kind: input.kind, required },
      );
    }

    // The declared type has to be on the allow-list before anything is reserved.
    // Checking it again after upload is not enough on its own: refusing early avoids
    // handing out a presigned URL for something that can never be accepted.
    if (!ALLOWED_MIME_TYPES.has(input.declaredMimeType)) {
      throw AppException.unprocessable(
        `Content type '${input.declaredMimeType}' is not accepted.`,
        [{ path: 'declaredMimeType', message: 'Unsupported content type.' }],
        ErrorCode.VALIDATION_FAILED,
      );
    }

    const limits = await this.resolveLimits(tenantId, input.ticketId);

    if (input.sizeBytes > limits.maxAttachmentBytes) {
      throw AppException.unprocessable(
        `Attachment exceeds the ${limits.maxAttachmentBytes} byte limit for this tenant.`,
        [{ path: 'sizeBytes', message: `Must not exceed ${limits.maxAttachmentBytes} bytes.` }],
      );
    }

    if (input.ticketId) {
      // Resolves the ticket through the caller's scope, so a customer cannot attach
      // to somebody else's ticket. 404 rather than 403 - see `loadTicketInScope`.
      await this.loadTicketInScope(principal, input.ticketId);

      const existing = await this.prisma.client.mediaAsset.count({
        where: {
          tenantId,
          ticketId: input.ticketId,
          deletedAt: null,
          status: { notIn: ['EXPIRED', 'FAILED'] },
        },
      });

      if (existing >= limits.maxAttachmentsPerTicket) {
        throw AppException.conflict(
          `This ticket already has the maximum of ${limits.maxAttachmentsPerTicket} attachments.`,
          { ticketId: input.ticketId, existing },
        );
      }
    }

    const retention = await this.resolveMediaRetention(tenantId);
    const uploadExpiresAt = new Date(Date.now() + UPLOAD_URL_TTL_SECONDS * 1000);

    const asset = await this.prisma.run(async (tx) => {
      const created = await tx.mediaAsset.create({
        data: {
          tenantId,
          ticketId: input.ticketId ?? null,
          uploadedById: principal.userId,
          kind: input.kind as never,
          status: 'PENDING_UPLOAD',
          // Placeholder: the real key needs the row id, which only exists now.
          storageKey: `pending/${randomUUID()}`,
          bucket: this.storage.bucket,
          originalFilename: input.originalFilename ?? null,
          // Recorded as the declared type for now. `confirmUpload` overwrites this
          // with what the bytes prove, which is the value anything else reads.
          mimeType: input.declaredMimeType,
          declaredMimeType: input.declaredMimeType,
          sizeBytes: BigInt(input.sizeBytes),
          annotations: (input.annotations ?? null) as Prisma.InputJsonValue,
          hasRedactions: input.hasRedactions,
          uploadExpiresAt,
          retainUntil: retention,
        },
        select: { id: true },
      });

      const storageKey = buildStorageKey(tenantId, created.id, input.kind, input.declaredMimeType);

      return tx.mediaAsset.update({
        where: { id: created.id },
        data: { storageKey },
        select: MEDIA_SELECT,
      });
    });

    const upload = await this.storage.presignUpload(asset.storageKey, {
      contentType: input.declaredMimeType,
      contentLength: input.sizeBytes,
      expiresInSeconds: UPLOAD_URL_TTL_SECONDS,
    });

    return {
      media: toMediaResponse(asset),
      upload: {
        url: upload.url,
        method: 'PUT' as const,
        expiresInSeconds: upload.expiresInSeconds,
        // The client must send exactly these, because both are bound into the signature.
        requiredHeaders: {
          'Content-Type': input.declaredMimeType,
          'Content-Length': String(input.sizeBytes),
        },
      },
    };
  }

  // -------------------------------------------------------------------------
  // Step 3: confirm
  // -------------------------------------------------------------------------

  /**
   * Verifies an upload and promotes the row.
   *
   * Three independent checks, each closing a different hole:
   *   - the object exists            (the client may have failed and lied)
   *   - the size matches             (a signed URL approved N bytes; storage is truth)
   *   - the leading bytes match      (a `.png` may hold anything)
   *
   * A mismatch quarantines rather than deletes: `QUARANTINED` keeps the evidence for
   * abuse review while making the asset undownloadable, and deleting on failure would
   * destroy the only record that someone tried.
   */
  async confirmUpload(principal: AuthenticatedPrincipal, mediaId: string, input: ConfirmUploadDto) {
    const tenantId = this.requireTenant(principal);
    const asset = await this.loadOwnAsset(principal, tenantId, mediaId);

    if (asset.status !== 'PENDING_UPLOAD') {
      throw AppException.conflict(
        `This upload is already ${asset.status.toLowerCase()} and cannot be confirmed again.`,
        { mediaId, status: asset.status },
      );
    }

    if (asset.uploadExpiresAt && asset.uploadExpiresAt.getTime() < Date.now()) {
      await this.prisma.client.mediaAsset.update({
        where: { id: mediaId },
        data: { status: 'FAILED' },
      });

      throw AppException.conflict('The upload window for this asset has expired.', { mediaId });
    }

    const head = await this.storage.head(asset.storageKey);

    if (!head) {
      throw AppException.unprocessable(
        'No uploaded object was found for this asset. Upload the bytes before confirming.',
        [{ path: 'id', message: 'Object not present in storage.' }],
      );
    }

    const declaredSize = Number(asset.sizeBytes);

    if (head.sizeBytes !== declaredSize) {
      return this.quarantine(
        mediaId,
        `Stored object is ${head.sizeBytes} bytes but ${declaredSize} were declared.`,
        { mediaId, storedBytes: head.sizeBytes, declaredBytes: declaredSize },
      );
    }

    // Read only the head of the object: enough to identify the format, and bounded so
    // a large upload cannot be turned into a large allocation here.
    const sniff = await this.storage.getObjectRange(asset.storageKey, 0, SNIFF_BYTES - 1);
    const detected = detectType(sniff);

    if (!detected || !ALLOWED_MIME_TYPES.has(detected.mimeType)) {
      return this.quarantine(mediaId, 'The uploaded bytes are not a recognised, accepted format.', {
        mediaId,
        declared: asset.declaredMimeType,
        detected: detected?.mimeType ?? null,
      });
    }

    if (asset.declaredMimeType && !isCompatibleType(detected.mimeType, asset.declaredMimeType)) {
      return this.quarantine(
        mediaId,
        `Content is ${detected.mimeType} but was declared as ${asset.declaredMimeType}.`,
        { mediaId, declared: asset.declaredMimeType, detected: detected.mimeType },
      );
    }

    const storedType = resolveStoredType(detected, asset.declaredMimeType ?? undefined);

    const updated = await this.prisma.client.mediaAsset.update({
      where: { id: mediaId },
      data: {
        status: 'UPLOADED',
        // Overwritten with what the bytes prove, not what was claimed. Everything
        // downstream (download headers, thumbnailing) reads this field.
        mimeType: storedType,
        checksumSha256: input.checksumSha256 ?? null,
        uploadedAt: new Date(),
        uploadExpiresAt: null,
        // Nothing is scanned yet; SKIPPED would claim a check that never ran.
        scanStatus: 'PENDING',
      },
      select: MEDIA_SELECT,
    });

    return toMediaResponse(updated);
  }

  // -------------------------------------------------------------------------
  // Reads
  // -------------------------------------------------------------------------

  /** Media attached to a ticket the caller may see. */
  async listForTicket(principal: AuthenticatedPrincipal, ticketId: string) {
    const tenantId = this.requireTenant(principal);
    await this.loadTicketInScope(principal, ticketId);

    const assets = await this.prisma.client.mediaAsset.findMany({
      where: {
        tenantId,
        ticketId,
        deletedAt: null,
        status: { in: ['UPLOADED', 'PROCESSING', 'READY'] },
      },
      orderBy: { createdAt: 'asc' },
      select: MEDIA_SELECT,
    });

    return assets.map(toMediaResponse);
  }

  /**
   * A short-lived download URL.
   *
   * Re-authorized on every call rather than stored anywhere: ticket scope can change
   * (reassignment, brand move, the ticket being deleted), and a long-lived link would
   * outlive the permission that justified it.
   */
  async createDownloadUrl(
    principal: AuthenticatedPrincipal,
    mediaId: string,
    disposition: 'inline' | 'attachment' = 'attachment',
  ) {
    const tenantId = this.requireTenant(principal);

    const asset = await this.prisma.client.mediaAsset.findFirst({
      where: { id: mediaId, tenantId, deletedAt: null },
      select: { ...MEDIA_SELECT, ticketId: true, uploadedById: true },
    });

    if (!asset) throw AppException.notFound('Media asset', mediaId);

    if (asset.status === 'QUARANTINED') {
      throw AppException.permissionDenied(
        'This asset failed content inspection and cannot be downloaded.',
        { mediaId },
      );
    }

    if (asset.status === 'PENDING_UPLOAD' || asset.status === 'FAILED') {
      throw AppException.conflict('This asset has no downloadable content.', {
        mediaId,
        status: asset.status,
      });
    }

    // Attached to a ticket: the ticket's visibility governs the file's. Unattached: only
    // the uploader may fetch it, which is the widget re-reading its own upload before
    // the ticket exists.
    if (asset.ticketId) {
      await this.loadTicketInScope(principal, asset.ticketId);
    } else if (asset.uploadedById !== principal.userId) {
      throw AppException.notFound('Media asset', mediaId);
    }

    const download = await this.storage.presignDownload(asset.storageKey, {
      expiresInSeconds: DOWNLOAD_URL_TTL_SECONDS,
      downloadFilename: asset.originalFilename ?? undefined,
      contentType: asset.mimeType ?? undefined,
      disposition,
    });

    return {
      url: download.url,
      expiresInSeconds: download.expiresInSeconds,
      mimeType: asset.mimeType,
      sizeBytes: Number(asset.sizeBytes),
    };
  }

  /**
   * Soft-deletes an asset.
   *
   * The row is retained with `deletedAt` set and the object is removed from storage.
   * Keeping the metadata means a ticket's history still shows that a file was attached
   * and removed, which an investigation needs; dropping the bytes is what the deletion
   * request actually asked for.
   */
  async remove(principal: AuthenticatedPrincipal, mediaId: string) {
    const tenantId = this.requireTenant(principal);

    const asset = await this.prisma.client.mediaAsset.findFirst({
      where: { id: mediaId, tenantId, deletedAt: null },
      select: { id: true, storageKey: true, ticketId: true, uploadedById: true },
    });

    if (!asset) throw AppException.notFound('Media asset', mediaId);

    const isUploader = asset.uploadedById === principal.userId;
    const mayModerate = principal.permissions.has('ticket:update');

    if (!isUploader && !mayModerate) {
      throw AppException.permissionDenied(
        'Only the uploader or an agent who can update tickets may remove an attachment.',
        { mediaId },
      );
    }

    if (asset.ticketId) await this.loadTicketInScope(principal, asset.ticketId);

    await this.prisma.client.mediaAsset.update({
      where: { id: mediaId },
      data: { status: 'EXPIRED', deletedAt: new Date() },
    });

    // After the row is marked, so a storage failure cannot leave a live row pointing
    // at deleted bytes. The reverse order would produce exactly that.
    await this.storage.delete(asset.storageKey).catch(() => undefined);

    return { id: mediaId, deleted: true };
  }

  /** Links previously uploaded, unattached assets to a ticket. Used by ticket create. */
  async attachToTicket(
    tx: Prisma.TransactionClient,
    tenantId: string,
    ticketId: string,
    mediaIds: readonly string[],
    uploaderId: string,
  ): Promise<number> {
    if (mediaIds.length === 0) return 0;

    // Only the uploader's own unattached assets: without the `uploadedById` and
    // `ticketId: null` conditions, a caller could pass someone else's media id and
    // graft their screenshot onto a new ticket.
    const result = await tx.mediaAsset.updateMany({
      where: {
        id: { in: [...mediaIds] },
        tenantId,
        ticketId: null,
        uploadedById: uploaderId,
        deletedAt: null,
      },
      data: { ticketId },
    });

    return result.count;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private requireTenant(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantId) {
      throw AppException.permissionDenied('Media operations require a tenant-scoped caller.', {
        userId: principal.userId,
      });
    }

    return principal.tenantId;
  }

  private async quarantine(
    mediaId: string,
    detail: string,
    logContext: Record<string, unknown>,
  ): Promise<never> {
    await this.prisma.client.mediaAsset.update({
      where: { id: mediaId },
      data: { status: 'QUARANTINED', scanStatus: 'INFECTED' },
    });

    throw AppException.unprocessable(detail, [{ path: 'id', message: detail }]);
  }

  private async loadOwnAsset(principal: AuthenticatedPrincipal, tenantId: string, mediaId: string) {
    const asset = await this.prisma.client.mediaAsset.findFirst({
      where: { id: mediaId, tenantId, uploadedById: principal.userId, deletedAt: null },
      select: {
        id: true,
        status: true,
        storageKey: true,
        sizeBytes: true,
        declaredMimeType: true,
        uploadExpiresAt: true,
      },
    });

    if (!asset) throw AppException.notFound('Media asset', mediaId);
    return asset;
  }

  /**
   * Resolves a ticket through the caller's row scope.
   *
   * 404 for an out-of-scope ticket, never 403: a 403 confirms the ticket exists, which
   * lets a customer enumerate ids to learn how many tickets a tenant has.
   */
  private async loadTicketInScope(principal: AuthenticatedPrincipal, ticketId: string) {
    const scope = ticketFilterFor(principal);
    if (!scope) throw AppException.notFound('Ticket', ticketId);

    const ticket = await this.prisma.client.ticket.findFirst({
      where: { AND: [{ id: ticketId, deletedAt: null }, scope] },
      select: { id: true, tenantId: true, brandId: true },
    });

    if (!ticket) throw AppException.notFound('Ticket', ticketId);
    return ticket;
  }

  /**
   * Upload limits, preferring the brand's widget config over the tenant default.
   *
   * Widget config is per brand because a tenant running two products may allow large
   * video from one and not the other.
   */
  private async resolveLimits(tenantId: string, ticketId: string | undefined) {
    const fallback = { maxAttachmentBytes: 26_214_400, maxAttachmentsPerTicket: 10 };

    let brandId: string | null = null;

    if (ticketId) {
      const ticket = await this.prisma.client.ticket.findFirst({
        where: { id: ticketId, tenantId },
        select: { brandId: true },
      });
      brandId = ticket?.brandId ?? null;
    }

    const config = brandId
      ? await this.prisma.client.widgetConfig.findFirst({
          where: { tenantId, brandId },
          select: { maxAttachmentBytes: true, maxAttachmentsPerTicket: true },
        })
      : await this.prisma.client.widgetConfig.findFirst({
          where: { tenantId },
          select: { maxAttachmentBytes: true, maxAttachmentsPerTicket: true },
        });

    return config ?? fallback;
  }

  private async resolveMediaRetention(tenantId: string): Promise<Date | null> {
    const settings = await this.prisma.client.tenantSetting.findFirst({
      where: { tenantId },
      select: { mediaRetentionDays: true },
    });

    const days = settings?.mediaRetentionDays;
    if (!days || days <= 0) return null;

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

/** Fields returned to clients. `storageKey` is included for internal use, never serialized. */
const MEDIA_SELECT = {
  id: true,
  kind: true,
  status: true,
  storageKey: true,
  bucket: true,
  originalFilename: true,
  mimeType: true,
  declaredMimeType: true,
  sizeBytes: true,
  checksumSha256: true,
  width: true,
  height: true,
  durationMs: true,
  hasRedactions: true,
  scanStatus: true,
  uploadExpiresAt: true,
  uploadedAt: true,
  createdAt: true,
} as const;

type MediaRow = {
  id: string;
  kind: string;
  status: string;
  storageKey: string;
  originalFilename: string | null;
  mimeType: string;
  declaredMimeType: string | null;
  sizeBytes: bigint;
  checksumSha256: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  hasRedactions: boolean;
  scanStatus: string;
  uploadExpiresAt: Date | null;
  uploadedAt: Date | null;
  createdAt: Date;
};

/**
 * Shapes a row for the wire.
 *
 * `storageKey` is dropped deliberately: exposing it would invite clients to construct
 * their own URLs and would leak the tenant-partitioned key layout. `sizeBytes` is
 * narrowed from BigInt because JSON has no BigInt, and file sizes are far inside the
 * safe integer range.
 */
function toMediaResponse(row: MediaRow) {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    filename: row.originalFilename,
    mimeType: row.mimeType,
    // Surfaced only when it disagrees with reality - a mismatch is an abuse signal
    // worth showing an agent, and noise otherwise.
    declaredMimeType:
      row.declaredMimeType && row.declaredMimeType !== row.mimeType ? row.declaredMimeType : null,
    sizeBytes: Number(row.sizeBytes),
    checksumSha256: row.checksumSha256,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    hasRedactions: row.hasRedactions,
    scanStatus: row.scanStatus,
    uploadExpiresAt: row.uploadExpiresAt,
    uploadedAt: row.uploadedAt,
    createdAt: row.createdAt,
  };
}

/**
 * Object key layout: `tenants/<tenantId>/<kind>/<yyyy>/<mm>/<mediaId>.<ext>`
 *
 * Tenant-first so a bucket lifecycle rule or a tenant deletion can be expressed as a
 * prefix operation, and so an object listing makes cross-tenant mistakes obvious. The
 * media id rather than the original filename avoids collisions and path traversal -
 * user-supplied names never become path components.
 */
function buildStorageKey(
  tenantId: string,
  mediaId: string,
  kind: string,
  mimeType: string,
): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const extension = extensionFor(mimeType);

  return `tenants/${tenantId}/${kind.toLowerCase()}/${year}/${month}/${mediaId}.${extension}`;
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
    'video/webm': 'webm',
    'audio/webm': 'weba',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/mpeg': 'mp3',
    'video/mp4': 'mp4',
    'text/plain': 'txt',
    'text/csv': 'csv',
    'application/json': 'json',
  };

  return map[mimeType] ?? 'bin';
}

/** Exported for the diagnostics service, which sizes payloads the same way. */
export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex');
}

import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';

/**
 * Media request contracts.
 *
 * `kind` mirrors `MediaKind` in the Prisma schema but is declared literally rather
 * than imported, for the same reason as the ticket DTOs: this is the API's accepted
 * contract, and coupling it to the database enum would let a schema change silently
 * alter what clients may send.
 */
export const mediaKindValues = [
  'SCREENSHOT',
  'SCREEN_CAPTURE',
  'ANNOTATED_SCREENSHOT',
  'SCREEN_RECORDING',
  'VOICE_RECORDING',
  'ATTACHMENT',
  'CHAT_ATTACHMENT',
] as const;

const uuid = z.string().uuid();

/**
 * The permission each capture kind requires. Enforced in the service, not just
 * described here - the RBAC matrix grants every capture permission to every role
 * today, but the mapping exists so a future tenant override tightening one capability
 * (say, disabling voice recording for Guests) has somewhere to attach.
 */
export const PERMISSION_FOR_KIND = {
  SCREENSHOT: 'capture:screenshot',
  SCREEN_CAPTURE: 'capture:screen_recording',
  ANNOTATED_SCREENSHOT: 'capture:annotate',
  SCREEN_RECORDING: 'capture:screen_recording',
  VOICE_RECORDING: 'capture:voice_recording',
  ATTACHMENT: 'capture:attachment',
  CHAT_ATTACHMENT: 'capture:attachment',
} as const satisfies Record<(typeof mediaKindValues)[number], string>;

export const requestUploadSchema = z.object({
  kind: z.enum(mediaKindValues),
  /**
   * The ticket this media will attach to. Optional because the widget uploads while
   * the user is still composing the ticket - the asset is linked afterwards via
   * `ticketId` on create, or `commentId`/`chatMessageId` on the comment/message call.
   */
  ticketId: uuid.optional(),
  originalFilename: z.string().trim().min(1).max(255).optional(),
  /** What the client believes the type is. Compared against the detected type once uploaded. */
  declaredMimeType: z.string().trim().min(1).max(160),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(500 * 1024 * 1024), // hard ceiling; the effective cap is WidgetConfig.maxAttachmentBytes
  annotations: z.unknown().optional(),
  hasRedactions: z.boolean().default(false),
});

export class RequestUploadDto extends createZodDto(requestUploadSchema) {}

export const confirmUploadSchema = z.object({
  /** Client-computed SHA-256, cross-checked against what the worker computes from the stored object. */
  checksumSha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i)
    .optional(),
});

export class ConfirmUploadDto extends createZodDto(confirmUploadSchema) {}

export const mediaIdParamSchema = z.object({ id: uuid });
export class MediaIdParamDto extends createZodDto(mediaIdParamSchema) {}

export const attachMediaSchema = z.object({
  mediaId: uuid,
});

export class AttachMediaDto extends createZodDto(attachMediaSchema) {}

export const submitDiagnosticsSchema = z.object({
  capturedAt: z.coerce.date(),
  pageUrl: z.string().trim().min(1).max(2048),
  pageTitle: z.string().trim().max(500).optional(),
  referrerUrl: z.string().trim().max(2048).optional(),
  hostSessionId: z.string().trim().max(200).optional(),
  hostUserId: z.string().trim().max(200).optional(),
  hostAccountId: z.string().trim().max(200).optional(),

  userAgent: z.string().trim().min(1),
  browserName: z.string().trim().max(80).optional(),
  browserVersion: z.string().trim().max(40).optional(),
  engineName: z.string().trim().max(80).optional(),
  osName: z.string().trim().max(80).optional(),
  osVersion: z.string().trim().max(40).optional(),
  deviceType: z.string().trim().max(40).optional(),
  deviceModel: z.string().trim().max(120).optional(),

  viewportWidth: z.number().int().nonnegative().optional(),
  viewportHeight: z.number().int().nonnegative().optional(),
  screenWidth: z.number().int().nonnegative().optional(),
  screenHeight: z.number().int().nonnegative().optional(),
  devicePixelRatio: z.number().positive().optional(),
  colorScheme: z.string().trim().max(20).optional(),

  timezone: z.string().trim().max(64).optional(),
  locale: z.string().trim().max(16).optional(),

  connectionType: z.string().trim().max(20).optional(),
  deviceMemoryGb: z.number().nonnegative().optional(),
  hardwareConcurrency: z.number().int().nonnegative().optional(),

  consoleEntries: z.array(z.record(z.unknown())).default([]),
  networkEntries: z.array(z.record(z.unknown())).default([]),
  jsErrors: z.array(z.record(z.unknown())).default([]),
  performanceMetrics: z.record(z.unknown()).default({}),

  featureFlags: z.record(z.unknown()).optional(),
  customContext: z.record(z.unknown()).optional(),
});

export class SubmitDiagnosticsDto extends createZodDto(submitDiagnosticsSchema) {}

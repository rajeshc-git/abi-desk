import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';

/**
 * Ticket request contracts.
 *
 * Enum members are listed literally rather than imported from the generated Prisma
 * client because these are the *API's* accepted values. Coupling them to the database
 * enum would mean a schema change silently altering the public contract.
 */

export const ticketStatusValues = [
  'NEW',
  'TRIAGE',
  'OPEN',
  'PENDING_CUSTOMER',
  'ON_HOLD',
  'ESCALATED_L2',
  'ESCALATED_L3',
  'IN_DEVELOPMENT',
  'IN_QA',
  'PENDING_RELEASE',
  'RELEASED',
  'PENDING_VERIFICATION',
  'AWAITING_CUSTOMER_CONFIRMATION',
  'RESOLVED',
  'CLOSED',
  'REOPENED',
  'CANCELLED',
] as const;

export const ticketPriorityValues = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'] as const;
export const ticketTypeValues = ['QUESTION', 'INCIDENT', 'BUG', 'FEATURE_REQUEST', 'TASK'] as const;
export const ticketChannelValues = ['WIDGET', 'PORTAL', 'EMAIL', 'API', 'CHAT', 'PHONE'] as const;
export const supportTierValues = ['L1', 'L2', 'L3', 'DEV', 'QA'] as const;
export const commentVisibilityValues = ['PUBLIC', 'INTERNAL'] as const;

const uuid = z.string().uuid();

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'must be at least 3 characters').max(300),
  description: z.string().trim().min(1, 'is required').max(50_000),
  brandId: uuid.optional(),
  priority: z.enum(ticketPriorityValues).default('NORMAL'),
  type: z.enum(ticketTypeValues).default('INCIDENT'),
  channel: z.enum(ticketChannelValues).default('API'),
  category: z.string().trim().max(120).optional(),
  subcategory: z.string().trim().max(120).optional(),
  tags: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
  /**
   * Raise on behalf of another user. Staff-only; the service refuses it unless the
   * caller holds tenant-wide ticket rights, otherwise anyone could attribute a
   * ticket to someone else.
   */
  requesterId: uuid.optional(),
  customFields: z.record(z.unknown()).optional(),
  /** Media uploaded while the widget form is being composed. */
  attachmentIds: z.array(uuid).max(20).optional(),
});

export class CreateTicketDto extends createZodDto(createTicketSchema) {}

export const updateTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(300).optional(),
    description: z.string().trim().min(1).max(50_000).optional(),
    priority: z.enum(ticketPriorityValues).optional(),
    type: z.enum(ticketTypeValues).optional(),
    category: z.string().trim().max(120).nullable().optional(),
    subcategory: z.string().trim().max(120).nullable().optional(),
    customFields: z.record(z.unknown()).optional(),
  })
  // An empty PATCH is almost always a client bug; failing loudly beats a silent no-op
  // that looks like success.
  .refine((value) => Object.keys(value).length > 0, {
    message: 'at least one field must be provided',
  });

export class UpdateTicketDto extends createZodDto(updateTicketSchema) {}

/** Comma-separated query values, e.g. `?status=OPEN,TRIAGE`. */
const csvEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .string()
    .optional()
    .transform((raw, ctx) => {
      if (!raw) return undefined;

      const parts = raw
        .split(',')
        .map((part) => part.trim().toUpperCase())
        .filter(Boolean);

      const invalid = parts.filter((part) => !(values as readonly string[]).includes(part));

      if (invalid.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `unknown value(s): ${invalid.join(', ')}`,
        });
        return z.NEVER;
      }

      return parts as unknown as T[number][];
    });

export const listTicketsSchema = z.object({
  status: csvEnum(ticketStatusValues),
  priority: csvEnum(ticketPriorityValues),
  tier: csvEnum(supportTierValues),
  type: csvEnum(ticketTypeValues),
  channel: csvEnum(ticketChannelValues),

  assigneeId: uuid.optional(),
  /** `me` resolves to the caller, which is what an agent's default view needs. */
  assignee: z.literal('me').optional(),
  requesterId: uuid.optional(),
  queueId: uuid.optional(),
  teamId: uuid.optional(),
  brandId: uuid.optional(),
  tag: z.string().trim().max(60).optional(),
  category: z.string().trim().max(120).optional(),

  /** Excludes closed and cancelled, which is what "my open work" means. */
  openOnly: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  unassigned: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  breached: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),

  /** Full-text query, matched against the maintained tsvector. */
  q: z.string().trim().min(2).max(200).optional(),

  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),

  sort: z
    .enum(['createdAt', 'updatedAt', 'lastActivityAt', 'priority', 'number', 'relevance'])
    .default('lastActivityAt'),
  order: z.enum(['asc', 'desc']).default('desc'),

  page: z.coerce.number().int().min(1).default(1),
  // Capped: an uncapped page size is a trivial way to exhaust memory on a large
  // backlog.
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export class ListTicketsDto extends createZodDto(listTicketsSchema) {}

export const ticketIdParamSchema = z.object({ id: uuid });
export class TicketIdParamDto extends createZodDto(ticketIdParamSchema) {}

export const addCommentSchema = z.object({
  body: z.string().trim().min(1, 'is required').max(50_000),
  /**
   * INTERNAL requires `ticket:note:internal`. The requirements grant that to L1-Dev
   * and explicitly withhold it from Guest and Tenant Admin.
   */
  visibility: z.enum(commentVisibilityValues).default('PUBLIC'),
  bodyFormat: z.enum(['MARKDOWN', 'HTML', 'PLAIN']).default('MARKDOWN'),
  attachments: z.array(z.string().uuid()).optional(),
});

export class AddCommentDto extends createZodDto(addCommentSchema) {}

export const listCommentsSchema = z.object({
  visibility: z.enum(commentVisibilityValues).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export class ListCommentsDto extends createZodDto(listCommentsSchema) {}

export const tagTicketSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
});

export class TagTicketDto extends createZodDto(tagTicketSchema) {}

export const linkTicketSchema = z.object({
  targetId: uuid,
  type: z.enum(['RELATED', 'DUPLICATE_OF', 'BLOCKS', 'BLOCKED_BY', 'CAUSED_BY', 'MERGED_INTO']),
});

export class LinkTicketDto extends createZodDto(linkTicketSchema) {}

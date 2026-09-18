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
export const supportTierValues = ['L1', 'L2', 'L3', 'DEV', 'DEVOPS', 'QA'] as const;
export const commentVisibilityValues = ['PUBLIC', 'INTERNAL'] as const;

const uuid = z.string().uuid();

export const createTicketSchema = z.object({
  subject: z.string().trim().min(3, 'must be at least 3 characters').max(300),
  description: z.string().trim().min(1, 'is required').max(50_000),
  brandId: uuid.optional(),
  priority: z.enum(ticketPriorityValues).default('NORMAL'),
  type: z.enum(ticketTypeValues).default('INCIDENT'),
  channel: z.enum(ticketChannelValues).default('API'),
  category: z.string().trim().max(120).nullable().optional(),
  subcategory: z.string().trim().max(120).nullable().optional(),
  organization: z.string().trim().max(160).nullable().optional(),
  product: z.string().trim().max(120).nullable().optional(),
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
    organization: z.string().trim().max(160).nullable().optional(),
    product: z.string().trim().max(120).nullable().optional(),
    rootCause: z.string().trim().max(50_000).nullable().optional(),
    capaNotes: z.string().trim().max(50_000).nullable().optional(),
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
  organization: z.string().trim().max(160).optional(),
  product: z.string().trim().max(120).optional(),

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
  /** Optional CC email recipients for outbound email notification. */
  cc: z.array(z.string().email()).optional(),
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

export const mergeTicketsSchema = z.object({
  primaryTicketId: uuid,
  secondaryTicketIds: z.array(uuid).min(1, 'At least one secondary ticket is required for merging'),
  note: z.string().trim().max(2000).optional(),
});

export class MergeTicketsDto extends createZodDto(mergeTicketsSchema) {}

export const unmergeTicketSchema = z.object({
  secondaryTicketId: uuid,
  note: z.string().trim().max(2000).optional(),
});

export class UnmergeTicketDto extends createZodDto(unmergeTicketSchema) {}

export const splitTicketSchema = z.object({
  commentId: uuid,
  subject: z.string().trim().min(3, 'Subject must be at least 3 characters').max(300),
  description: z.string().trim().optional(),
  priority: z.enum(ticketPriorityValues).optional(),
  type: z.enum(ticketTypeValues).optional(),
  category: z.string().trim().max(120).nullable().optional(),
  subcategory: z.string().trim().max(120).nullable().optional(),
  tier: z.enum(supportTierValues).optional(),
  organization: z.string().trim().optional(),
  product: z.string().trim().optional(),
  teamId: uuid.nullable().optional(),
  assigneeId: uuid.nullable().optional(),
});

export class SplitTicketDto extends createZodDto(splitTicketSchema) {}

export const createTagSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(60),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{3,8})$/, 'Invalid hex color').optional(),
  domains: z.string().trim().max(500).optional(),
  organization: z.string().trim().max(120).nullable().optional(),
  product: z.string().trim().max(120).nullable().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().trim().min(1).max(60).optional(),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{3,8})$/, 'Invalid hex color').optional(),
  domains: z.string().trim().max(500).nullable().optional(),
  organization: z.string().trim().max(120).nullable().optional(),
  product: z.string().trim().max(120).nullable().optional(),
});

export class CreateTagDto extends createZodDto(createTagSchema) {}
export class UpdateTagDto extends createZodDto(updateTagSchema) {}

export const normalizeCategoryKeywords = (raw?: string | null): string | null | undefined => {
  if (raw === undefined) return undefined;
  if (raw === null || raw.trim() === '') return null;
  const tokens = raw
    .split(/[,;\n]+/)
    .map((k) => k.trim().toLowerCase())
    .filter((k) => k.length >= 2);
  const unique = Array.from(new Set(tokens)).slice(0, 10);
  return unique.length > 0 ? unique.join(', ') : null;
};

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Category name is required').max(120),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{3,8})$/, 'Invalid hex color').optional(),
  keywords: z.string().trim().max(1000).optional().transform(normalizeCategoryKeywords),
});

export const updateCategorySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  color: z.string().trim().regex(/^#([0-9a-fA-F]{3,8})$/, 'Invalid hex color').optional(),
  keywords: z.string().trim().max(1000).nullable().optional().transform(normalizeCategoryKeywords),
});

export class CreateCategoryDto extends createZodDto(createCategorySchema) {}
export class UpdateCategoryDto extends createZodDto(updateCategorySchema) {}

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1, 'Organization name is required').max(120),
  domains: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.string().trim().max(255).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  domains: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  website: z.string().trim().max(255).nullable().optional(),
  contactName: z.string().trim().max(120).nullable().optional(),
  contactEmail: z.string().trim().max(255).nullable().optional(),
  contactPhone: z.string().trim().max(50).nullable().optional(),
});

export class CreateOrganizationDto extends createZodDto(createOrganizationSchema) {}
export class UpdateOrganizationDto extends createZodDto(updateOrganizationSchema) {}




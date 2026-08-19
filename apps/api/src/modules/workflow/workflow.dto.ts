import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';
import { ticketStatusValues, supportTierValues } from '../tickets/ticket.dto';

const uuid = z.string().uuid();

export const transitionSchema = z.object({
  toStatus: z.enum(ticketStatusValues),
  /**
   * Required by transitions whose `requiresComment` flag is set - escalations and
   * cancellations, where "why" is the whole value of the record.
   */
  comment: z.string().trim().min(1).max(10_000).optional(),
  /** Optional reassignment applied atomically with the move. */
  assigneeId: uuid.nullable().optional(),
  queueId: uuid.nullable().optional(),
});

export class TransitionDto extends createZodDto(transitionSchema) {}

export const escalateSchema = z.object({
  /** Defaults to the next tier in the ladder when omitted. */
  toTier: z.enum(supportTierValues).optional(),
  reason: z.string().trim().min(1, 'is required').max(10_000),
});

export class EscalateDto extends createZodDto(escalateSchema) {}

export const assignSchema = z
  .object({
    /** Null unassigns. */
    assigneeId: uuid.nullable().optional(),
    queueId: uuid.nullable().optional(),
    teamId: uuid.nullable().optional(),
    /**
     * Let the router choose within the queue or team.
     *
     * This is how a Tenant Admin assigns: the matrix gives them "Queue", so they may
     * hand work to a queue and let it route, but may not name an agent.
     */
    autoAssign: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.assigneeId !== undefined ||
      value.queueId !== undefined ||
      value.teamId !== undefined ||
      value.autoAssign === true,
    { message: 'provide an assignee, a queue, a team, or autoAssign' },
  );

export class AssignDto extends createZodDto(assignSchema) {}

export const confirmResolutionSchema = z.object({
  /** False means "not fixed", which reopens the ticket. */
  confirmed: z.boolean(),
  comment: z.string().trim().max(10_000).optional(),
});

export class ConfirmResolutionDto extends createZodDto(confirmResolutionSchema) {}

export const bulkUpdateSchema = z
  .object({
    // Capped so one request cannot lock a large slice of the table in a single
    // transaction, and so a mistake is recoverable.
    ticketIds: z.array(uuid).min(1).max(100),
    toStatus: z.enum(ticketStatusValues).optional(),
    status: z.enum(ticketStatusValues).optional(),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
    assigneeId: uuid.nullable().optional(),
    queueId: uuid.nullable().optional(),
    addTags: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    comment: z.string().trim().max(10_000).optional(),
  })
  .refine(
    (value) =>
      value.toStatus !== undefined ||
      value.status !== undefined ||
      value.priority !== undefined ||
      value.assigneeId !== undefined ||
      value.queueId !== undefined ||
      (value.addTags?.length ?? 0) > 0 ||
      value.comment !== undefined,
    { message: 'provide at least one change to apply' },
  );

export class BulkUpdateDto extends createZodDto(bulkUpdateSchema) {}

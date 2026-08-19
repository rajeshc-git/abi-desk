import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';

const uuid = z.string().uuid();

export const decideApprovalSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  /** Required on rejection: "no" without a reason is not actionable. */
  comment: z.string().trim().max(10_000).optional(),
});

export class DecideApprovalDto extends createZodDto(decideApprovalSchema) {}

export const listApprovalsSchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']).optional(),
  /** Only requests this caller can actually decide. The inbox default. */
  mine: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value !== 'false'),
  ticketId: uuid.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export class ListApprovalsDto extends createZodDto(listApprovalsSchema) {}

export const approvalIdParamSchema = z.object({ id: uuid });
export class ApprovalIdParamDto extends createZodDto(approvalIdParamSchema) {}

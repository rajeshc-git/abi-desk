import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';

export const updateScheduledReportSchema = z.object({
  enabled: z.boolean().default(true),
  emails: z.array(z.string().email()).default([]),
  frequency: z.enum(['daily', 'month_end']).optional(),
  subject: z.string().trim().min(1).max(255).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Must be HH:mm format').default('23:58'),
  timezone: z.string().trim().max(64).optional(),
});

export class UpdateScheduledReportDto extends createZodDto(updateScheduledReportSchema) {}

export const sendNowReportSchema = z.object({
  emails: z.array(z.string().email()).min(1, 'At least one recipient email is required'),
  subject: z.string().trim().min(1).max(255).optional(),
  body: z.string().trim().min(1).max(10000).optional(),
});

export class SendNowReportDto extends createZodDto(sendNowReportSchema) {}

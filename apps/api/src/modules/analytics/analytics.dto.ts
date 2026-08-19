import { z } from 'zod';

export const AnalyticsFilterSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  brandId: z.string().uuid().optional(),
  tier: z.enum(['L1', 'L2', 'L3', 'DEV', 'QA']).optional(),
  channel: z.enum(['WIDGET', 'PORTAL', 'EMAIL', 'API', 'CHAT', 'PHONE']).optional(),
  timeRange: z.enum(['24h', '7d', '14d', '30d', '90d', 'custom']).optional(),
  days: z.coerce.number().int().min(1).max(365).optional(),
});

export type AnalyticsFilterDto = z.infer<typeof AnalyticsFilterSchema>;

export const ExportReportSchema = AnalyticsFilterSchema.extend({
  format: z.enum(['json', 'csv']).default('json'),
});

export type ExportReportDto = z.infer<typeof ExportReportSchema>;

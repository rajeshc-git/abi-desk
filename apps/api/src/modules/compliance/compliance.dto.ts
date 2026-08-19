import { z } from 'zod';

export const DataSubjectRequestTypeEnum = z.enum(['EXPORT', 'ERASURE']);
export type DataSubjectRequestType = z.infer<typeof DataSubjectRequestTypeEnum>;

export const CreateDataSubjectRequestSchema = z.object({
  subjectUserId: z.string().uuid(),
  type: DataSubjectRequestTypeEnum,
  reason: z.string().max(1000).optional(),
});
export type CreateDataSubjectRequestDto = z.infer<typeof CreateDataSubjectRequestSchema>;

export const DataSubjectRequestIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type DataSubjectRequestIdParamDto = z.infer<typeof DataSubjectRequestIdParamSchema>;

export const RetentionScopeEnum = z.enum([
  'TICKET',
  'MEDIA',
  'DIAGNOSTIC',
  'AUDIT',
  'CHAT',
  'WEBHOOK_DELIVERY',
]);
export type RetentionScope = z.infer<typeof RetentionScopeEnum>;

export const CreateRetentionPolicySchema = z.object({
  scope: RetentionScopeEnum,
  retentionDays: z.number().int().min(1).max(3650),
  anonymizeInsteadOfDelete: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateRetentionPolicyDto = z.infer<typeof CreateRetentionPolicySchema>;

export const UpdateRetentionPolicySchema = CreateRetentionPolicySchema.partial();
export type UpdateRetentionPolicyDto = z.infer<typeof UpdateRetentionPolicySchema>;

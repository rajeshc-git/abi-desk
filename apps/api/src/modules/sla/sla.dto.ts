import { z } from 'zod';

export const BusinessHoursDayInputSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(0).max(1440),
});
export type BusinessHoursDayInput = z.infer<typeof BusinessHoursDayInputSchema>;

export const CreateBusinessHoursSchema = z.object({
  name: z.string().min(1).max(120),
  timezone: z.string().min(1).max(64).default('UTC'),
  isAlwaysOpen: z.boolean().default(false),
  isDefault: z.boolean().default(false),
  brandId: z.string().uuid().optional(),
  days: z.array(BusinessHoursDayInputSchema).default([]),
});
export type CreateBusinessHoursDto = z.infer<typeof CreateBusinessHoursSchema>;

export const UpdateBusinessHoursSchema = CreateBusinessHoursSchema.partial();
export type UpdateBusinessHoursDto = z.infer<typeof UpdateBusinessHoursSchema>;

export const CreateHolidaySchema = z.object({
  name: z.string().min(1).max(120),
  date: z.string().min(1), // ISO date YYYY-MM-DD
  recursAnnually: z.boolean().default(false),
  businessHoursId: z.string().uuid().optional(),
});
export type CreateHolidayDto = z.infer<typeof CreateHolidaySchema>;

export const SlaTargetInputSchema = z.object({
  type: z.enum(['FIRST_RESPONSE', 'NEXT_RESPONSE', 'RESOLUTION']),
  minutes: z.number().int().min(1),
  priorityOverrides: z.record(z.number().int().min(1)).default({}),
});
export type SlaTargetInput = z.infer<typeof SlaTargetInputSchema>;

export const RoleKeyEnum = z.enum([
  'GUEST_CUSTOMER',
  'TENANT_ADMIN',
  'L1_SUPPORT',
  'L2_SUPPORT',
  'L3_SUPPORT',
  'DEV_TEAM',
  'QA_TEAM',
  'PLATFORM_ADMIN',
]);

export const CreateSlaPolicySchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  brandId: z.string().uuid().optional(),
  conditions: z.record(z.unknown()).default({}),
  priority: z.number().int().min(0).default(0),
  businessHoursId: z.string().uuid().optional(),
  warningThreshold: z.number().min(0.1).max(0.99).default(0.75),
  escalateOnBreach: z.boolean().default(true),
  notifyRoleKeys: z.array(RoleKeyEnum).default([]),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  targets: z.array(SlaTargetInputSchema).min(1),
});
export type CreateSlaPolicyDto = z.infer<typeof CreateSlaPolicySchema>;

export const UpdateSlaPolicySchema = CreateSlaPolicySchema.partial();
export type UpdateSlaPolicyDto = z.infer<typeof UpdateSlaPolicySchema>;

export const SlaPolicyIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type SlaPolicyIdParamDto = z.infer<typeof SlaPolicyIdParamSchema>;

export const BusinessHoursIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type BusinessHoursIdParamDto = z.infer<typeof BusinessHoursIdParamSchema>;

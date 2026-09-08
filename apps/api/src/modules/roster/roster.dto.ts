import { z } from 'zod';

// ---------------------------------------------------------------------------
// Roster Team Config DTOs
// ---------------------------------------------------------------------------

export const LeaveEntrySchema = z.object({
  id: z.string(),
  memberId: z.string(),
  from: z.string(),
  to: z.string(),
  reason: z.string().default(''),
});

export const CompOffEntrySchema = z.object({
  id: z.string(),
  memberId: z.string(),
  worked: z.string(),
  co: z.string(),
});

export const WeekendDutyEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  morningId: z.string().default(''),
  eveningId: z.string().default(''),
});

export const WeekdayOverrideEntrySchema = z.object({
  id: z.string(),
  memberId: z.string(),
  from: z.string(),
  to: z.string(),
  shift: z.string(),
  reason: z.string().default(''),
});

export const SaveTeamRosterConfigSchema = z.object({
  morningPerDay: z.number().int().min(0).max(100).default(2),
  eveningPerDay: z.number().int().min(0).max(100).default(2),
  step: z.number().int().min(0).max(100).default(4),
  anchorDate: z.string(), // ISO date string YYYY-MM-DD
  offDay: z.number().int().min(0).max(6).default(0), // 0=Sunday
  skeleton: z.number().int().min(0).max(10).default(1),
  maxDuty: z.number().int().min(0).max(100).default(2),
  rotationOrder: z.array(z.string()).default([]),
  leaves: z.array(LeaveEntrySchema).default([]),
  comps: z.array(CompOffEntrySchema).default([]),
  weekendDuties: z.array(WeekendDutyEntrySchema).default([]),
  weekdayOverrides: z.array(WeekdayOverrideEntrySchema).default([]),
});
export type SaveTeamRosterConfigDto = z.infer<typeof SaveTeamRosterConfigSchema>;

// ---------------------------------------------------------------------------
// Shift Roster Schedules DTOs
// ---------------------------------------------------------------------------

export const ShiftRosterStatusEnum = z.enum(['DRAFT', 'PUBLISHED', 'AMENDED']);

export const CreateOrUpdateRosterSchema = z.object({
  title: z.string().min(1).max(120),
  startDate: z.string(), // ISO YYYY-MM-DD
  endDate: z.string(), // ISO YYYY-MM-DD
  status: ShiftRosterStatusEnum.default('DRAFT'),
  revision: z.number().int().min(1).default(1),
  configSnap: z.record(z.unknown()),
  gridData: z.record(z.unknown()),
  manualEdits: z.record(z.unknown()).default({}),
  changelog: z.array(z.record(z.unknown())).default([]),
});
export type CreateOrUpdateRosterDto = z.infer<typeof CreateOrUpdateRosterSchema>;

export const UpdateManualEditsSchema = z.object({
  manualEdits: z.record(z.unknown()),
  gridData: z.record(z.unknown()).optional(),
  note: z.string().max(500).optional(),
});
export type UpdateManualEditsDto = z.infer<typeof UpdateManualEditsSchema>;

export const TeamIdParamSchema = z.object({
  teamId: z.string().uuid(),
});
export type TeamIdParamDto = z.infer<typeof TeamIdParamSchema>;

export const RosterIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type RosterIdParamDto = z.infer<typeof RosterIdParamSchema>;

// ---------------------------------------------------------------------------
// Product / Application DTOs
// ---------------------------------------------------------------------------

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  brandId: z.string().uuid().nullable().optional(),
  description: z.string().max(500).optional(),
});
export type CreateProductDto = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = CreateProductSchema.partial().extend({
  isActive: z.boolean().optional(),
});
export type UpdateProductDto = z.infer<typeof UpdateProductSchema>;

export const ProductIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type ProductIdParamDto = z.infer<typeof ProductIdParamSchema>;


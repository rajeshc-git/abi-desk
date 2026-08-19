import { z } from 'zod';
import { RoleKeyEnum } from '../sla/sla.dto';

// ---------------------------------------------------------------------------
// Brands
// ---------------------------------------------------------------------------

export const CreateBrandSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/, 'Slug must be alphanumeric with hyphens'),
  isDefault: z.boolean().default(false),
  primaryColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#2563EB'),
  accentColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .default('#1E40AF'),
  logoUrl: z.string().url().max(2048).optional(),
  faviconUrl: z.string().url().max(2048).optional(),
  supportEmail: z.string().email().max(320).optional(),
  portalDomain: z.string().max(253).optional(),
  timezone: z.string().max(64).optional(),
  locale: z.string().max(16).optional(),
});
export type CreateBrandDto = z.infer<typeof CreateBrandSchema>;

export const UpdateBrandSchema = CreateBrandSchema.partial();
export type UpdateBrandDto = z.infer<typeof UpdateBrandSchema>;

export const BrandIdParamSchema = z.object({
  id: z.string().uuid(),
});
export type BrandIdParamDto = z.infer<typeof BrandIdParamSchema>;

// ---------------------------------------------------------------------------
// Widget Config
// ---------------------------------------------------------------------------

export const WidgetLauncherPositionEnum = z.enum([
  'BOTTOM_RIGHT',
  'BOTTOM_LEFT',
  'TOP_RIGHT',
  'TOP_LEFT',
]);

export const UpdateWidgetConfigSchema = z.object({
  widgetEnabled: z.boolean().optional(),
  adminWidgetEnabled: z.boolean().optional(),
  allowedOrigins: z.array(z.string()).optional(),
  screenshotEnabled: z.boolean().optional(),
  annotationEnabled: z.boolean().optional(),
  screenRecordingEnabled: z.boolean().optional(),
  voiceRecordingEnabled: z.boolean().optional(),
  attachmentsEnabled: z.boolean().optional(),
  consoleCaptureEnabled: z.boolean().optional(),
  networkCaptureEnabled: z.boolean().optional(),
  errorCaptureEnabled: z.boolean().optional(),
  performanceCapture: z.boolean().optional(),
  liveChatEnabled: z.boolean().optional(),
  ticketTrackingEnabled: z.boolean().optional(),
  kbDeflectionEnabled: z.boolean().optional(),
  anonymousTicketsEnabled: z.boolean().optional(),
  maxRecordingSeconds: z.number().int().min(10).max(600).optional(),
  maxAttachmentBytes: z.number().int().min(1024).max(104857600).optional(),
  maxAttachmentsPerTicket: z.number().int().min(1).max(50).optional(),
  launcherPosition: WidgetLauncherPositionEnum.optional(),
  launcherLabel: z.string().max(40).optional(),
  welcomeMessage: z.string().max(500).optional(),
  privacyNotice: z.string().max(1000).optional(),
  requireConsent: z.boolean().optional(),
  theme: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateWidgetConfigDto = z.infer<typeof UpdateWidgetConfigSchema>;

// ---------------------------------------------------------------------------
// Teams & Queues
// ---------------------------------------------------------------------------

export const SupportTierEnum = z.enum(['L1', 'L2', 'L3', 'DEV', 'QA']);

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  tier: SupportTierEnum.optional(),
  isActive: z.boolean().default(true),
});
export type CreateTeamDto = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = CreateTeamSchema.partial();
export type UpdateTeamDto = z.infer<typeof UpdateTeamSchema>;

export const TeamMemberInputSchema = z.object({
  userId: z.string().uuid(),
  isLead: z.boolean().default(false),
});
export type TeamMemberInputDto = z.infer<typeof TeamMemberInputSchema>;

export const CreateQueueSchema = z.object({
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9-]+$/),
  description: z.string().max(500).optional(),
  tier: SupportTierEnum.default('L1'),
  brandId: z.string().uuid().optional(),
  teamId: z.string().uuid().optional(),
  routing: z.enum(['MANUAL', 'ROUND_ROBIN', 'LEAST_LOADED']).default('LEAST_LOADED'),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type CreateQueueDto = z.infer<typeof CreateQueueSchema>;

export const UpdateQueueSchema = CreateQueueSchema.partial();
export type UpdateQueueDto = z.infer<typeof UpdateQueueSchema>;

// ---------------------------------------------------------------------------
// Users & Invitations
// ---------------------------------------------------------------------------

export const InviteUserSchema = z.object({
  email: z.string().email().max(320),
  roleId: z.string().uuid(),
  brandId: z.string().uuid().optional(),
  message: z.string().max(1000).optional(),
});
export type InviteUserDto = z.infer<typeof InviteUserSchema>;

export const UpdateUserAdminSchema = z.object({
  status: z.enum(['INVITED', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional(),
  isAvailable: z.boolean().optional(),
  maxConcurrentTickets: z.number().int().min(1).max(100).nullable().optional(),
  roleId: z.string().uuid().optional(),
  brandId: z.string().uuid().nullable().optional(),
});
export type UpdateUserAdminDto = z.infer<typeof UpdateUserAdminSchema>;

// ---------------------------------------------------------------------------
// Role Permission Overrides
// ---------------------------------------------------------------------------

export const SetRoleOverrideSchema = z.object({
  roleId: z.string().uuid(),
  permissionKey: z.string().min(1),
  granted: z.boolean(),
  reason: z.string().max(500).optional(),
});
export type SetRoleOverrideDto = z.infer<typeof SetRoleOverrideSchema>;

import { z } from 'zod';
import { createZodDto } from '../../common/validation/zod-dto';

/**
 * Request contracts for the auth surface.
 *
 * One Zod schema per payload drives runtime validation and the static type, so the
 * two cannot drift. Emails are lower-cased and trimmed at the boundary because
 * uniqueness in the database is a plain index, not a case-insensitive one - the
 * normalisation has to happen here or not at all.
 */

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(320)
  .email('must be a valid email address');

/** Present but never inspected for content - policy is enforced server-side. */
const password = z.string().min(1, 'is required').max(1024);

const tenantSlug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9][a-z0-9-]{0,62}$/, 'must be a valid workspace identifier')
  .optional();

/**
 * Where to deliver tokens.
 *
 * `token` (the default) returns them in the body for programmatic clients.
 * `cookie` sets httpOnly cookies for the browser console and additionally returns a
 * CSRF token. Defaulting to `token` keeps the API usable from curl without surprising
 * Set-Cookie headers.
 */
const sessionMode = z.enum(['token', 'cookie']).default('token');

export const loginSchema = z.object({
  email,
  password,
  tenantSlug,
  sessionMode,
});

export class LoginDto extends createZodDto(loginSchema) {}

export const refreshSchema = z.object({
  /** Omitted when the refresh token arrives as a cookie. */
  refreshToken: z.string().min(20).max(200).optional(),
  sessionMode,
});

export class RefreshDto extends createZodDto(refreshSchema) {}

export const magicLinkRequestSchema = z.object({
  email,
  /** Identifies which brand's widget asked, and therefore the tenant. */
  widgetPublicKey: z.string().trim().min(8).max(64),
});

export class MagicLinkRequestDto extends createZodDto(magicLinkRequestSchema) {}

export const magicLinkRedeemSchema = z.object({
  token: z.string().min(20).max(200),
  sessionMode,
});

export class MagicLinkRedeemDto extends createZodDto(magicLinkRedeemSchema) {}

export const forgotPasswordSchema = z.object({
  email,
  tenantSlug,
});

export class ForgotPasswordDto extends createZodDto(forgotPasswordSchema) {}

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

export class ResetPasswordDto extends createZodDto(resetPasswordSchema) {}

export const changePasswordSchema = z.object({
  currentPassword: password,
  newPassword: password,
});

export class ChangePasswordDto extends createZodDto(changePasswordSchema) {}

export const acceptInvitationSchema = z.object({
  token: z.string().min(20).max(200),
  fullName: z.string().trim().min(2).max(200).optional(),
  /** Required only when the account does not already have a password. */
  password: password.optional(),
  sessionMode,
});

export class AcceptInvitationDto extends createZodDto(acceptInvitationSchema) {}

export const invitationTokenParamSchema = z.object({
  token: z.string().min(20).max(200),
});

export class InvitationTokenParamDto extends createZodDto(invitationTokenParamSchema) {}

export const sessionIdParamSchema = z.object({
  id: z.string().uuid('must be a valid session id'),
});

export class SessionIdParamDto extends createZodDto(sessionIdParamSchema) {}

export const registerOrganizationSchema = z.object({
  companyName: z.string().trim().min(2, 'Company name is required').max(100),
  fullName: z.string().trim().min(2, 'Full name is required').max(100),
  email,
  password: z.string().min(8, 'Password must be at least 8 characters').max(1024),
  sessionMode,
});

export class RegisterOrganizationDto extends createZodDto(registerOrganizationSchema) {}

export const verifyRegisterOtpSchema = z.object({
  email,
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  sessionMode,
});

export class VerifyRegisterOtpDto extends createZodDto(verifyRegisterOtpSchema) {}

export const sendWidgetOtpSchema = z.object({
  email,
  publicKey: z.string().min(1, 'is required'),
});

export class SendWidgetOtpDto extends createZodDto(sendWidgetOtpSchema) {}

export const verifyWidgetOtpSchema = z.object({
  email,
  publicKey: z.string().min(1, 'is required'),
  otp: z.string().length(4, 'OTP must be exactly 4 digits'),
});

export class VerifyWidgetOtpDto extends createZodDto(verifyWidgetOtpSchema) {}

export const updatePreferencesSchema = z.object({
  themeColor: z
    .string()
    .trim()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'must be a valid hex color')
    .nullable()
    .optional(),
});

export class UpdatePreferencesDto extends createZodDto(updatePreferencesSchema) {}


import { z } from 'zod';

export const SsoProtocolEnum = z.enum(['OIDC', 'SAML']);
export type SsoProtocol = z.infer<typeof SsoProtocolEnum>;

export const ClaimMappingSchema = z
  .object({
    email: z.string().default('email'),
    fullName: z.string().default('name'),
    groups: z.string().optional(),
    avatarUrl: z.string().optional(),
  })
  .default({ email: 'email', fullName: 'name' });

export const ConfigureOidcProviderSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().min(1).max(253),
  issuer: z.string().url().max(2048),
  clientId: z.string().min(1).max(500),
  clientSecret: z.string().max(1000).optional(),
  authorizationUrl: z.string().url().max(2048),
  tokenUrl: z.string().url().max(2048),
  userinfoUrl: z.string().url().max(2048).optional(),
  jwksUri: z.string().url().max(2048).optional(),
  claimMapping: ClaimMappingSchema.optional(),
  defaultRoleId: z.string().uuid().optional(),
  jitProvisioning: z.boolean().default(true),
  enforceSso: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type ConfigureOidcProviderDto = z.infer<typeof ConfigureOidcProviderSchema>;

export const ConfigureSamlProviderSchema = z.object({
  name: z.string().min(1).max(120),
  domain: z.string().min(1).max(253),
  samlEntityId: z.string().min(1).max(2048),
  samlSsoUrl: z.string().url().max(2048),
  samlCert: z.string().max(10000).optional(),
  claimMapping: ClaimMappingSchema.optional(),
  defaultRoleId: z.string().uuid().optional(),
  jitProvisioning: z.boolean().default(true),
  enforceSso: z.boolean().default(false),
  isActive: z.boolean().default(true),
});
export type ConfigureSamlProviderDto = z.infer<typeof ConfigureSamlProviderSchema>;

export const InitiateSsoSchema = z.object({
  email: z.string().email().optional(),
  domain: z.string().optional(),
  tenantSlug: z.string().optional(),
  redirectUrl: z.string().url().optional(),
});
export type InitiateSsoDto = z.infer<typeof InitiateSsoSchema>;

export const SsoCallbackQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
});
export type SsoCallbackQueryDto = z.infer<typeof SsoCallbackQuerySchema>;

import { z } from 'zod';

export const CreateWebhookEndpointSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().max(2048),
  events: z.array(z.string().min(1)).min(1),
  headers: z.record(z.string()).default({}),
  maxRetries: z.number().int().min(0).max(10).default(5),
  timeoutMs: z.number().int().min(1000).max(30000).default(10000),
  isActive: z.boolean().default(true),
});

export type CreateWebhookEndpointDto = z.infer<typeof CreateWebhookEndpointSchema>;

export const UpdateWebhookEndpointSchema = CreateWebhookEndpointSchema.partial();
export type UpdateWebhookEndpointDto = z.infer<typeof UpdateWebhookEndpointSchema>;

export const WebhookEndpointIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type WebhookEndpointIdParamDto = z.infer<typeof WebhookEndpointIdParamSchema>;

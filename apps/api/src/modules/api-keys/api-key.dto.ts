import { z } from 'zod';
import { PERMISSION_KEYS } from '@abi-desk/rbac';
import { createZodDto } from '../../common/validation/zod-dto';

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(120),
  scopes: z
    .array(
      z.string().refine((k) => PERMISSION_KEYS.includes(k), {
        message: 'Invalid permission scope',
      }),
    )
    .min(1),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});

export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {}

export const ApiKeyIdParamSchema = z.object({
  id: z.string().uuid(),
});

export class ApiKeyIdParamDto extends createZodDto(ApiKeyIdParamSchema) {}

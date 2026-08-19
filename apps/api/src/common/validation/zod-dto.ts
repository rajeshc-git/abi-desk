import { type z, type ZodTypeAny } from 'zod';

/**
 * Bridges Zod schemas into Nest's DTO/metatype system.
 *
 * A single schema then drives runtime validation, the static TypeScript type and
 * (later) the OpenAPI document - no parallel class-validator definition to drift
 * out of sync.
 *
 * ```ts
 * const createTicketSchema = z.object({ subject: z.string().min(3) });
 * class CreateTicketDto extends createZodDto(createTicketSchema) {}
 *
 * @Post()
 * create(@Body() dto: CreateTicketDto) { ... } // already parsed and typed
 * ```
 */
export interface ZodDtoClass<TSchema extends ZodTypeAny = ZodTypeAny> {
  new (): z.infer<TSchema>;
  readonly zodSchema: TSchema;
}

export function createZodDto<TSchema extends ZodTypeAny>(schema: TSchema): ZodDtoClass<TSchema> {
  class ZodDto {
    static readonly zodSchema = schema;
  }

  return ZodDto as unknown as ZodDtoClass<TSchema>;
}

/** Narrowing helper used by the global validation pipe. */
export function isZodDto(metatype: unknown): metatype is ZodDtoClass {
  return (
    typeof metatype === 'function' &&
    'zodSchema' in metatype &&
    typeof (metatype as { zodSchema?: unknown }).zodSchema === 'object'
  );
}

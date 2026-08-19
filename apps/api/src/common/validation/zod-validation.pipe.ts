import { type ArgumentMetadata, Injectable, type PipeTransform } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppException } from '../errors/app-exception';
import { ErrorCode } from '../errors/error-codes';
import { zodErrorToFieldErrors } from '../errors/to-problem-details';
import { isZodDto } from './zod-dto';

/**
 * Global pipe that validates any argument whose DTO was produced by
 * `createZodDto`. Arguments without a Zod schema pass straight through, so the
 * pipe is safe to register globally.
 *
 * Failures become 422 with a field-level `errors` array rather than Nest's
 * default flat string list, which is what makes them renderable in a form UI.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const { metatype } = metadata;

    if (!isZodDto(metatype)) {
      return value;
    }

    const result = metatype.zodSchema.safeParse(value);

    if (result.success) {
      return result.data;
    }

    throw new AppException(
      ErrorCode.VALIDATION_FAILED,
      422,
      `Validation failed for request ${metadata.type}.`,
      { errors: zodErrorToFieldErrors(result.error as ZodError) },
    );
  }
}

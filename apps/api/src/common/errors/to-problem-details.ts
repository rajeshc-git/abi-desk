import { HttpException, HttpStatus } from '@nestjs/common';
import { ZodError } from 'zod';
import { AppException } from './app-exception';
import { ErrorCode, ERROR_TITLES } from './error-codes';
import { type ProblemDetails, type ProblemFieldError, problemTypeUri } from './problem-details';

export interface ProblemContext {
  instance?: string;
  requestId?: string;
  /** In production we refuse to leak internal messages for unexpected errors. */
  exposeInternalDetail: boolean;
}

/** Fallback titles for HTTP statuses raised by Nest itself. */
const STATUS_CODE_BY_STATUS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.MALFORMED_REQUEST,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.PERMISSION_DENIED,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_FAILED,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.NOT_IMPLEMENTED]: ErrorCode.NOT_IMPLEMENTED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

/** Renders a Zod path array as a readable field path: `items[0].name`. */
export function formatZodPath(path: ReadonlyArray<string | number | symbol>): string {
  return path.reduce<string>((acc, segment) => {
    if (typeof segment === 'number') return `${acc}[${segment}]`;
    const key = String(segment);
    return acc.length === 0 ? key : `${acc}.${key}`;
  }, '');
}

export function zodErrorToFieldErrors(error: ZodError): ProblemFieldError[] {
  return error.issues.map((issue) => ({
    path: formatZodPath(issue.path),
    message: issue.message,
    code: issue.code,
  }));
}

/**
 * Normalizes anything thrown anywhere in the application into a single
 * RFC 7807 body. This is the only place that decides what a client gets to see.
 */
export function toProblemDetails(exception: unknown, context: ProblemContext): ProblemDetails {
  const base = {
    instance: context.instance,
    requestId: context.requestId,
    timestamp: new Date().toISOString(),
  };

  if (exception instanceof AppException) {
    return {
      ...base,
      type: problemTypeUri(exception.code),
      title: ERROR_TITLES[exception.code] ?? exception.code,
      status: exception.getStatus(),
      detail: exception.message,
      code: exception.code,
      ...(exception.errors?.length ? { errors: exception.errors } : {}),
    };
  }

  if (exception instanceof ZodError) {
    return {
      ...base,
      type: problemTypeUri(ErrorCode.VALIDATION_FAILED),
      title: ERROR_TITLES[ErrorCode.VALIDATION_FAILED]!,
      status: HttpStatus.UNPROCESSABLE_ENTITY,
      detail: 'One or more fields failed validation.',
      code: ErrorCode.VALIDATION_FAILED,
      errors: zodErrorToFieldErrors(exception),
    };
  }

  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const code = STATUS_CODE_BY_STATUS[status] ?? ErrorCode.INTERNAL_ERROR;
    const response = exception.getResponse();

    // Nest packs validation-ish detail into `response.message`; surface it.
    let detail = exception.message;
    let errors: ProblemFieldError[] | undefined;

    if (typeof response === 'object' && response !== null) {
      const payload = response as { message?: unknown; error?: unknown };
      if (Array.isArray(payload.message)) {
        errors = payload.message.map((message) => ({ path: '', message: String(message) }));
        detail = 'One or more fields failed validation.';
      } else if (typeof payload.message === 'string') {
        detail = payload.message;
      }
    }

    return {
      ...base,
      type: problemTypeUri(code),
      title: ERROR_TITLES[code] ?? code,
      status,
      detail,
      code,
      ...(errors?.length ? { errors } : {}),
    };
  }

  // Unexpected: a bug, a driver failure, an unhandled rejection. Never leak
  // internals to the client outside development.
  return {
    ...base,
    type: problemTypeUri(ErrorCode.INTERNAL_ERROR),
    title: ERROR_TITLES[ErrorCode.INTERNAL_ERROR]!,
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    detail: context.exposeInternalDetail
      ? extractMessage(exception)
      : 'An unexpected error occurred. Quote the requestId when contacting support.',
    code: ErrorCode.INTERNAL_ERROR,
  };
}

function extractMessage(exception: unknown): string {
  if (exception instanceof Error) return exception.message;
  if (typeof exception === 'string') return exception;
  return 'Unknown error';
}

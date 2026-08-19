import { HttpException, HttpStatus } from '@nestjs/common';
import { ErrorCode, type ErrorCodeValue } from './error-codes';
import { type ProblemFieldError } from './problem-details';

export interface AppExceptionOptions {
  /** Field-level detail, surfaced in the `errors` array of the problem body. */
  errors?: ProblemFieldError[];
  /** Structured context for the logs. Never serialized to the client. */
  logContext?: Record<string, unknown>;
  /** Underlying error, preserved for the stack trace. */
  cause?: unknown;
}

/**
 * Domain exception carrying a stable error code alongside the HTTP status.
 *
 * Throwing `AppException` (rather than a bare `HttpException`) is what lets the
 * global filter emit a consistent RFC 7807 body without a translation table per
 * module.
 */
export class AppException extends HttpException {
  readonly code: ErrorCodeValue | string;
  readonly errors?: ProblemFieldError[];
  readonly logContext?: Record<string, unknown>;

  constructor(
    code: ErrorCodeValue | string,
    status: HttpStatus,
    detail: string,
    options: AppExceptionOptions = {},
  ) {
    super(detail, status, { cause: options.cause });
    this.name = 'AppException';
    this.code = code;
    this.errors = options.errors;
    this.logContext = options.logContext;
  }

  // --- Ergonomic factories for the cases that come up constantly ----------

  static notFound(resource: string, identifier?: string): AppException {
    return new AppException(
      ErrorCode.NOT_FOUND,
      HttpStatus.NOT_FOUND,
      identifier ? `${resource} '${identifier}' was not found.` : `${resource} was not found.`,
      { logContext: { resource, identifier } },
    );
  }

  static conflict(detail: string, logContext?: Record<string, unknown>): AppException {
    return new AppException(ErrorCode.CONFLICT, HttpStatus.CONFLICT, detail, { logContext });
  }

  static unauthenticated(
    detail = 'Authentication is required to access this resource.',
    code: ErrorCodeValue = ErrorCode.UNAUTHENTICATED,
  ): AppException {
    return new AppException(code, HttpStatus.UNAUTHORIZED, detail);
  }

  static permissionDenied(detail: string, logContext?: Record<string, unknown>): AppException {
    return new AppException(ErrorCode.PERMISSION_DENIED, HttpStatus.FORBIDDEN, detail, {
      logContext,
    });
  }

  static badRequest(detail: string, errors?: ProblemFieldError[]): AppException {
    return new AppException(ErrorCode.MALFORMED_REQUEST, HttpStatus.BAD_REQUEST, detail, {
      errors,
    });
  }

  static unprocessable(
    detail: string,
    errors?: ProblemFieldError[],
    code: ErrorCodeValue | string = ErrorCode.VALIDATION_FAILED,
  ): AppException {
    return new AppException(code, HttpStatus.UNPROCESSABLE_ENTITY, detail, { errors });
  }

  static internal(detail: string, options?: AppExceptionOptions): AppException {
    return new AppException(
      ErrorCode.INTERNAL_ERROR,
      HttpStatus.INTERNAL_SERVER_ERROR,
      detail,
      options,
    );
  }
}

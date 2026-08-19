/**
 * RFC 7807 "Problem Details for HTTP APIs" response shape.
 *
 * One error format for the whole surface area - REST clients, the console, the
 * widget and tenant integrations all parse the same envelope. `code` is the
 * stable, machine-readable contract; `title`/`detail` are for humans and may be
 * reworded without breaking consumers.
 */
export interface ProblemDetails {
  /** URI reference identifying the problem type. */
  type: string;
  /** Short, human-readable summary. Stable per `code`. */
  title: string;
  /** HTTP status code, duplicated in the body for convenience. */
  status: number;
  /** Human-readable explanation specific to this occurrence. */
  detail?: string;
  /** The request path that produced the problem. */
  instance?: string;
  /** Stable machine-readable error code, e.g. `TICKET_TRANSITION_FORBIDDEN`. */
  code: string;
  /** Correlation id; matches the `x-request-id` response header and the logs. */
  requestId?: string;
  /** Field-level failures, populated for validation problems. */
  errors?: ProblemFieldError[];
  timestamp: string;
}

export interface ProblemFieldError {
  /** Dot/bracket path to the offending field, e.g. `filters.status[0]`. */
  path: string;
  message: string;
  code?: string;
}

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';

/** Base URI namespace for documented error types. */
export const PROBLEM_TYPE_BASE = 'https://docs.abidesk.local/errors';

export function problemTypeUri(code: string): string {
  return `${PROBLEM_TYPE_BASE}/${code.toLowerCase().replace(/_/g, '-')}`;
}

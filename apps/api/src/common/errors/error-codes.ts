/**
 * Central registry of machine-readable error codes.
 *
 * Clients branch on these strings, so treat them as a published contract:
 * add freely, rename never.
 */
export const ErrorCode = {
  // Generic
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  MALFORMED_REQUEST: 'MALFORMED_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',

  // Authentication / authorization
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  SESSION_REVOKED: 'SESSION_REVOKED',
  PERMISSION_DENIED: 'PERMISSION_DENIED',

  // Tenancy
  TENANT_CONTEXT_MISSING: 'TENANT_CONTEXT_MISSING',
  TENANT_MISMATCH: 'TENANT_MISMATCH',
  TENANT_SUSPENDED: 'TENANT_SUSPENDED',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Human-readable titles, kept 1:1 with `ErrorCode`. */
export const ERROR_TITLES: Record<string, string> = {
  [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
  [ErrorCode.VALIDATION_FAILED]: 'Request validation failed',
  [ErrorCode.MALFORMED_REQUEST]: 'Malformed request',
  [ErrorCode.NOT_FOUND]: 'Resource not found',
  [ErrorCode.CONFLICT]: 'Conflicting state',
  [ErrorCode.RATE_LIMITED]: 'Too many requests',
  [ErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
  [ErrorCode.NOT_IMPLEMENTED]: 'Not implemented',
  [ErrorCode.PAYLOAD_TOO_LARGE]: 'Payload too large',
  [ErrorCode.UNAUTHENTICATED]: 'Authentication required',
  [ErrorCode.INVALID_CREDENTIALS]: 'Invalid credentials',
  [ErrorCode.TOKEN_EXPIRED]: 'Token expired',
  [ErrorCode.TOKEN_INVALID]: 'Token invalid',
  [ErrorCode.SESSION_REVOKED]: 'Session revoked',
  [ErrorCode.PERMISSION_DENIED]: 'Permission denied',
  [ErrorCode.TENANT_CONTEXT_MISSING]: 'Tenant context missing',
  [ErrorCode.TENANT_MISMATCH]: 'Tenant mismatch',
  [ErrorCode.TENANT_SUSPENDED]: 'Tenant suspended',
};

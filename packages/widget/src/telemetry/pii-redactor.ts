/**
 * Client-side PII and secret scrubber.
 *
 * Runs before any telemetry, network log or console trace leaves the user's browser.
 */
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
const BEARER_TOKEN_REGEX = /Bearer\s+[a-zA-Z0-9_\-\.=]+/gi;
const API_KEY_REGEX = /(?:key|secret|token|apikey|api_key|auth)=['"]?[a-zA-Z0-9_\-\.]{16,}['"]?/gi;
const CREDIT_CARD_REGEX = /\b(?:\d{4}[ -]?){3}\d{4}\b/g;

export function redactPii(input: string): string {
  if (!input || typeof input !== 'string') return input;

  return input
    .replace(BEARER_TOKEN_REGEX, 'Bearer [REDACTED_TOKEN]')
    .replace(API_KEY_REGEX, '$1=[REDACTED_KEY]')
    .replace(CREDIT_CARD_REGEX, '[REDACTED_CREDIT_CARD]')
    .replace(EMAIL_REGEX, (match) => {
      const parts = match.split('@');
      const name = parts[0] ?? '';
      const domain = parts[1] ?? '';
      const maskedName = name.length > 2 ? `${name.slice(0, 2)}***` : '***';
      return `${maskedName}@${domain}`;
    });
}

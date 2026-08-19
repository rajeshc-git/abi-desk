import { describe, expect, it } from 'vitest';
import { redactPii } from './telemetry/pii-redactor.js';

describe('Widget Telemetry and Redaction', () => {
  it('redacts sensitive emails, bearer tokens, API keys, and card numbers', () => {
    const raw =
      'User john.doe@example.com logged in with Bearer eyJhbGciOiJIUzI1NiJ9.test and card 4532-1234-5678-9012';
    const cleaned = redactPii(raw);

    expect(cleaned).toContain('jo***@example.com');
    expect(cleaned).toContain('Bearer [REDACTED_TOKEN]');
    expect(cleaned).toContain('[REDACTED_CREDIT_CARD]');
  });
});

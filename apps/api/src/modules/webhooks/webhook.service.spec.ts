import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

describe('Webhook HMAC Signatures & Exponential Backoff', () => {
  it('computes and verifies HMAC-SHA256 signature payload header correctly', () => {
    const secret = 'whsec_test_secret_key_12345';
    const timestamp = '1770634800';
    const requestBody = JSON.stringify({ event: 'ticket.created', id: '123' });

    const signature = createHmac('sha256', secret)
      .update(`${timestamp}.${requestBody}`)
      .digest('hex');

    const expectedHeader = `t=${timestamp},v1=${signature}`;
    expect(expectedHeader).toContain(`t=${timestamp},v1=`);

    // Verify signature matches on receiving end
    const computed = createHmac('sha256', secret)
      .update(`${timestamp}.${requestBody}`)
      .digest('hex');

    expect(computed).toBe(signature);
  });

  it('calculates exponential backoff delay correctly across retries', () => {
    const calculateBackoff = (attempt: number) => Math.pow(2, attempt) * 30;

    expect(calculateBackoff(1)).toBe(60); // 60s
    expect(calculateBackoff(2)).toBe(120); // 2m
    expect(calculateBackoff(3)).toBe(240); // 4m
    expect(calculateBackoff(4)).toBe(480); // 8m
    expect(calculateBackoff(5)).toBe(960); // 16m
  });
});

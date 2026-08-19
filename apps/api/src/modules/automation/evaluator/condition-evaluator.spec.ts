import { describe, expect, it } from 'vitest';
import { ConditionEvaluator } from './condition-evaluator';

describe('ConditionEvaluator', () => {
  const sampleTicket = {
    id: '11111111-1111-1111-1111-111111111111',
    number: 'ACME-100',
    subject: 'Urgent payment failure on checkout',
    description: 'Customer unable to complete credit card purchase',
    priority: 'URGENT',
    status: 'OPEN',
    tier: 'L1',
    channel: 'WIDGET',
    category: 'billing',
    subcategory: 'payment_gateway',
    tags: [{ tag: { slug: 'billing-error', name: 'Billing Error' } }],
    diagnosticBundle: {
      browserName: 'Chrome',
      osName: 'macOS',
      jsErrorCount: 3,
    },
  };

  it('matches empty conditions as true', () => {
    const result = ConditionEvaluator.evaluate(sampleTicket, {});
    expect(result.matched).toBe(true);
  });

  it('evaluates simple equality condition', () => {
    const match = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'priority',
      op: 'eq',
      value: 'URGENT',
    });
    expect(match.matched).toBe(true);

    const nonMatch = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'priority',
      op: 'eq',
      value: 'LOW',
    });
    expect(nonMatch.matched).toBe(false);
  });

  it('evaluates string contains condition case-insensitively', () => {
    const match = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'subject',
      op: 'contains',
      value: 'Payment',
    });
    expect(match.matched).toBe(true);

    const nonMatch = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'subject',
      op: 'contains',
      value: 'refund',
    });
    expect(nonMatch.matched).toBe(false);
  });

  it('evaluates in / not_in condition on array or string', () => {
    const match = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'priority',
      op: 'in',
      value: ['HIGH', 'URGENT', 'CRITICAL'],
    });
    expect(match.matched).toBe(true);

    const nonMatch = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'priority',
      op: 'not_in',
      value: ['HIGH', 'URGENT', 'CRITICAL'],
    });
    expect(nonMatch.matched).toBe(false);
  });

  it('evaluates nested field access like diagnosticBundle.browserName', () => {
    const match = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'diagnosticBundle.browserName',
      op: 'eq',
      value: 'Chrome',
    });
    expect(match.matched).toBe(true);

    const numMatch = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'diagnosticBundle.jsErrorCount',
      op: 'gt',
      value: 1,
    });
    expect(numMatch.matched).toBe(true);
  });

  it('evaluates tags list correctly', () => {
    const match = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'tags',
      op: 'contains',
      value: 'billing-error',
    });
    expect(match.matched).toBe(true);

    const nonMatch = ConditionEvaluator.evaluate(sampleTicket, {
      field: 'tags',
      op: 'contains',
      value: 'ui-bug',
    });
    expect(nonMatch.matched).toBe(false);
  });

  it('evaluates group with all, any, none', () => {
    const groupMatch = ConditionEvaluator.evaluate(sampleTicket, {
      all: [
        { field: 'priority', op: 'eq', value: 'URGENT' },
        { field: 'category', op: 'eq', value: 'billing' },
      ],
      any: [
        { field: 'tier', op: 'eq', value: 'L1' },
        { field: 'tier', op: 'eq', value: 'L2' },
      ],
      none: [{ field: 'isSpam', op: 'eq', value: true }],
    });

    expect(groupMatch.matched).toBe(true);
    expect(groupMatch.trace).toBeDefined();
  });
});

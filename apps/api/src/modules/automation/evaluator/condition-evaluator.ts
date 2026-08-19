import {
  type ConditionGroup,
  type ConditionOperator,
  type SingleCondition,
} from '../automation.dto';

export interface ConditionEvaluationResult {
  matched: boolean;
  trace: Record<string, unknown>;
}

export class ConditionEvaluator {
  /**
   * Evaluates a condition tree against a ticket entity.
   */
  static evaluate(
    ticket: Record<string, unknown>,
    conditions: SingleCondition | ConditionGroup | Record<string, unknown>,
  ): ConditionEvaluationResult {
    if (!conditions || Object.keys(conditions).length === 0) {
      return { matched: true, trace: { empty: true, matched: true } };
    }

    // Check if it's a group: { all?: [...], any?: [...], none?: [...] }
    if ('all' in conditions || 'any' in conditions || 'none' in conditions) {
      return this.evaluateGroup(ticket, conditions as ConditionGroup);
    }

    // Check if it's a single condition: { field, op, value }
    if ('field' in conditions && 'op' in conditions) {
      return this.evaluateSingle(ticket, conditions as SingleCondition);
    }

    return { matched: true, trace: { fallback: true, matched: true } };
  }

  private static evaluateGroup(
    ticket: Record<string, unknown>,
    group: ConditionGroup,
  ): ConditionEvaluationResult {
    const trace: Record<string, unknown> = {};
    let matched = true;

    if (group.all && group.all.length > 0) {
      const allResults = group.all.map((cond, idx) => {
        const res = this.evaluate(ticket, cond);
        return { index: idx, ...res };
      });
      const allMatched = allResults.every((r) => r.matched);
      trace.all = allResults;
      if (!allMatched) matched = false;
    }

    if (group.any && group.any.length > 0) {
      const anyResults = group.any.map((cond, idx) => {
        const res = this.evaluate(ticket, cond);
        return { index: idx, ...res };
      });
      const anyMatched = anyResults.some((r) => r.matched);
      trace.any = anyResults;
      if (!anyMatched) matched = false;
    }

    if (group.none && group.none.length > 0) {
      const noneResults = group.none.map((cond, idx) => {
        const res = this.evaluate(ticket, cond);
        return { index: idx, ...res };
      });
      const noneMatched = noneResults.every((r) => !r.matched);
      trace.none = noneResults;
      if (!noneMatched) matched = false;
    }

    return { matched, trace: { ...trace, groupMatched: matched } };
  }

  private static evaluateSingle(
    ticket: Record<string, unknown>,
    cond: SingleCondition,
  ): ConditionEvaluationResult {
    const actualValue = this.extractFieldValue(ticket, cond.field);
    const passed = this.compareValues(actualValue, cond.op, cond.value);

    return {
      matched: passed,
      trace: {
        field: cond.field,
        operator: cond.op,
        expected: cond.value,
        actual: actualValue,
        passed,
      },
    };
  }

  private static extractFieldValue(ticket: Record<string, unknown>, field: string): unknown {
    if (!ticket) return undefined;

    // Special field extractors
    if (field === 'tags' || field === 'tag') {
      const ticketTags = ticket.tags as
        Array<{ tag?: { slug?: string; name?: string } }> | undefined;
      if (Array.isArray(ticketTags)) {
        return ticketTags.map((t) => t.tag?.slug ?? t.tag?.name ?? '').filter(Boolean);
      }
      return [];
    }

    if (field.includes('.')) {
      const parts = field.split('.');
      let curr: unknown = ticket;
      for (const part of parts) {
        if (curr && typeof curr === 'object' && part in (curr as Record<string, unknown>)) {
          curr = (curr as Record<string, unknown>)[part];
        } else {
          return undefined;
        }
      }
      return curr;
    }

    return ticket[field];
  }

  private static compareValues(actual: unknown, op: ConditionOperator, expected: unknown): boolean {
    switch (op) {
      case 'eq':
        if (actual === null || actual === undefined) {
          return expected === null || expected === undefined;
        }
        return String(actual).toLowerCase() === String(expected).toLowerCase();

      case 'neq':
        if (actual === null || actual === undefined) {
          return expected !== null && expected !== undefined;
        }
        return String(actual).toLowerCase() !== String(expected).toLowerCase();

      case 'in':
        if (!Array.isArray(expected)) return false;
        if (Array.isArray(actual)) {
          return actual.some((a) =>
            expected.map((e) => String(e).toLowerCase()).includes(String(a).toLowerCase()),
          );
        }
        return expected.map((e) => String(e).toLowerCase()).includes(String(actual).toLowerCase());

      case 'not_in':
        if (!Array.isArray(expected)) return true;
        if (Array.isArray(actual)) {
          return !actual.some((a) =>
            expected.map((e) => String(e).toLowerCase()).includes(String(a).toLowerCase()),
          );
        }
        return !expected.map((e) => String(e).toLowerCase()).includes(String(actual).toLowerCase());

      case 'contains':
        if (Array.isArray(actual)) {
          return actual.some((item) =>
            String(item).toLowerCase().includes(String(expected).toLowerCase()),
          );
        }
        if (typeof actual === 'string') {
          return actual.toLowerCase().includes(String(expected).toLowerCase());
        }
        return false;

      case 'not_contains':
        if (Array.isArray(actual)) {
          return !actual.some((item) =>
            String(item).toLowerCase().includes(String(expected).toLowerCase()),
          );
        }
        if (typeof actual === 'string') {
          return !actual.toLowerCase().includes(String(expected).toLowerCase());
        }
        return true;

      case 'starts_with':
        if (typeof actual === 'string') {
          return actual.toLowerCase().startsWith(String(expected).toLowerCase());
        }
        return false;

      case 'ends_with':
        if (typeof actual === 'string') {
          return actual.toLowerCase().endsWith(String(expected).toLowerCase());
        }
        return false;

      case 'gt':
        return Number(actual) > Number(expected);

      case 'gte':
        return Number(actual) >= Number(expected);

      case 'lt':
        return Number(actual) < Number(expected);

      case 'lte':
        return Number(actual) <= Number(expected);

      case 'is_empty':
        if (actual === null || actual === undefined) return true;
        if (typeof actual === 'string') return actual.trim().length === 0;
        if (Array.isArray(actual)) return actual.length === 0;
        return false;

      case 'is_not_empty':
        if (actual === null || actual === undefined) return false;
        if (typeof actual === 'string') return actual.trim().length > 0;
        if (Array.isArray(actual)) return actual.length > 0;
        return true;

      default:
        return false;
    }
  }
}

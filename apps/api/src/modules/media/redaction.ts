/**
 * Server-side redaction for diagnostic bundles.
 *
 * ## Why this runs on the server even though the widget already scrubs
 *
 * The widget scrubs before sending, which is the right place to avoid transmitting
 * secrets at all. But the widget is code running in someone else's page: it can be an
 * older cached build, a modified copy, or bypassed entirely by posting to the ingest
 * endpoint directly. Anything arriving here is therefore untrusted input, and the
 * database is the thing that has to be safe. Client-side scrubbing reduces exposure;
 * this is what makes the guarantee.
 *
 * ## Why the applied rules are recorded
 *
 * `diagnostic_bundle.redactionsApplied` stores which rules fired. Redaction that
 * leaves no trace is unauditable - during a GDPR/DPDPA review the question is not
 * "do you redact?" but "prove what you redacted from this record", and a support
 * engineer looking at a masked value needs to know it was masked rather than absent.
 *
 * ## Why patterns, and what that does not cover
 *
 * These rules catch credentials that follow a recognisable shape: bearer tokens, JWTs,
 * API keys, cookies, emails, card numbers, and common secret-ish key names in
 * structured data. They cannot catch a secret that looks like ordinary prose. That is
 * a real limit, so the widget also caps what it collects in the first place - console
 * and network buffers are bounded and header values are dropped wholesale rather than
 * inspected.
 */

export interface RedactionRule {
  /** Recorded in `redactionsApplied` when this rule matches. */
  name: string;
  pattern: RegExp;
  /** Replacement. May reference capture groups to keep a non-secret prefix. */
  replacement: string;
}

/** Marker left in place of a removed value, kept identical everywhere so it is greppable. */
export const REDACTED = '[REDACTED]';

/**
 * Ordered because earlier rules win on overlapping text. `bearer_token` runs before
 * `jwt` so an `Authorization: Bearer <jwt>` is reported as the credential it is,
 * rather than as an incidental JWT.
 */
export const REDACTION_RULES: readonly RedactionRule[] = [
  {
    name: 'bearer_token',
    pattern: /\b(bearer)\s+[A-Za-z0-9._~+/-]+=*/gi,
    replacement: `$1 ${REDACTED}`,
  },
  {
    name: 'basic_auth',
    pattern: /\b(basic)\s+[A-Za-z0-9+/]+=*/gi,
    replacement: `$1 ${REDACTED}`,
  },
  {
    // Three base64url segments separated by dots.
    name: 'jwt',
    pattern: /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
    replacement: REDACTED,
  },
  {
    // `key=value` / `key: value` where the key names a secret. Covers query strings,
    // log lines and serialized objects in one rule.
    name: 'secret_key_value',
    pattern:
      /\b(api[_-]?key|apikey|access[_-]?token|refresh[_-]?token|id[_-]?token|secret|client[_-]?secret|password|passwd|pwd|private[_-]?key|session[_-]?id|csrf[_-]?token|auth[_-]?token)\b(\s*[=:]\s*)("[^"]*"|'[^']*'|[^\s,;&}"']+)/gi,
    replacement: `$1$2${REDACTED}`,
  },
  {
    name: 'cookie_header',
    pattern: /\b(set-cookie|cookie)\b(\s*[=:]\s*)(.+?)(?=[\r\n]|$)/gi,
    replacement: `$1$2${REDACTED}`,
  },
  {
    name: 'aws_access_key_id',
    pattern: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
    replacement: REDACTED,
  },
  {
    name: 'private_key_block',
    pattern: /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
    replacement: REDACTED,
  },
  {
    name: 'email',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
    replacement: REDACTED,
  },
  {
    // 13-19 digits with optional separators, Luhn-checked below to avoid masking
    // order numbers and timestamps.
    name: 'card_number',
    pattern: /\b(?:\d[ -]?){13,19}\b/g,
    replacement: REDACTED,
  },
];

/** Names of rules that must not be weakened by tenant configuration. */
const NON_NEGOTIABLE = new Set([
  'bearer_token',
  'basic_auth',
  'jwt',
  'secret_key_value',
  'cookie_header',
  'aws_access_key_id',
  'private_key_block',
]);

export interface RedactionResult<T> {
  value: T;
  /** Rule names that matched at least once, for `redactionsApplied`. */
  applied: string[];
}

/**
 * Luhn check, used only to decide whether a digit run is really a card number.
 *
 * Without it the `card_number` pattern masks any long digit sequence - request ids,
 * epoch timestamps, trace ids - which would destroy the diagnostic value of the logs
 * this feature exists to collect.
 */
function passesLuhn(digits: string): boolean {
  const only = digits.replace(/\D/g, '');
  if (only.length < 13 || only.length > 19) return false;

  let sum = 0;
  let double = false;

  for (let i = only.length - 1; i >= 0; i -= 1) {
    let digit = only.charCodeAt(i) - 48;

    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }

    sum += digit;
    double = !double;
  }

  return sum % 10 === 0;
}

/** Applies every rule to one string, collecting the names that fired. */
export function redactString(input: string, applied: Set<string>): string {
  let output = input;

  for (const rule of REDACTION_RULES) {
    // `replace` with a function so a rule can decline a match (card_number/Luhn)
    // without a second pass.
    output = output.replace(rule.pattern, (...args: unknown[]) => {
      const match = args[0] as string;

      if (rule.name === 'card_number' && !passesLuhn(match)) {
        return match;
      }

      applied.add(rule.name);

      // Rebuild the replacement, substituting $1..$9 with the captured groups.
      return rule.replacement.replace(/\$(\d)/g, (_token, index: string) => {
        const group = args[Number(index)];
        return typeof group === 'string' ? group : '';
      });
    });
  }

  return output;
}

/**
 * Key names whose *entire value* is dropped regardless of shape.
 *
 * Pattern matching cannot help when the value is an opaque blob with no recognisable
 * structure, so anything under one of these keys is removed by position instead. This
 * is the deny-by-default half of the strategy.
 */
const SENSITIVE_KEY_PATTERN =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-csrf-token|api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|password|passwd|pwd|secret|client[_-]?secret|private[_-]?key|session[_-]?id|token|credentials?)$/i;

/**
 * Walks arbitrary JSON, redacting strings and dropping sensitive keys by name.
 *
 * Depth-limited: a diagnostics payload is attacker-controlled, and an adversarial or
 * accidentally cyclic structure would otherwise blow the stack on the ingest path.
 */
export function redactJson<T>(value: T, applied: Set<string>, depth = 0): T {
  const MAX_DEPTH = 12;

  if (depth > MAX_DEPTH) {
    applied.add('depth_truncated');
    return REDACTED as unknown as T;
  }

  if (typeof value === 'string') {
    return redactString(value, applied) as unknown as T;
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactJson(item, applied, depth + 1)) as unknown as T;
  }

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(source)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      applied.add('sensitive_key');
      result[key] = REDACTED;
      continue;
    }

    result[key] = redactJson(child, applied, depth + 1);
  }

  return result as unknown as T;
}

/** Redacts a value and reports which rules fired. */
export function redact<T>(value: T): RedactionResult<T> {
  const applied = new Set<string>();
  const redacted = redactJson(value, applied);

  return { value: redacted, applied: [...applied].sort() };
}

/**
 * Guards against a tenant setting disabling a rule that protects credentials.
 *
 * Tenants may reasonably want `email` left intact (support agents often need the
 * reporter's address). Nobody may switch off bearer-token redaction, so that is not
 * expressible.
 */
export function assertRuleIsConfigurable(name: string): void {
  if (NON_NEGOTIABLE.has(name)) {
    throw new Error(`Redaction rule "${name}" protects credentials and cannot be disabled.`);
  }
}

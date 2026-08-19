import { z } from 'zod';

/**
 * Environment contract for the API/worker process.
 *
 * Every setting the process needs is declared here and nowhere else. The process
 * refuses to boot on invalid configuration rather than failing later on the
 * first request, which is the difference between a container that crash-loops
 * loudly and one that serves 500s quietly.
 */

/** Parses the loose truthy strings people actually put in `.env` files. */
const booleanFromEnv = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return defaultValue;
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

/** Comma-separated list -> trimmed, de-duplicated string array. */
const listFromEnv = () =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return [] as string[];
      return [
        ...new Set(
          value
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean),
        ),
      ];
    });

/**
 * Parses a human duration (`15m`, `30d`, `12h`, `45s`) into seconds.
 *
 * Configuration is written the way an operator thinks about it, and consumed as a
 * number so no downstream code has to re-parse it.
 */
export function parseDuration(value: string): number | undefined {
  const match = /^(\d+)\s*(s|m|h|d|w)$/i.exec(value.trim());
  if (!match) return undefined;

  const amount = Number(match[1]);
  const unit = (match[2] ?? 's').toLowerCase();

  const seconds: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3_600,
    d: 86_400,
    w: 604_800,
  };

  const multiplier = seconds[unit];
  return multiplier === undefined ? undefined : amount * multiplier;
}

const durationFromEnv = (defaultValue: string) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      const seconds = parseDuration(value?.trim() ? value : defaultValue);

      if (seconds === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `must be a duration such as 30s, 15m, 12h, 30d (got '${value}')`,
        });
        return z.NEVER;
      }

      return seconds;
    });

const connectionString = (protocols: string[]) =>
  z
    .string()
    .min(1)
    .refine(
      (value) => {
        try {
          return protocols.includes(new URL(value).protocol.replace(':', ''));
        } catch {
          return false;
        }
      },
      { message: `must be a valid URL using one of: ${protocols.join(', ')}` },
    );

export const envSchema = z.object({
  // ---- Runtime -----------------------------------------------------------
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  /** One image, two roles: the HTTP API or the background queue worker. */
  PROCESS_ROLE: z.enum(['api', 'worker']).default('api'),
  APP_NAME: z.string().default('abi-desk-api'),
  APP_VERSION: z.string().default('0.1.0'),

  // ---- HTTP --------------------------------------------------------------
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  API_PREFIX: z.string().default('api'),
  /** Max request body in bytes. Media never flows through here (presigned S3). */
  HTTP_BODY_LIMIT_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(2 * 1024 * 1024),
  TRUST_PROXY: booleanFromEnv(true),
  /** Exact origins allowed to call the API with credentials. */
  CORS_ORIGINS: listFromEnv(),

  // ---- Observability -----------------------------------------------------
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanFromEnv(false),

  // ---- PostgreSQL --------------------------------------------------------
  /** Low-privilege runtime role. Row Level Security applies to this connection. */
  DATABASE_URL: connectionString(['postgres', 'postgresql']),
  /** Schema-owner role used by Prisma Migrate. Not used at runtime. */
  MIGRATION_DATABASE_URL: connectionString(['postgres', 'postgresql']).optional(),
  DATABASE_LOG_QUERIES: booleanFromEnv(false),

  // ---- Redis -------------------------------------------------------------
  REDIS_URL: connectionString(['redis', 'rediss']),

  // ---- Object storage (S3 / MinIO) --------------------------------------
  S3_ENDPOINT: connectionString(['http', 'https']),
  /**
   * Endpoint used when *signing* URLs handed to a browser.
   *
   * Separate from `S3_ENDPOINT` because the API reaches storage over a private address
   * (`http://minio:9000` in compose, a VPC endpoint in production) that no browser can
   * resolve. A presigned URL's host is part of the signature, so it has to be signed
   * with the name the client will actually use. Defaults to `S3_ENDPOINT` for setups
   * where the two are genuinely the same.
   */
  S3_PUBLIC_ENDPOINT: connectionString(['http', 'https']).optional(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().min(1).default('abi-desk-media'),
  S3_ACCESS_KEY_ID: z.string().min(1),
  S3_SECRET_ACCESS_KEY: z.string().min(1),
  /** MinIO needs path-style addressing; real S3 does not. */
  S3_FORCE_PATH_STYLE: booleanFromEnv(true),

  // ---- Outbound mail ----------------------------------------------------
  SMTP_HOST: z.string().min(1).default('mailpit'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
  SMTP_SECURE: booleanFromEnv(false),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  MAIL_FROM: z.string().default('ABI Desk <no-reply@abidesk.local>'),

  // ---- Cryptography ------------------------------------------------------
  /**
   * AES-256-GCM key for secrets that must be recoverable rather than merely
   * comparable: widget handoff signing secrets, SSO client secrets, webhook
   * signing secrets, integration tokens, TOTP seeds.
   *
   * Validated here so a short or malformed key fails at boot rather than on the
   * first widget session - a 16-byte key silently accepted would be far worse
   * than a refusal to start.
   */
  APP_ENCRYPTION_KEY: z
    .string()
    .min(1)
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message:
        'must be base64 that decodes to exactly 32 bytes (generate with: openssl rand -base64 32)',
    }),

  // ---- Authentication ----------------------------------------------------
  /**
   * Separate secrets for access and refresh tokens, so a leaked access secret
   * cannot be used to mint refresh tokens (which would turn a 15-minute problem
   * into a 30-day one). Both are HMAC keys for HS512.
   */
  JWT_ACCESS_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  JWT_ACCESS_TTL: durationFromEnv('15m'),
  JWT_REFRESH_TTL: durationFromEnv('30d'),
  JWT_ISSUER: z.string().default('abi-desk'),

  /** Consecutive failures before an account is temporarily locked. */
  AUTH_MAX_FAILED_LOGINS: z.coerce.number().int().positive().default(5),
  AUTH_LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_MAGIC_LINK_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  AUTH_PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(30),
  AUTH_INVITATION_TTL_DAYS: z.coerce.number().int().positive().default(7),
  /**
   * NIST SP 800-63B favours length over composition rules, so this is the only
   * password constraint enforced besides a breach-style blocklist.
   */
  AUTH_PASSWORD_MIN_LENGTH: z.coerce.number().int().min(8).default(8),

  /** `Secure` flag on auth cookies. Must be true anywhere except plain-HTTP dev. */
  COOKIE_SECURE: booleanFromEnv(false),
  COOKIE_DOMAIN: z.string().optional(),
  /** Base URL used to build links in outbound email. */
  CONSOLE_URL: z.string().default('http://localhost:9999'),

  // ---- Operational tuning ----------------------------------------------
  HEALTH_PROBE_TIMEOUT_MS: z.coerce.number().int().positive().default(2_000),
  SHUTDOWN_GRACE_MS: z.coerce.number().int().nonnegative().default(10_000),
  /** Default statement timeout for tenant-scoped transactions. */
  DB_TRANSACTION_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
});

export type Env = Readonly<z.infer<typeof envSchema>>;

/** Thrown when the process is started with configuration it cannot honour. */
export class EnvironmentValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(
      [
        `Invalid environment configuration (${issues.length} problem${issues.length === 1 ? '' : 's'}):`,
        ...issues.map((issue) => `  - ${issue}`),
        '',
        'Copy .env.example to .env and fill in the missing values.',
      ].join('\n'),
    );
    this.name = 'EnvironmentValidationError';
  }
}

/**
 * Validates and freezes process configuration. Call once, at process start.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const issues = result.error.issues.map((issue) => {
      const key = issue.path.join('.') || '(root)';
      return `${key}: ${issue.message}`;
    });
    throw new EnvironmentValidationError(issues);
  }

  return Object.freeze(result.data);
}

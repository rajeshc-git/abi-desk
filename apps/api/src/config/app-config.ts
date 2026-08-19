import { Injectable } from '@nestjs/common';
import { type Env } from './env.schema';

/**
 * Typed, grouped view over validated environment configuration.
 *
 * Services inject `AppConfig` instead of touching `process.env`, so
 * configuration is discoverable, mockable in tests, and impossible to typo.
 */
@Injectable()
export class AppConfig {
  constructor(private readonly env: Env) {}

  get raw(): Env {
    return this.env;
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get app() {
    return {
      name: this.env.APP_NAME,
      version: this.env.APP_VERSION,
      nodeEnv: this.env.NODE_ENV,
      processRole: this.env.PROCESS_ROLE,
    } as const;
  }

  get http() {
    return {
      host: this.env.HOST,
      port: this.env.PORT,
      prefix: this.env.API_PREFIX,
      bodyLimitBytes: this.env.HTTP_BODY_LIMIT_BYTES,
      trustProxy: this.env.TRUST_PROXY,
      corsOrigins: this.env.CORS_ORIGINS,
    } as const;
  }

  get logging() {
    return {
      level: this.env.LOG_LEVEL,
      pretty: this.env.LOG_PRETTY,
    } as const;
  }

  get database() {
    return {
      url: this.env.DATABASE_URL,
      migrationUrl: this.env.MIGRATION_DATABASE_URL,
      logQueries: this.env.DATABASE_LOG_QUERIES,
    } as const;
  }

  get redis() {
    return { url: this.env.REDIS_URL } as const;
  }

  get storage() {
    return {
      endpoint: this.env.S3_ENDPOINT,
      /** Host to sign browser-facing URLs with. Falls back to the internal endpoint. */
      publicEndpoint: this.env.S3_PUBLIC_ENDPOINT ?? this.env.S3_ENDPOINT,
      region: this.env.S3_REGION,
      bucket: this.env.S3_BUCKET,
      accessKeyId: this.env.S3_ACCESS_KEY_ID,
      secretAccessKey: this.env.S3_SECRET_ACCESS_KEY,
      forcePathStyle: this.env.S3_FORCE_PATH_STYLE,
    } as const;
  }

  get mail() {
    return {
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_SECURE,
      user: this.env.SMTP_USER,
      password: this.env.SMTP_PASSWORD,
      from: this.env.MAIL_FROM,
    } as const;
  }

  get auth() {
    return {
      accessSecret: this.env.JWT_ACCESS_SECRET,
      refreshSecret: this.env.JWT_REFRESH_SECRET,
      /** Seconds. */
      accessTtl: this.env.JWT_ACCESS_TTL,
      /** Seconds. */
      refreshTtl: this.env.JWT_REFRESH_TTL,
      issuer: this.env.JWT_ISSUER,
      maxFailedLogins: this.env.AUTH_MAX_FAILED_LOGINS,
      lockoutMinutes: this.env.AUTH_LOCKOUT_MINUTES,
      magicLinkTtlMinutes: this.env.AUTH_MAGIC_LINK_TTL_MINUTES,
      passwordResetTtlMinutes: this.env.AUTH_PASSWORD_RESET_TTL_MINUTES,
      invitationTtlDays: this.env.AUTH_INVITATION_TTL_DAYS,
      passwordMinLength: this.env.AUTH_PASSWORD_MIN_LENGTH,
    } as const;
  }

  get cookies() {
    return {
      secure: this.env.COOKIE_SECURE,
      domain: this.env.COOKIE_DOMAIN,
    } as const;
  }

  get urls() {
    return {
      console: this.env.CONSOLE_URL.replace(/\/+$/, ''),
    } as const;
  }

  get ops() {
    return {
      healthProbeTimeoutMs: this.env.HEALTH_PROBE_TIMEOUT_MS,
      shutdownGraceMs: this.env.SHUTDOWN_GRACE_MS,
      dbTransactionTimeoutMs: this.env.DB_TRANSACTION_TIMEOUT_MS,
    } as const;
  }

  /**
   * Decoded application encryption key.
   *
   * Returned as a Buffer so callers cannot accidentally pass the base64 string to
   * a cipher, which would silently use the wrong key material.
   */
  get encryptionKey(): Buffer {
    return Buffer.from(this.env.APP_ENCRYPTION_KEY, 'base64');
  }
}

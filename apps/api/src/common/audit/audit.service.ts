import { Inject, Injectable } from '@nestjs/common';
import { type ActorType, type Prisma } from '@abi-desk/db';
import { type Logger } from 'pino';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { getTenantContext } from '../../infra/tenancy/tenant-context';
import { PINO_LOGGER } from '../logging/logging.module';

/**
 * Field-level change, as stored in `audit_log.changes`.
 *
 * Recording both sides is what makes an entry useful months later: "priority was
 * changed" answers nothing, "priority went from NORMAL to CRITICAL" answers the
 * question being asked.
 */
export interface AuditChange {
  from: unknown;
  to: unknown;
}

export interface AuditEntry {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  tenantId?: string | null;
  actorId?: string | null;
  actorType?: ActorType;
  actorEmail?: string | null;
  actorLabel?: string | null;
  changes?: Record<string, AuditChange> | Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
  apiKeyId?: string | null;
  /** False for denied attempts. Those are the entries a security review wants. */
  succeeded?: boolean;
  failureCode?: string | null;
}

/**
 * Field names whose values must never reach the audit log.
 *
 * The audit trail is widely readable (any Tenant Admin holding `audit:read`) and is
 * retained for years, so it is the last place a secret should end up. Diffing a user
 * or credential record would otherwise capture exactly that.
 */
const REDACTED_FIELDS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'secret',
  'clientsecret',
  'clientsecretencrypted',
  'signingsecretencrypted',
  'secretencrypted',
  'credentialsencrypted',
  'mfasecretencrypted',
  'apikey',
  'keyhash',
  'authorization',
  'cookie',
]);

@Injectable()
export class AuditService {
  private readonly logger: Logger;

  constructor(
    private readonly prisma: TenantPrismaService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'AuditService' });
  }

  /**
   * Writes an audit entry.
   *
   * Never throws. An audit write failing must not roll back the business operation
   * that succeeded - but it is logged at error level, because a silently broken audit
   * trail is a compliance problem and should page someone.
   *
   * The database enforces immutability: a trigger rejects UPDATE outright and DELETE
   * unless a retention purge announces itself. Application code cannot rewrite
   * history even if it tries.
   */
  async record(entry: AuditEntry): Promise<void> {
    const context = getTenantContext();

    try {
      await this.prisma.client.auditLog.create({
        data: {
          tenantId: entry.tenantId ?? context?.tenantId ?? null,
          actorId: entry.actorId ?? context?.userId ?? null,
          actorType: entry.actorType ?? 'USER',
          actorEmail: entry.actorEmail ?? null,
          actorLabel: entry.actorLabel ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId ?? null,
          resourceLabel: entry.resourceLabel ?? null,
          ...(entry.changes
            ? { changes: redactChanges(entry.changes) as Prisma.InputJsonValue }
            : {}),
          ipAddress: entry.ipAddress ?? null,
          userAgent: entry.userAgent?.slice(0, 512) ?? null,
          requestId: entry.requestId ?? context?.requestId ?? null,
          apiKeyId: entry.apiKeyId ?? context?.apiKeyId ?? null,
          succeeded: entry.succeeded ?? true,
          failureCode: entry.failureCode ?? null,
        },
      });
    } catch (error: unknown) {
      this.logger.error(
        { err: error, action: entry.action, resourceType: entry.resourceType },
        'Failed to write audit entry',
      );
    }
  }

  /**
   * Records a denied attempt.
   *
   * Successful actions tell you what happened; refused ones tell you what someone
   * tried. The second set is usually the more interesting half of a security review,
   * and it is the half most systems throw away.
   */
  async recordDenial(
    entry: Omit<AuditEntry, 'succeeded'> & { failureCode: string },
  ): Promise<void> {
    await this.record({ ...entry, succeeded: false });
  }

  /**
   * Builds a change map from a before/after pair, keeping only fields that moved.
   *
   * Storing unchanged fields would bury the one that mattered.
   */
  diff<T extends Record<string, unknown>>(
    before: T | null | undefined,
    after: T | null | undefined,
    fields: ReadonlyArray<keyof T & string>,
  ): Record<string, AuditChange> {
    const changes: Record<string, AuditChange> = {};

    for (const field of fields) {
      const from = before?.[field];
      const to = after?.[field];

      if (!equivalent(from, to)) {
        changes[field] = { from: normalize(from), to: normalize(to) };
      }
    }

    return changes;
  }
}

/** Dates compare by instant, not identity; everything else by JSON shape. */
function equivalent(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a === b) return true;
  if (a === null || a === undefined || b === null || b === undefined) return false;

  if (typeof a === 'object' && typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  return false;
}

/** Renders values into something JSON-safe and human-readable. */
function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (typeof value === 'bigint') return value.toString();
  return value;
}

/** Replaces the value of any sensitive field with a marker, at any depth. */
function redactChanges(changes: unknown): unknown {
  if (Array.isArray(changes)) return changes.map(redactChanges);

  if (changes && typeof changes === 'object') {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(changes as Record<string, unknown>)) {
      result[key] = REDACTED_FIELDS.has(key.toLowerCase()) ? '[redacted]' : redactChanges(value);
    }

    return result;
  }

  return changes;
}

import { Injectable, type OnModuleInit } from '@nestjs/common';
import { type Prisma } from '@abi-desk/db';
import { AppException } from '../../common/errors/app-exception';
import { ErrorCode } from '../../common/errors/error-codes';
import { PrismaService } from '../prisma/prisma.service';
import { getTenantContext, tenantContextStorage } from './tenant-context';

/** The transaction-bound client handed to `run()` callbacks. */
export type TenantTransaction = Prisma.TransactionClient;

/**
 * Scoped client surface. Deliberately typed as Prisma's transaction client: it
 * exposes every model delegate plus the raw escape hatches, and omits
 * `$transaction` and `$connect`, which callers must not reach for here.
 */
export type TenantScopedClient = Prisma.TransactionClient;

export interface RunOptions {
  timeoutMs?: number;
  maxWaitMs?: number;
  isolationLevel?: Prisma.TransactionIsolationLevel;
}

/**
 * The database entry point for application code.
 *
 * Both members below are equally tenant-safe; the choice between them is about
 * atomicity:
 *
 *   `client`  - single operations. Each is batched with its `set_config` into one
 *               transaction and one network round trip. Right for reads.
 *
 *   `run(fn)` - one interactive transaction for the whole callback, tenant context
 *               applied once. Right for anything that writes, because a ticket
 *               transition touches the ticket, its timeline, its SLA clocks and the
 *               outbox, and those have to commit or fail together.
 *
 * ## Why `set_config(..., true)` rather than a `WHERE` clause
 *
 * `set_config('app.tenant_id', $1, true)` is the function form of `SET LOCAL`: the
 * value lives for the surrounding transaction only, so it cannot leak onto the
 * next request that borrows the same pooled connection. PostgreSQL's Row Level
 * Security policies read it and do the filtering. The application therefore
 * *cannot* forget a tenant filter - the worst it can do is fail to supply a tenant,
 * in which case policies compare against NULL and no rows are visible.
 *
 * ## Why this is not a Prisma client extension
 *
 * An earlier version used `$extends({ query: { $allModels: { $allOperations } } })`,
 * which is the pattern Prisma's own RLS guidance suggests. It silently returned
 * zero rows: the lazily-built promise handed to `query(args)` did not end up inside
 * the transaction that carried the `set_config`. Building the operation from the
 * base client and batching the two explicitly is both provable and one round trip,
 * so it is what runs here.
 */
@Injectable()
export class TenantPrismaService implements OnModuleInit {
  private scopedClient!: TenantScopedClient;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.scopedClient = this.buildScopedClient();
  }

  /** Tenant-scoped client for single-statement work. */
  get client(): TenantScopedClient {
    // Also built lazily so unit tests can use the service without Nest lifecycle.
    this.scopedClient ??= this.buildScopedClient();
    return this.scopedClient;
  }

  /**
   * Unscoped client. Reserved for health probes and administrative maintenance
   * that has no tenant, and named to make a code reviewer stop and look.
   */
  get unsafeRawClient(): PrismaService {
    return this.prisma;
  }

  /**
   * Runs `fn` inside a single transaction with tenant context applied once.
   */
  async run<T>(fn: (tx: TenantTransaction) => Promise<T>, options: RunOptions = {}): Promise<T> {
    const context = getTenantContext();

    if (!context) {
      throw new AppException(
        ErrorCode.TENANT_CONTEXT_MISSING,
        500,
        'A tenant-scoped transaction was started without an established context.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        await this.applySessionScope(tx, context.bypassRls, context.tenantId);

        // Marks the context so that reaching for `client` inside this callback
        // fails loudly. Without the flag such a query would run on a different
        // connection - one with no tenant context - and quietly return nothing.
        return tenantContextStorage.run({ ...context, insideScopedTransaction: true }, () =>
          fn(tx),
        );
      },
      {
        timeout: options.timeoutMs ?? 15_000,
        maxWait: options.maxWaitMs ?? 5_000,
        ...(options.isolationLevel ? { isolationLevel: options.isolationLevel } : {}),
      },
    );
  }

  /**
   * Runs `fn` in a transaction permitted to delete audit rows.
   *
   * The audit log's trigger refuses DELETE unless `app.retention_purge` is set, so
   * a lawful purge has to announce itself. This method is the only place in the
   * codebase that makes that announcement.
   */
  async runRetentionPurge<T>(
    fn: (tx: TenantTransaction) => Promise<T>,
    options: RunOptions = {},
  ): Promise<T> {
    const context = getTenantContext();

    if (!context) {
      throw new AppException(
        ErrorCode.TENANT_CONTEXT_MISSING,
        500,
        'A retention purge was started without an established context.',
      );
    }

    return this.prisma.$transaction(
      async (tx) => {
        await this.applySessionScope(tx, context.bypassRls, context.tenantId);
        await tx.$executeRaw`SELECT set_config('app.retention_purge', 'on', true)`;

        return tenantContextStorage.run({ ...context, insideScopedTransaction: true }, () =>
          fn(tx),
        );
      },
      { timeout: options.timeoutMs ?? 60_000, maxWait: options.maxWaitMs ?? 5_000 },
    );
  }

  /**
   * Allocates the next human-readable ticket number for a tenant.
   *
   * Delegates to `app.next_ticket_sequence`, which uses `INSERT ... ON CONFLICT DO
   * UPDATE ... RETURNING`: concurrent callers serialize on the row lock, so no two
   * ever receive the same number. `MAX(sequence) + 1` would hand out duplicates.
   */
  async nextTicketSequence(tx: TenantTransaction, tenantId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ next_ticket_sequence: number }>>`
      SELECT app.next_ticket_sequence(${tenantId}::uuid)
    `;

    const value = rows[0]?.next_ticket_sequence;

    if (typeof value !== 'number') {
      throw new Error(`Ticket sequence allocation returned no value for tenant ${tenantId}.`);
    }

    return value;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private async applySessionScope(
    tx: TenantTransaction,
    bypass: boolean,
    tenantId: string | null,
  ): Promise<void> {
    if (bypass) {
      await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      return;
    }

    if (tenantId) {
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    }
    // Neither set: RLS compares against NULL, so no tenant rows are visible. That
    // is the intended outcome, not an oversight.
  }

  /**
   * Builds a proxy whose every operation is batched with its tenant `set_config`.
   *
   * Prisma model calls return a *lazy* `PrismaPromise`, which is what makes this
   * work: the operation is constructed but not executed, then handed to the array
   * form of `$transaction` alongside the `set_config`. Both statements travel in
   * one batch, guaranteed to be on the same connection and in that order.
   */
  private buildScopedClient(): TenantScopedClient {
    const base = this.prisma as unknown as Record<string, unknown>;

    const scopeOperation = (
      label: string,
      build: (client: any) => Prisma.PrismaPromise<unknown>,
    ): Promise<unknown> => this.executeScoped(label, build);

    return new Proxy({} as TenantScopedClient, {
      get: (_target, property) => {
        if (typeof property !== 'string') return undefined;

        // Guard against the proxy being mistaken for a promise by `await`.
        if (property === 'then' || property === 'catch' || property === 'finally') {
          return undefined;
        }

        // Raw escape hatches: $queryRaw, $executeRaw, $queryRawUnsafe, ...
        if (property.startsWith('$')) {
          return (...args: unknown[]) =>
            scopeOperation(property, (client) => {
              const raw = (client as unknown as Record<string, unknown>)[property];
              if (typeof raw !== 'function') return undefined as any;
              return (raw as (...a: unknown[]) => Prisma.PrismaPromise<unknown>).apply(
                client,
                args,
              );
            });
        }

        const delegate = base[property];
        if (delegate === undefined || delegate === null || typeof delegate !== 'object') {
          return undefined;
        }

        // Model delegate: return a proxy over its operations.
        return new Proxy({} as Record<string, unknown>, {
          get: (_delegateTarget, operation) => {
            if (typeof operation !== 'string') return undefined;

            return (...args: unknown[]) =>
              scopeOperation(`${property}.${operation}`, (client) => {
                const delegateOnClient = (client as unknown as Record<string, unknown>)[property];
                if (
                  delegateOnClient === undefined ||
                  delegateOnClient === null ||
                  typeof delegateOnClient !== 'object'
                ) {
                  return undefined as any;
                }
                const method = (delegateOnClient as Record<string, unknown>)[operation];
                if (typeof method !== 'function') return undefined as any;

                return (method as (...a: unknown[]) => Prisma.PrismaPromise<unknown>).apply(
                  delegateOnClient,
                  args,
                );
              });
          },
        });
      },
    });
  }

  private async executeScoped(
    label: string,
    build: (client: any) => Prisma.PrismaPromise<unknown>,
  ): Promise<unknown> {
    const context = getTenantContext();

    if (context?.insideScopedTransaction) {
      throw AppException.internal(
        `${label} used the shared Prisma client inside a scoped transaction. ` +
          'Use the transaction client passed to run() instead.',
        { logContext: { operation: label } },
      );
    }

    // No tenant and no bypass: run unwrapped. Non-tenant tables (the role and
    // permission catalogue) stay readable, and every tenant-scoped table returns
    // nothing because RLS has no tenant to match.
    if (!context || (!context.tenantId && !context.bypassRls)) {
      return build(this.prisma);
    }

    return this.prisma.$transaction(async (tx) => {
      if (context.bypassRls) {
        await tx.$executeRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      } else {
        await tx.$executeRaw`SELECT set_config('app.tenant_id', ${context.tenantId}, true)`;
      }
      return await build(tx);
    });
  }
}

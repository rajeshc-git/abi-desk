import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { AppConfig } from '../../config/app-config';
import { loadEnv } from '../../config/env.schema';
import { PrismaService } from '../prisma/prisma.service';
import { TenantContextService } from './tenant-context.service';
import { TenantPrismaService } from './tenant-prisma.service';

/**
 * Tenant isolation, verified against real PostgreSQL.
 *
 * These assertions are the whole security argument of the platform, so they are
 * deliberately *not* unit tests: mocking Prisma would only prove that the mock
 * behaves as expected. Row Level Security, `SET LOCAL` transaction scoping and the
 * append-only audit trigger are database behaviours, and the only way to know they
 * hold is to ask the database.
 *
 * Requires the seeded stack:
 *   docker compose up -d postgres
 *   pnpm db:deploy:local && pnpm db:seed
 */

// Deterministic ids from the seed (packages/db/prisma/seed/constants.ts).
const ACME = '11111111-1111-1111-1111-111111111111';
const GLOBEX = '22222222-2222-2222-2222-222222222222';

let prisma: PrismaService;
let tenantPrisma: TenantPrismaService;
let contexts: TenantContextService;

beforeAll(async () => {
  const config = new AppConfig(loadEnv(process.env));
  prisma = new PrismaService(config, pino({ level: 'silent' }));
  await prisma.onModuleInit();

  tenantPrisma = new TenantPrismaService(prisma);
  tenantPrisma.onModuleInit();
  contexts = new TenantContextService();

  // Guard against running against an unseeded database, which would make several
  // assertions vacuously true.
  //
  // Note this needs an explicit bypass: a plain count as the runtime role with no
  // tenant context correctly returns 0, which is the behaviour the suite below
  // goes on to assert.
  const seeded = await contexts.runWithBypass('background-job', {}, () =>
    tenantPrisma.client.tenant.count(),
  );

  if (seeded < 2) {
    throw new Error(`Expected at least 2 seeded tenants, found ${seeded}. Run: pnpm db:seed`);
  }
});

afterAll(async () => {
  await prisma.onModuleDestroy();
});

describe('tenant isolation (PostgreSQL RLS)', () => {
  it('returns no tenant rows when no context is established', async () => {
    const visible = await contexts.runWithoutContext(() => tenantPrisma.client.tenant.findMany());

    // Fail-closed: absent tenant context must mean absent data, not all data.
    expect(visible).toHaveLength(0);
  });

  it('scopes reads to the active tenant', async () => {
    const acmeView = await contexts.runWithTenant(ACME, {}, () =>
      tenantPrisma.client.tenant.findMany(),
    );

    expect(acmeView).toHaveLength(1);
    expect(acmeView[0]?.slug).toBe('acme');

    const globexView = await contexts.runWithTenant(GLOBEX, {}, () =>
      tenantPrisma.client.tenant.findMany(),
    );

    expect(globexView).toHaveLength(1);
    expect(globexView[0]?.slug).toBe('globex');
  });

  it('hides another tenant even when its id is supplied explicitly', async () => {
    // The realistic attack: the caller already knows the other tenant's id and
    // asks for it directly. An application-level `where` filter would be bypassed
    // by exactly this.
    const stolen = await contexts.runWithTenant(ACME, {}, () =>
      tenantPrisma.client.tenant.findUnique({ where: { id: GLOBEX } }),
    );

    expect(stolen).toBeNull();
  });

  it('hides another tenant\u2019s child records', async () => {
    const globexUsers = await contexts.runWithTenant(GLOBEX, {}, () =>
      tenantPrisma.client.user.findMany({ select: { email: true } }),
    );
    const acmeUsers = await contexts.runWithTenant(ACME, {}, () =>
      tenantPrisma.client.user.findMany({ select: { email: true } }),
    );

    expect(globexUsers.length).toBeGreaterThan(0);
    expect(acmeUsers.length).toBeGreaterThan(0);

    const globexEmails = new Set(globexUsers.map((u) => u.email));
    const overlap = acmeUsers.filter((u) => globexEmails.has(u.email));

    expect(overlap).toHaveLength(0);
    // Platform staff have a null tenantId and must not be visible to a tenant.
    expect(acmeUsers.map((u) => u.email)).not.toContain('ops@abidesk.example');
  });

  it('refuses to write a row belonging to another tenant', async () => {
    await expect(
      contexts.runWithTenant(ACME, {}, () =>
        tenantPrisma.client.tag.create({
          data: { tenantId: GLOBEX, name: 'smuggled', slug: 'smuggled-probe' },
        }),
      ),
    ).rejects.toThrow();

    // And nothing was left behind.
    const leaked = await contexts.runWithTenant(GLOBEX, {}, () =>
      tenantPrisma.client.tag.findFirst({ where: { slug: 'smuggled-probe' } }),
    );
    expect(leaked).toBeNull();
  });

  it('does not leak context between sequential scopes', async () => {
    await contexts.runWithTenant(ACME, {}, () => tenantPrisma.client.tenant.findMany());

    // A pooled connection previously used by the Acme scope must carry nothing
    // over; this is what `SET LOCAL` buys us over a plain `SET`.
    const afterwards = await contexts.runWithoutContext(() =>
      tenantPrisma.client.tenant.findMany(),
    );

    expect(afterwards).toHaveLength(0);
  });

  it('exposes every tenant under an explicit bypass', async () => {
    const all = await contexts.runWithBypass('platform-admin', {}, () =>
      tenantPrisma.client.tenant.findMany({ select: { slug: true } }),
    );

    const slugs = all.map((t) => t.slug);
    expect(slugs).toContain('acme');
    expect(slugs).toContain('globex');
  });

  it('keeps the non-tenant permission catalogue readable without context', async () => {
    // The role/permission catalogue is global and intentionally carries no RLS;
    // guards must be able to resolve permissions before a tenant is known.
    const permissions = await contexts.runWithoutContext(() =>
      tenantPrisma.client.permission.count(),
    );

    expect(permissions).toBeGreaterThan(0);
  });
});

describe('scoped transactions', () => {
  it('applies tenant context once for the whole transaction', async () => {
    const result = await contexts.runWithTenant(ACME, {}, () =>
      tenantPrisma.run(async (tx) => {
        const tenants = await tx.tenant.findMany({ select: { slug: true } });
        const brands = await tx.brand.findMany({ select: { slug: true } });
        return { tenants, brands };
      }),
    );

    expect(result.tenants.map((t) => t.slug)).toEqual(['acme']);
    // Acme is the multi-brand tenant; Globex's brand must not appear.
    expect(result.brands.map((b) => b.slug).sort()).toEqual(['billing', 'cloud']);
  });

  it('rolls the whole transaction back on failure', async () => {
    const slug = `rollback-probe-${Date.now()}`;

    await expect(
      contexts.runWithTenant(ACME, {}, () =>
        tenantPrisma.run(async (tx) => {
          await tx.tag.create({ data: { tenantId: ACME, name: 'Probe', slug } });
          throw new Error('deliberate failure after a successful write');
        }),
      ),
    ).rejects.toThrow('deliberate failure');

    const survivor = await contexts.runWithTenant(ACME, {}, () =>
      tenantPrisma.client.tag.findFirst({ where: { slug } }),
    );

    expect(survivor).toBeNull();
  });

  it('rejects use of the shared client inside a scoped transaction', async () => {
    // Silently allowing this would send the query to a different connection with
    // no tenant context, and it would return nothing for no visible reason.
    await expect(
      contexts.runWithTenant(ACME, {}, () =>
        tenantPrisma.run(async () => tenantPrisma.client.tenant.findMany()),
      ),
    ).rejects.toThrow(/shared Prisma client inside a scoped transaction/);
  });

  it('refuses to start a scoped transaction with no context', async () => {
    await expect(tenantPrisma.run(async (tx) => tx.tenant.count())).rejects.toThrow(
      /without an established context/,
    );
  });
});

describe('ticket number allocation', () => {
  it('allocates strictly increasing numbers per tenant', async () => {
    const allocate = (tenantId: string) =>
      contexts.runWithTenant(tenantId, {}, () =>
        tenantPrisma.run((tx) => tenantPrisma.nextTicketSequence(tx, tenantId)),
      );

    const first = await allocate(ACME);
    const second = await allocate(ACME);

    expect(second).toBe(first + 1);
  });

  it('keeps sequences independent across tenants', async () => {
    const allocate = (tenantId: string) =>
      contexts.runWithTenant(tenantId, {}, () =>
        tenantPrisma.run((tx) => tenantPrisma.nextTicketSequence(tx, tenantId)),
      );

    const acmeBefore = await allocate(ACME);
    await allocate(GLOBEX);
    const acmeAfter = await allocate(ACME);

    // Globex's allocation must not consume a number from Acme's series.
    expect(acmeAfter).toBe(acmeBefore + 1);
  });

  it('never issues the same number twice under concurrency', async () => {
    // Twenty simultaneous allocations. `MAX(sequence) + 1` would produce
    // duplicates here; the row-locked UPDATE ... RETURNING does not.
    const allocations = await Promise.all(
      Array.from({ length: 20 }, () =>
        contexts.runWithTenant(ACME, {}, () =>
          tenantPrisma.run((tx) => tenantPrisma.nextTicketSequence(tx, ACME)),
        ),
      ),
    );

    expect(new Set(allocations).size).toBe(20);
  });
});

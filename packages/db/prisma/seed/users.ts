import { Algorithm, hash } from '@node-rs/argon2';
import { type PrismaClient, type RoleKey, type UserKind } from '@prisma/client';
import { BRAND_IDS, DEMO_PASSWORD, TEAM_IDS, TENANT_IDS } from './constants';

/**
 * Argon2id parameters.
 *
 * These are the OWASP Password Storage Cheat Sheet recommendations: 19 MiB of
 * memory, 2 iterations, 1 degree of parallelism. Argon2id (rather than 2i or 2d)
 * because it resists both side-channel and GPU-cracking attacks.
 *
 * Memory cost is the parameter that actually matters against custom hardware, and
 * it is the one most often left at a token value.
 */
export const ARGON2_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

interface SeedUser {
  email: string;
  fullName: string;
  jobTitle?: string;
  kind: UserKind;
  roles: RoleKey[];
  tenantId: string | null;
  /** Team membership, and whether they lead it. */
  teams?: Array<{ teamId: string; isLead?: boolean }>;
  /** Restricts the role assignment to one brand (multi-brand tenants). */
  brandId?: string;
  /** Identity as the host application knows them; supplied by the widget handoff. */
  externalId?: string;
  externalMetadata?: Record<string, unknown>;
  timezone?: string;
  maxConcurrentTickets?: number;
}

/**
 * One account per role, so the RBAC matrix can be exercised end to end by logging
 * in rather than by reading code.
 *
 * Two deliberate wrinkles:
 *   - Acme has two L1 agents, because least-loaded routing needs a choice to make.
 *   - Globex's single support engineer holds L1 *and* L2, which is what small
 *     tenants actually do and which catches code that assumes one role per user.
 */
const USERS: SeedUser[] = [
  // ---- Platform (vendor side, no tenant) --------------------------------
  {
    email: 'ops@abidesk.example',
    fullName: 'Priya Deshmukh',
    jobTitle: 'Platform Operations',
    kind: 'STAFF',
    tenantId: null,
    roles: ['PLATFORM_ADMIN'],
  },

  // ---- Acme Cloud -------------------------------------------------------
  {
    email: 'admin@acme.example',
    fullName: 'Marcus Whitlock',
    jobTitle: 'IT Service Manager',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['TENANT_ADMIN'],
    timezone: 'America/New_York',
  },
  {
    email: 'nina.patel@acme.example',
    fullName: 'Nina Patel',
    jobTitle: 'Support Specialist',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['L1_SUPPORT'],
    teams: [{ teamId: TEAM_IDS.acmeFrontline }],
    timezone: 'America/New_York',
    maxConcurrentTickets: 25,
  },
  {
    email: 'tom.reyes@acme.example',
    fullName: 'Tom Reyes',
    jobTitle: 'Support Specialist',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['L1_SUPPORT'],
    teams: [{ teamId: TEAM_IDS.acmeFrontline, isLead: true }],
    timezone: 'America/Chicago',
    maxConcurrentTickets: 25,
  },
  {
    email: 'dana.whitfield@acme.example',
    fullName: 'Dana Whitfield',
    jobTitle: 'Technical Support Engineer',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['L2_SUPPORT'],
    teams: [{ teamId: TEAM_IDS.acmeTechnical, isLead: true }],
    maxConcurrentTickets: 15,
  },
  {
    email: 'ravi.menon@acme.example',
    fullName: 'Ravi Menon',
    jobTitle: 'Product Specialist',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['L3_SUPPORT'],
    teams: [{ teamId: TEAM_IDS.acmeProduct, isLead: true }],
    maxConcurrentTickets: 10,
  },
  {
    // A second product specialist, and not an incidental detail: approval gates name
    // L3_SUPPORT as the approver, and separation of duties forbids approving your own
    // request. With a single L3 the engineering handover could never be signed off by
    // anyone, so the pipeline would deadlock on realistic data.
    email: 'grace.lim@acme.example',
    fullName: 'Grace Lim',
    jobTitle: 'Product Specialist',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['L3_SUPPORT'],
    teams: [{ teamId: TEAM_IDS.acmeProduct }],
    maxConcurrentTickets: 10,
  },
  {
    email: 'sofia.marchetti@acme.example',
    fullName: 'Sofia Marchetti',
    jobTitle: 'Senior Software Engineer',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['DEV_TEAM'],
    teams: [{ teamId: TEAM_IDS.acmeEngineering, isLead: true }],
    maxConcurrentTickets: 8,
  },
  {
    email: 'ben.okafor@acme.example',
    fullName: 'Ben Okafor',
    jobTitle: 'QA Engineer',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['QA_TEAM'],
    teams: [{ teamId: TEAM_IDS.acmeQa, isLead: true }],
    maxConcurrentTickets: 12,
  },
  {
    // Brand-scoped agent: works billing tickets only.
    email: 'lena.hoffman@acme.example',
    fullName: 'Lena Hoffman',
    jobTitle: 'Billing Support',
    kind: 'STAFF',
    tenantId: TENANT_IDS.acme,
    roles: ['L1_SUPPORT'],
    brandId: BRAND_IDS.acmeBilling,
    teams: [{ teamId: TEAM_IDS.acmeFrontline }],
    maxConcurrentTickets: 20,
  },

  // ---- Acme's customers (widget end users) ------------------------------
  {
    email: 'june.carter@northwind.example',
    fullName: 'June Carter',
    jobTitle: 'Operations Lead, Northwind Trading',
    kind: 'CUSTOMER',
    tenantId: TENANT_IDS.acme,
    roles: ['GUEST_CUSTOMER'],
    externalId: 'northwind-user-4471',
    externalMetadata: { plan: 'enterprise', accountId: 'acct_northwind', seats: 240 },
  },
  {
    email: 'felix.brandt@northwind.example',
    fullName: 'Felix Brandt',
    jobTitle: 'Finance Analyst, Northwind Trading',
    kind: 'CUSTOMER',
    tenantId: TENANT_IDS.acme,
    roles: ['GUEST_CUSTOMER'],
    externalId: 'northwind-user-5120',
    externalMetadata: { plan: 'enterprise', accountId: 'acct_northwind', seats: 240 },
  },

  // ---- Globex (trial tenant) -------------------------------------------
  {
    email: 'admin@globex.example',
    fullName: 'Aditi Sharma',
    jobTitle: 'Head of Customer Success',
    kind: 'STAFF',
    tenantId: TENANT_IDS.globex,
    roles: ['TENANT_ADMIN'],
    timezone: 'Asia/Kolkata',
  },
  {
    email: 'support@globex.example',
    fullName: 'Kabir Nair',
    jobTitle: 'Support Engineer',
    kind: 'STAFF',
    tenantId: TENANT_IDS.globex,
    // One person covering two tiers - the small-tenant reality.
    roles: ['L1_SUPPORT', 'L2_SUPPORT'],
    teams: [{ teamId: TEAM_IDS.globexSupport, isLead: true }],
    timezone: 'Asia/Kolkata',
    maxConcurrentTickets: 30,
  },
  {
    email: 'asha.rao@meridian.example',
    fullName: 'Asha Rao',
    jobTitle: 'Data Analyst, Meridian Retail',
    kind: 'CUSTOMER',
    tenantId: TENANT_IDS.globex,
    roles: ['GUEST_CUSTOMER'],
    externalId: 'meridian-user-88',
    externalMetadata: { plan: 'trial', accountId: 'acct_meridian' },
  },
];

export interface SeededUserSummary {
  email: string;
  tenant: string;
  roles: string[];
}

export async function seedUsers(prisma: PrismaClient): Promise<SeededUserSummary[]> {
  const roleIdByKey = new Map(
    (await prisma.role.findMany({ select: { id: true, key: true } })).map((r) => [r.key, r.id]),
  );

  const summaries: SeededUserSummary[] = [];

  for (const seed of USERS) {
    // Hashed per user rather than once and reused: sharing a hash would mean
    // sharing a salt, and demo data should not model a mistake.
    const passwordHash = await hash(DEMO_PASSWORD, ARGON2_OPTIONS);

    // Emails are normalized to lowercase because the uniqueness guarantee is a
    // plain partial index, not a case-insensitive expression index.
    const email = seed.email.toLowerCase();

    const existing = await prisma.user.findFirst({
      where: { email, tenantId: seed.tenantId },
      select: { id: true },
    });

    const data = {
      tenantId: seed.tenantId,
      email,
      fullName: seed.fullName,
      displayName: seed.fullName.split(' ')[0] ?? seed.fullName,
      jobTitle: seed.jobTitle ?? null,
      kind: seed.kind,
      status: 'ACTIVE' as const,
      passwordHash,
      passwordUpdatedAt: new Date(),
      emailVerifiedAt: new Date(),
      timezone: seed.timezone ?? null,
      externalId: seed.externalId ?? null,
      externalMetadata: seed.externalMetadata ?? undefined,
      maxConcurrentTickets: seed.maxConcurrentTickets ?? null,
      isAvailable: seed.kind === 'STAFF',
    };

    const user = existing
      ? await prisma.user.update({ where: { id: existing.id }, data })
      : await prisma.user.create({ data });

    // --- Role assignments ------------------------------------------------
    for (const roleKey of seed.roles) {
      const roleId = roleIdByKey.get(roleKey);
      if (!roleId) throw new Error(`Role ${roleKey} missing; seed authorization first.`);

      const brandId = seed.brandId ?? null;

      // Uniqueness here is enforced by partial indexes (brandId is nullable), so
      // Prisma cannot express the upsert target - find then write.
      const assignment = await prisma.userRole.findFirst({
        where: { userId: user.id, roleId, brandId },
        select: { id: true },
      });

      if (!assignment) {
        await prisma.userRole.create({
          data: { userId: user.id, roleId, brandId, tenantId: seed.tenantId },
        });
      }
    }

    // --- Team membership --------------------------------------------------
    for (const membership of seed.teams ?? []) {
      if (!seed.tenantId) continue;

      await prisma.teamMember.upsert({
        where: { teamId_userId: { teamId: membership.teamId, userId: user.id } },
        update: { isLead: membership.isLead ?? false },
        create: {
          tenantId: seed.tenantId,
          teamId: membership.teamId,
          userId: user.id,
          isLead: membership.isLead ?? false,
        },
      });
    }

    summaries.push({
      email,
      tenant:
        seed.tenantId === TENANT_IDS.acme
          ? 'acme'
          : seed.tenantId === TENANT_IDS.globex
            ? 'globex'
            : 'platform',
      roles: seed.roles,
    });
  }

  return summaries;
}

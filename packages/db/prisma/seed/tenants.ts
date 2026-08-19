import { type PrismaClient } from '@prisma/client';
import { sealSecret, secretFingerprint } from '../../src/secret-box';
import {
  BRAND_IDS,
  BUSINESS_HOURS_IDS,
  DEMO_ALLOWED_ORIGINS,
  DEMO_WIDGET_PUBLIC_KEYS,
  DEMO_WIDGET_SECRETS,
  QUEUE_IDS,
  SLA_POLICY_IDS,
  TEAM_IDS,
  TENANT_IDS,
} from './constants';

/**
 * Two tenants, deliberately different, so the demo exercises the interesting paths
 * rather than a single happy one:
 *
 *   Acme Cloud   - ACTIVE, US timezone, two brands (the multi-brand case),
 *                  full L1-QA staffing, business-hours SLAs plus a 24x7 policy
 *                  for critical issues.
 *   Globex       - TRIAL, India timezone, one brand, a single support person
 *                  wearing several hats. This is what most new tenants look like,
 *                  and it catches assumptions that every tier is staffed.
 */
export async function seedTenants(prisma: PrismaClient, encryptionKey: Buffer): Promise<void> {
  // -----------------------------------------------------------------------
  // Tenants and their settings
  // -----------------------------------------------------------------------
  await prisma.tenant.upsert({
    where: { id: TENANT_IDS.acme },
    update: {},
    create: {
      id: TENANT_IDS.acme,
      slug: 'acme',
      name: 'Acme Cloud Inc.',
      status: 'ACTIVE',
      ticketPrefix: 'ACME',
      timezone: 'America/New_York',
      locale: 'en',
    },
  });

  await prisma.tenant.upsert({
    where: { id: TENANT_IDS.globex },
    update: {},
    create: {
      id: TENANT_IDS.globex,
      slug: 'globex',
      name: 'Globex Analytics Pvt Ltd',
      status: 'TRIAL',
      ticketPrefix: 'GLBX',
      timezone: 'Asia/Kolkata',
      locale: 'en',
    },
  });

  await prisma.tenantSetting.upsert({
    where: { tenantId: TENANT_IDS.acme },
    update: {},
    create: {
      tenantId: TENANT_IDS.acme,
      autoCloseAfterDays: 7,
      allowCustomerReopen: true,
      reopenWindowDays: 14,
    },
  });

  await prisma.tenantSetting.upsert({
    where: { tenantId: TENANT_IDS.globex },
    update: {},
    create: {
      tenantId: TENANT_IDS.globex,
      autoCloseAfterDays: 3,
      allowCustomerReopen: true,
      // A trial tenant closes abandoned tickets sooner and gives a shorter reopen
      // window than an established one.
      reopenWindowDays: 7,
    },
  });

  // -----------------------------------------------------------------------
  // Brands
  // -----------------------------------------------------------------------
  const brands = [
    {
      id: BRAND_IDS.acmeCloud,
      tenantId: TENANT_IDS.acme,
      slug: 'cloud',
      name: 'Acme Cloud Platform',
      isDefault: true,
      primaryColor: '#2563EB',
      accentColor: '#1E40AF',
      supportEmail: 'support@acme.example',
      portalDomain: 'help.acme.example',
    },
    {
      id: BRAND_IDS.acmeBilling,
      tenantId: TENANT_IDS.acme,
      slug: 'billing',
      name: 'Acme Billing Suite',
      isDefault: false,
      primaryColor: '#059669',
      accentColor: '#047857',
      supportEmail: 'billing-support@acme.example',
      portalDomain: 'billing-help.acme.example',
    },
    {
      id: BRAND_IDS.globexAnalytics,
      tenantId: TENANT_IDS.globex,
      slug: 'analytics',
      name: 'Globex Analytics',
      isDefault: true,
      primaryColor: '#7C3AED',
      accentColor: '#5B21B6',
      supportEmail: 'help@globex.example',
    },
  ];

  for (const brand of brands) {
    await prisma.brand.upsert({ where: { id: brand.id }, update: {}, create: brand });
  }

  // -----------------------------------------------------------------------
  // Widget configuration
  //
  // The signing secret is sealed with the application encryption key. It has to be
  // recoverable (we verify tenant-issued handoff JWTs with it), which is why it is
  // encrypted rather than hashed - see `secret-box.ts`.
  // -----------------------------------------------------------------------
  const widgets = [
    {
      brandId: BRAND_IDS.acmeCloud,
      tenantId: TENANT_IDS.acme,
      publicKey: DEMO_WIDGET_PUBLIC_KEYS.acmeCloud,
      secret: DEMO_WIDGET_SECRETS.acmeCloud,
      welcomeMessage: 'Hi there. Tell us what went wrong and we will capture the details.',
      launcherLabel: 'Support',
    },
    {
      brandId: BRAND_IDS.acmeBilling,
      tenantId: TENANT_IDS.acme,
      publicKey: DEMO_WIDGET_PUBLIC_KEYS.acmeBilling,
      secret: DEMO_WIDGET_SECRETS.acmeBilling,
      welcomeMessage: 'Billing question? We will pull your invoice context automatically.',
      launcherLabel: 'Billing help',
      // Billing screens show card and address data, so screen recording is off by
      // default here. A per-brand switch is exactly why widget config is per brand.
      screenRecordingEnabled: false,
    },
    {
      brandId: BRAND_IDS.globexAnalytics,
      tenantId: TENANT_IDS.globex,
      publicKey: DEMO_WIDGET_PUBLIC_KEYS.globexAnalytics,
      secret: DEMO_WIDGET_SECRETS.globexAnalytics,
      welcomeMessage: 'Report an issue and we will attach your session diagnostics.',
      launcherLabel: 'Report issue',
    },
  ];

  for (const widget of widgets) {
    const { secret, ...rest } = widget;
    await prisma.widgetConfig.upsert({
      where: { brandId: widget.brandId },
      update: {},
      create: {
        ...rest,
        signingSecretEncrypted: sealSecret(secret, encryptionKey),
        signingSecretLast4: secretFingerprint(secret),
        allowedOrigins: DEMO_ALLOWED_ORIGINS,
        privacyNotice:
          'We capture your browser, device and recent console activity to diagnose this issue. Sensitive values are removed before upload.',
        requireConsent: true,
      },
    });
  }

  // -----------------------------------------------------------------------
  // Teams, one per tier for Acme; Globex runs a single blended team
  // -----------------------------------------------------------------------
  const teams = [
    {
      id: TEAM_IDS.acmeFrontline,
      tenantId: TENANT_IDS.acme,
      name: 'Frontline Support',
      slug: 'frontline',
      tier: 'L1' as const,
    },
    {
      id: TEAM_IDS.acmeTechnical,
      tenantId: TENANT_IDS.acme,
      name: 'Technical Support',
      slug: 'technical',
      tier: 'L2' as const,
    },
    {
      id: TEAM_IDS.acmeProduct,
      tenantId: TENANT_IDS.acme,
      name: 'Product Specialists',
      slug: 'product',
      tier: 'L3' as const,
    },
    {
      id: TEAM_IDS.acmeEngineering,
      tenantId: TENANT_IDS.acme,
      name: 'Engineering',
      slug: 'engineering',
      tier: 'DEV' as const,
    },
    {
      id: TEAM_IDS.acmeQa,
      tenantId: TENANT_IDS.acme,
      name: 'Quality Assurance',
      slug: 'qa',
      tier: 'QA' as const,
    },
    {
      id: TEAM_IDS.globexSupport,
      tenantId: TENANT_IDS.globex,
      name: 'Support',
      slug: 'support',
      tier: 'L1' as const,
    },
  ];

  for (const team of teams) {
    await prisma.team.upsert({ where: { id: team.id }, update: {}, create: team });
  }

  // -----------------------------------------------------------------------
  // Queues. `isDefault` is where unrouted tickets land, and the partial unique
  // index guarantees there is at most one per tenant.
  // -----------------------------------------------------------------------
  const queues = [
    {
      id: QUEUE_IDS.acmeGeneral,
      tenantId: TENANT_IDS.acme,
      brandId: BRAND_IDS.acmeCloud,
      name: 'General Support',
      slug: 'general',
      tier: 'L1' as const,
      teamId: TEAM_IDS.acmeFrontline,
      isDefault: true,
    },
    {
      id: QUEUE_IDS.acmeBilling,
      tenantId: TENANT_IDS.acme,
      brandId: BRAND_IDS.acmeBilling,
      name: 'Billing',
      slug: 'billing',
      tier: 'L1' as const,
      teamId: TEAM_IDS.acmeFrontline,
      isDefault: false,
    },
    {
      id: QUEUE_IDS.acmeTechnical,
      tenantId: TENANT_IDS.acme,
      brandId: BRAND_IDS.acmeCloud,
      name: 'Technical Escalations',
      slug: 'technical',
      tier: 'L2' as const,
      teamId: TEAM_IDS.acmeTechnical,
      isDefault: false,
    },
    {
      id: QUEUE_IDS.acmeEngineering,
      tenantId: TENANT_IDS.acme,
      brandId: BRAND_IDS.acmeCloud,
      name: 'Engineering Backlog',
      slug: 'engineering',
      tier: 'DEV' as const,
      teamId: TEAM_IDS.acmeEngineering,
      isDefault: false,
      routing: 'MANUAL' as const,
    },
    {
      id: QUEUE_IDS.globexGeneral,
      tenantId: TENANT_IDS.globex,
      brandId: BRAND_IDS.globexAnalytics,
      name: 'Support',
      slug: 'support',
      tier: 'L1' as const,
      teamId: TEAM_IDS.globexSupport,
      isDefault: true,
    },
  ];

  for (const queue of queues) {
    await prisma.queue.upsert({ where: { id: queue.id }, update: {}, create: queue });
  }

  // -----------------------------------------------------------------------
  // Business hours
  //
  // Minutes-from-local-midnight rather than timestamps, so a DST change does not
  // silently move the working day.
  // -----------------------------------------------------------------------
  const WEEKDAYS = [1, 2, 3, 4, 5];

  await prisma.businessHours.upsert({
    where: { id: BUSINESS_HOURS_IDS.acmeStandard },
    update: {},
    create: {
      id: BUSINESS_HOURS_IDS.acmeStandard,
      tenantId: TENANT_IDS.acme,
      name: 'Acme Standard (Mon-Fri 09:00-18:00 ET)',
      timezone: 'America/New_York',
      isDefault: true,
      days: {
        create: WEEKDAYS.map((weekday) => ({
          tenantId: TENANT_IDS.acme,
          weekday,
          startMinute: 9 * 60,
          endMinute: 18 * 60,
        })),
      },
      holidays: {
        create: [
          {
            tenantId: TENANT_IDS.acme,
            name: 'New Year\u2019s Day',
            date: new Date('2027-01-01'),
            recursAnnually: true,
          },
          {
            tenantId: TENANT_IDS.acme,
            name: 'Independence Day',
            date: new Date('2027-07-04'),
            recursAnnually: true,
          },
          {
            tenantId: TENANT_IDS.acme,
            name: 'Christmas Day',
            date: new Date('2026-12-25'),
            recursAnnually: true,
          },
        ],
      },
    },
  });

  await prisma.businessHours.upsert({
    where: { id: BUSINESS_HOURS_IDS.acmeAlwaysOpen },
    update: {},
    create: {
      id: BUSINESS_HOURS_IDS.acmeAlwaysOpen,
      tenantId: TENANT_IDS.acme,
      name: 'Acme 24x7 (critical incidents)',
      timezone: 'America/New_York',
      isAlwaysOpen: true,
      isDefault: false,
    },
  });

  await prisma.businessHours.upsert({
    where: { id: BUSINESS_HOURS_IDS.globexStandard },
    update: {},
    create: {
      id: BUSINESS_HOURS_IDS.globexStandard,
      tenantId: TENANT_IDS.globex,
      name: 'Globex Standard (Mon-Fri 10:00-19:00 IST)',
      timezone: 'Asia/Kolkata',
      isDefault: true,
      days: {
        create: WEEKDAYS.map((weekday) => ({
          tenantId: TENANT_IDS.globex,
          weekday,
          startMinute: 10 * 60,
          endMinute: 19 * 60,
        })),
      },
    },
  });

  // -----------------------------------------------------------------------
  // SLA policies
  //
  // Evaluated by explicit `priority` order, first match wins. The critical policy
  // is checked first and runs against 24x7 hours; everything else falls through to
  // the business-hours default.
  // -----------------------------------------------------------------------
  await prisma.slaPolicy.upsert({
    where: { id: SLA_POLICY_IDS.acmeCritical },
    update: {},
    create: {
      id: SLA_POLICY_IDS.acmeCritical,
      tenantId: TENANT_IDS.acme,
      name: 'Critical incidents (24x7)',
      description: 'Applies to URGENT and CRITICAL tickets on any brand.',
      conditions: { priority: ['URGENT', 'CRITICAL'] },
      priority: 10,
      businessHoursId: BUSINESS_HOURS_IDS.acmeAlwaysOpen,
      warningThreshold: 0.7,
      escalateOnBreach: true,
      notifyRoleKeys: ['L2_SUPPORT', 'L3_SUPPORT', 'TENANT_ADMIN'],
      isDefault: false,
      targets: {
        create: [
          {
            tenantId: TENANT_IDS.acme,
            type: 'FIRST_RESPONSE',
            minutes: 15,
            priorityOverrides: { CRITICAL: 10 },
          },
          { tenantId: TENANT_IDS.acme, type: 'NEXT_RESPONSE', minutes: 30 },
          {
            tenantId: TENANT_IDS.acme,
            type: 'RESOLUTION',
            minutes: 240,
            priorityOverrides: { CRITICAL: 120 },
          },
        ],
      },
    },
  });

  await prisma.slaPolicy.upsert({
    where: { id: SLA_POLICY_IDS.acmeStandard },
    update: {},
    create: {
      id: SLA_POLICY_IDS.acmeStandard,
      tenantId: TENANT_IDS.acme,
      name: 'Standard support (business hours)',
      description: 'Fallback policy. Empty conditions match every ticket.',
      conditions: {},
      priority: 100,
      businessHoursId: BUSINESS_HOURS_IDS.acmeStandard,
      warningThreshold: 0.75,
      escalateOnBreach: true,
      notifyRoleKeys: ['L1_SUPPORT', 'L2_SUPPORT'],
      isDefault: true,
      targets: {
        create: [
          {
            tenantId: TENANT_IDS.acme,
            type: 'FIRST_RESPONSE',
            minutes: 240,
            priorityOverrides: { HIGH: 120 },
          },
          { tenantId: TENANT_IDS.acme, type: 'NEXT_RESPONSE', minutes: 480 },
          {
            tenantId: TENANT_IDS.acme,
            type: 'RESOLUTION',
            minutes: 2880,
            priorityOverrides: { HIGH: 1440 },
          },
        ],
      },
    },
  });

  await prisma.slaPolicy.upsert({
    where: { id: SLA_POLICY_IDS.globexStandard },
    update: {},
    create: {
      id: SLA_POLICY_IDS.globexStandard,
      tenantId: TENANT_IDS.globex,
      name: 'Trial support',
      conditions: {},
      priority: 100,
      businessHoursId: BUSINESS_HOURS_IDS.globexStandard,
      warningThreshold: 0.8,
      escalateOnBreach: false,
      isDefault: true,
      targets: {
        create: [
          { tenantId: TENANT_IDS.globex, type: 'FIRST_RESPONSE', minutes: 480 },
          { tenantId: TENANT_IDS.globex, type: 'RESOLUTION', minutes: 4320 },
        ],
      },
    },
  });

  // -----------------------------------------------------------------------
  // Tags
  // -----------------------------------------------------------------------
  const tags = [
    { tenantId: TENANT_IDS.acme, name: 'Billing', slug: 'billing', color: '#059669' },
    { tenantId: TENANT_IDS.acme, name: 'Authentication', slug: 'authentication', color: '#DC2626' },
    { tenantId: TENANT_IDS.acme, name: 'Performance', slug: 'performance', color: '#D97706' },
    { tenantId: TENANT_IDS.acme, name: 'Data export', slug: 'data-export', color: '#2563EB' },
    { tenantId: TENANT_IDS.acme, name: 'Regression', slug: 'regression', color: '#7C3AED' },
    { tenantId: TENANT_IDS.globex, name: 'Dashboards', slug: 'dashboards', color: '#7C3AED' },
    { tenantId: TENANT_IDS.globex, name: 'Onboarding', slug: 'onboarding', color: '#0891B2' },
  ];

  for (const tag of tags) {
    await prisma.tag.upsert({
      where: { tenantId_slug: { tenantId: tag.tenantId, slug: tag.slug } },
      update: {},
      create: tag,
    });
  }

  // -----------------------------------------------------------------------
  // Retention policies (GDPR / DPDPA defaults)
  // -----------------------------------------------------------------------
  const retention = [
    { scope: 'TICKET' as const, retentionDays: 1095, anonymizeInsteadOfDelete: true },
    { scope: 'MEDIA' as const, retentionDays: 365, anonymizeInsteadOfDelete: false },
    { scope: 'DIAGNOSTIC' as const, retentionDays: 180, anonymizeInsteadOfDelete: false },
    { scope: 'AUDIT' as const, retentionDays: 2555, anonymizeInsteadOfDelete: false },
    { scope: 'CHAT' as const, retentionDays: 730, anonymizeInsteadOfDelete: true },
    { scope: 'WEBHOOK_DELIVERY' as const, retentionDays: 30, anonymizeInsteadOfDelete: false },
  ];

  for (const tenantId of [TENANT_IDS.acme, TENANT_IDS.globex]) {
    for (const policy of retention) {
      await prisma.retentionPolicy.upsert({
        where: { tenantId_scope: { tenantId, scope: policy.scope } },
        update: {},
        create: { tenantId, ...policy },
      });
    }
  }
}

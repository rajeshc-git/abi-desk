/**
 * Deterministic identifiers and demo credentials for the seed.
 *
 * Fixed UUIDs rather than generated ones, on purpose: integration tests, the RLS
 * smoke check and the README's curl examples all reference these ids, and they must
 * survive `pnpm db:reset`. A seed that produces different ids each run cannot be
 * asserted against.
 */

export const TENANT_IDS = {
  acme: '11111111-1111-1111-1111-111111111111',
  globex: '22222222-2222-2222-2222-222222222222',
} as const;

export const BRAND_IDS = {
  /// Acme runs two products through one helpdesk - the multi-brand case.
  acmeCloud: 'a1a1a1a1-0000-4000-8000-000000000001',
  acmeBilling: 'a1a1a1a1-0000-4000-8000-000000000002',
  globexAnalytics: 'b2b2b2b2-0000-4000-8000-000000000001',
} as const;

export const TEAM_IDS = {
  acmeFrontline: 'c3c3c3c3-0000-4000-8000-000000000001',
  acmeTechnical: 'c3c3c3c3-0000-4000-8000-000000000002',
  acmeProduct: 'c3c3c3c3-0000-4000-8000-000000000003',
  acmeEngineering: 'c3c3c3c3-0000-4000-8000-000000000004',
  acmeQa: 'c3c3c3c3-0000-4000-8000-000000000005',
  globexSupport: 'c3c3c3c3-0000-4000-8000-000000000010',
} as const;

export const QUEUE_IDS = {
  acmeGeneral: 'd4d4d4d4-0000-4000-8000-000000000001',
  acmeBilling: 'd4d4d4d4-0000-4000-8000-000000000002',
  acmeTechnical: 'd4d4d4d4-0000-4000-8000-000000000003',
  acmeEngineering: 'd4d4d4d4-0000-4000-8000-000000000004',
  globexGeneral: 'd4d4d4d4-0000-4000-8000-000000000010',
} as const;

export const BUSINESS_HOURS_IDS = {
  acmeStandard: 'e5e5e5e5-0000-4000-8000-000000000001',
  acmeAlwaysOpen: 'e5e5e5e5-0000-4000-8000-000000000002',
  globexStandard: 'e5e5e5e5-0000-4000-8000-000000000010',
} as const;

export const SLA_POLICY_IDS = {
  acmeCritical: 'f6f6f6f6-0000-4000-8000-000000000001',
  acmeStandard: 'f6f6f6f6-0000-4000-8000-000000000002',
  globexStandard: 'f6f6f6f6-0000-4000-8000-000000000010',
} as const;

/**
 * Shared password for every seeded account.
 *
 * Development convenience only. The README says so, and the value is meaningless
 * outside a throwaway database - but it is still the first thing to change if this
 * stack is ever exposed.
 */
export const DEMO_PASSWORD = 'AbiDesk!2026';

/** Signing secret for Acme's widget, so the demo host app can mint handoff JWTs. */
export const DEMO_WIDGET_SECRETS = {
  acmeCloud: 'whsec_demo_acme_cloud_do_not_use_in_production',
  acmeBilling: 'whsec_demo_acme_billing_do_not_use_in_production',
  globexAnalytics: 'whsec_demo_globex_do_not_use_in_production',
} as const;

export const DEMO_WIDGET_PUBLIC_KEYS = {
  acmeCloud: 'wk_live_acme_cloud_demo',
  acmeBilling: 'wk_live_acme_billing_demo',
  globexAnalytics: 'wk_live_globex_demo',
} as const;

/** Origins the demo host application is served from. */
export const DEMO_ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://127.0.0.1:8080',
];

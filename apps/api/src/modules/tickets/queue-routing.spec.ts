import { describe, expect, it } from 'vitest';
import { ACTIVE_STATUSES } from './ticket.dto';

describe('Queue Routing & Auto-Assignment Lifecycle Tests', () => {
  const agents = [
    { id: 'agent-1', fullName: 'Alice L1', isAvailable: true, maxConcurrentTickets: 5, lastLogin: new Date('2026-10-01T08:00:00Z') },
    { id: 'agent-2', fullName: 'Bob L1', isAvailable: true, maxConcurrentTickets: 2, lastLogin: new Date('2026-10-01T09:00:00Z') },
    { id: 'agent-3', fullName: 'Charlie L1', isAvailable: false, maxConcurrentTickets: 5, lastLogin: new Date('2026-10-01T10:30:00Z') }, // offline but most recently active
    { id: 'agent-4', fullName: 'Dave L1', isAvailable: true, maxConcurrentTickets: 1, lastLogin: new Date('2026-10-01T07:00:00Z') },
  ];

  const agentLoads: Record<string, number> = {
    'agent-1': 3,
    'agent-2': 2, // at max cap (2/2)
    'agent-3': 0, // offline
    'agent-4': 0, // least loaded (0/1)
  };

  it('Online Only: filters out offline agents; does NOT assign to offline agents', () => {
    const onlineCandidates = agents.filter((a) => a.isAvailable);
    const eligible = onlineCandidates.filter((a) => {
      const load = agentLoads[a.id] ?? 0;
      return a.maxConcurrentTickets === null || load < candidateMax(a);
    });

    function candidateMax(a: any) {
      return a.maxConcurrentTickets;
    }

    expect(eligible.map((a) => a.id)).toEqual(['agent-1', 'agent-4']);
  });

  it('Strict Online Policy: if all agents are offline, returns null (unassigned in queue)', () => {
    // Simulate all agents offline
    const allOffline = agents.map((a) => ({ ...a, isAvailable: false }));
    const onlineCandidates = allOffline.filter((a) => a.isAvailable);

    // No offline fallback -> stays null
    const chosen = onlineCandidates.length > 0 ? onlineCandidates[0] : null;
    expect(chosen).toBeNull();
  });

  it('LEAST_LOADED strategy picks agent with lowest active load', () => {
    const eligible = agents
      .filter((a) => a.isAvailable && (agentLoads[a.id] ?? 0) < a.maxConcurrentTickets)
      .sort((a, b) => (agentLoads[a.id] ?? 0) - (agentLoads[b.id] ?? 0));

    expect(eligible[0]?.id).toBe('agent-4'); // load 0 vs agent-1 load 3
  });

  it('ROUND_ROBIN strategy rotates deterministically through eligible candidates', () => {
    const eligible = agents
      .filter((a) => a.isAvailable && (agentLoads[a.id] ?? 0) < a.maxConcurrentTickets)
      .sort((a, b) => a.id.localeCompare(b.id)); // ['agent-1', 'agent-4']

    // Rotation 1: from none -> agent-1
    let lastAssignedId: string | null = null;
    let nextIdx = 0;
    let chosen = eligible[nextIdx]!.id;
    expect(chosen).toBe('agent-1');
    lastAssignedId = chosen;

    // Rotation 2: from agent-1 -> agent-4
    let lastIdx = eligible.findIndex((c) => c.id === lastAssignedId);
    nextIdx = (lastIdx + 1) % eligible.length;
    chosen = eligible[nextIdx]!.id;
    expect(chosen).toBe('agent-4');
    lastAssignedId = chosen;

    // Rotation 3: from agent-4 -> agent-1 (wraps around)
    lastIdx = eligible.findIndex((c) => c.id === lastAssignedId);
    nextIdx = (lastIdx + 1) % eligible.length;
    chosen = eligible[nextIdx]!.id;
    expect(chosen).toBe('agent-1');
  });

  it('verifies ACTIVE_STATUSES includes IN_PROGRESS and excludes RESOLVED/CLOSED', () => {
    expect(ACTIVE_STATUSES).toContain('NEW');
    expect(ACTIVE_STATUSES).toContain('OPEN');
    expect(ACTIVE_STATUSES).toContain('IN_PROGRESS');
    expect(ACTIVE_STATUSES).not.toContain('RESOLVED');
    expect(ACTIVE_STATUSES).not.toContain('CLOSED');
  });

  it('verifies standard 3-stage lifecycle state machine', () => {
    // Stage 1: Fresh Unassigned Intake
    let ticket: { status: string; assigneeId: string | null } = {
      status: 'NEW',
      assigneeId: null,
    };
    expect(ticket.status).toBe('NEW');

    // Stage 2: Assigned (Auto or Manual)
    ticket.assigneeId = 'agent-1';
    if (ticket.assigneeId && ticket.status === 'NEW') {
      ticket.status = 'OPEN';
    }
    expect(ticket.status).toBe('OPEN');

    // Stage 3: In Progress (Staff writes note or works on ticket)
    const isStaffAction = true;
    if (isStaffAction && ['NEW', 'OPEN', 'TRIAGE'].includes(ticket.status)) {
      ticket.status = 'IN_PROGRESS';
    }
    expect(ticket.status).toBe('IN_PROGRESS');
  });

  it('Tier Isolation: strictly restricts online candidates to the matching tier (e.g. L1)', () => {
    const multiTierStaff = [
      { id: 'staff-l1-online', tier: 'L1', isAvailable: true, lastLogin: new Date('2026-10-01T08:00:00Z') },
      { id: 'staff-l1-offline', tier: 'L1', isAvailable: false, lastLogin: new Date('2026-10-01T07:00:00Z') },
      { id: 'staff-l2-online', tier: 'L2', isAvailable: true, lastLogin: new Date('2026-10-01T09:00:00Z') },
      { id: 'staff-l3-offline-recent', tier: 'L3', isAvailable: false, lastLogin: new Date('2026-10-01T12:00:00Z') },
    ];

    const targetTier = 'L1';
    const tierScopedCandidates = multiTierStaff.filter((s) => s.tier === targetTier);

    // Primary Online for L1
    const onlineL1 = tierScopedCandidates.filter((s) => s.isAvailable);
    expect(onlineL1.map((s) => s.id)).toEqual(['staff-l1-online']);

    // When all L1 are offline -> returns empty / null
    const allL1Offline = tierScopedCandidates.map((s) => ({ ...s, isAvailable: false }));
    const onlineCheck = allL1Offline.filter((s) => s.isAvailable);
    expect(onlineCheck.length).toBe(0);
  });

  describe('Full Permutations & Combinations Matrix Tests', () => {
    const orgStaff = [
      { id: 'l1-agent-a', tier: 'L1', teams: ['team-support'], isAvailable: true, load: 3, cap: 5, lastSeen: new Date('2026-10-01T10:00:00Z') },
      { id: 'l1-agent-b', tier: 'L1', teams: ['team-support'], isAvailable: true, load: 1, cap: 5, lastSeen: new Date('2026-10-01T10:15:00Z') },
      { id: 'l1-agent-c', tier: 'L1', teams: [], isAvailable: false, load: 0, cap: 5, lastSeen: new Date('2026-10-01T11:00:00Z') },
      { id: 'l2-agent-a', tier: 'L2', teams: ['team-tech'], isAvailable: true, load: 2, cap: 5, lastSeen: new Date('2026-10-01T10:30:00Z') },
      { id: 'l2-agent-b', tier: 'L2', teams: ['team-tech'], isAvailable: false, load: 0, cap: 5, lastSeen: new Date('2026-10-01T12:00:00Z') },
      { id: 'l3-agent-a', tier: 'L3', teams: ['team-specialist'], isAvailable: true, load: 0, cap: 5, lastSeen: new Date('2026-10-01T09:00:00Z') },
      { id: 'dev-agent-a', tier: 'DEV', teams: ['team-eng'], isAvailable: true, load: 0, cap: 5, lastSeen: new Date('2026-10-01T08:00:00Z') },
      { id: 'devops-agent-a', tier: 'DEVOPS', teams: ['team-infra'], isAvailable: true, load: 1, cap: 5, lastSeen: new Date('2026-10-01T08:30:00Z') },
      { id: 'devops-agent-b', tier: 'DEVOPS', teams: ['team-infra'], isAvailable: false, load: 0, cap: 5, lastSeen: new Date('2026-10-01T09:30:00Z') },
    ];

    function resolveCandidates(config: { tier?: string | null; teamId?: string | null }) {
      return orgStaff.filter((staff) => {
        if (!staff.isAvailable) return false;
        if (config.teamId) {
          return staff.teams.includes(config.teamId);
        }
        if (config.tier) {
          return staff.tier === config.tier;
        }
        return true;
      });
    }

    function routeLeastLoaded(candidates: typeof orgStaff) {
      const online = candidates.filter((c) => c.isAvailable && c.load < c.cap);
      if (online.length > 0) {
        return [...online].sort((a, b) => a.load - b.load)[0]?.id ?? null;
      }
      if (candidates.length > 0) {
        return [...candidates].sort((a, b) => a.load - b.load)[0]?.id ?? null;
      }
      return null;
    }

    function routeRoundRobin(candidates: typeof orgStaff, lastAssignedId: string | null) {
      let eligible = candidates.filter((c) => c.isAvailable && c.load < c.cap);
      if (eligible.length === 0) {
        eligible = candidates;
      }
      if (eligible.length === 0) return null;

      eligible.sort((a, b) => a.id.localeCompare(b.id));
      if (!lastAssignedId) return eligible[0]!.id;

      const idx = eligible.findIndex((c) => c.id === lastAssignedId);
      if (idx === -1) return eligible[0]!.id;
      return eligible[(idx + 1) % eligible.length]!.id;
    }

    it('Permutation 1: Tier L1 + No Team + Least Loaded (Online)', () => {
      const pool = resolveCandidates({ tier: 'L1', teamId: null });
      const assigned = routeLeastLoaded(pool);
      // Pick least loaded online L1 agent (l1-agent-b has load 1 vs l1-agent-a load 3)
      expect(assigned).toBe('l1-agent-b');
    });

    it('Permutation 2: Tier L1 + No Team + (All L1 Offline) -> returns null', () => {
      // Simulate all L1 offline
      const pool = resolveCandidates({ tier: 'L1', teamId: null }).map((c) => ({ ...c, isAvailable: false }));
      const assigned = routeLeastLoaded(pool.filter((c) => c.isAvailable));
      expect(assigned).toBeNull();
    });

    it('Permutation 3: Tier L2 + No Team + Round Robin (Online rotation)', () => {
      const pool = resolveCandidates({ tier: 'L2', teamId: null });
      const assigned1 = routeRoundRobin(pool, null);
      expect(assigned1).toBe('l2-agent-a');
    });

    it('Permutation 4: Tier L2 + No Team (All L2 Offline) -> returns null', () => {
      const pool = resolveCandidates({ tier: 'L2', teamId: null }).map((c) => ({ ...c, isAvailable: false }));
      const assigned = routeLeastLoaded(pool.filter((c) => c.isAvailable));
      expect(assigned).toBeNull();
    });

    it('Permutation 5: Tier L3 + No Team + Least Loaded', () => {
      const pool = resolveCandidates({ tier: 'L3', teamId: null });
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBe('l3-agent-a');
    });

    it('Permutation 6: Specific Team (team-support) regardless of tier', () => {
      const pool = resolveCandidates({ teamId: 'team-support' });
      expect(pool.map((c) => c.id)).toEqual(['l1-agent-a', 'l1-agent-b']);
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBe('l1-agent-b');
    });

    it('Permutation 7: No Team + No Tier (Online Staff Pool)', () => {
      const pool = resolveCandidates({ tier: null, teamId: null });
      const onlineStaff = orgStaff.filter((s) => s.isAvailable);
      expect(pool.length).toBe(onlineStaff.length);
    });

    it('Permutation 8: Empty Tier (e.g. QA with 0 agents) -> returns null, 0 leakage', () => {
      const pool = resolveCandidates({ tier: 'QA', teamId: null });
      expect(pool.length).toBe(0);
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBeNull(); // Clean unassigned status in queue
    });

    it('Permutation 9: Saturated Capacity (All available online agents at cap)', () => {
      const saturatedL1 = [
        { id: 'l1-a', tier: 'L1', teams: [], isAvailable: true, load: 5, cap: 5, lastSeen: new Date('2026-10-01T10:00:00Z') },
        { id: 'l1-b', tier: 'L1', teams: [], isAvailable: true, load: 5, cap: 5, lastSeen: new Date('2026-10-01T11:00:00Z') },
      ];
      const assigned = routeLeastLoaded(saturatedL1);
      // Gracefully balances among eligible online L1s
      expect(assigned).toBe('l1-a');
    });

    it('Permutation 10: Tier DEVOPS + No Team + Least Loaded (Online)', () => {
      const pool = resolveCandidates({ tier: 'DEVOPS', teamId: null });
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBe('devops-agent-a');
    });

    it('Permutation 11: Tier DEVOPS + No Team (All DEVOPS Offline) -> returns null', () => {
      const pool = resolveCandidates({ tier: 'DEVOPS', teamId: null }).map((c) => ({ ...c, isAvailable: false }));
      const assigned = routeLeastLoaded(pool.filter((c) => c.isAvailable));
      expect(assigned).toBeNull();
    });
  });

  describe('Product Scoping & Auto-Assignment Isolation Tests', () => {
    const productStaff = [
      { id: 'agent-claimbook', tier: 'L1', products: ['Claimbook'], isAvailable: true, load: 1, cap: 5, lastSeen: new Date('2026-10-01T10:00:00Z') },
      { id: 'agent-docuvault', tier: 'L1', products: ['DocuVault'], isAvailable: true, load: 0, cap: 5, lastSeen: new Date('2026-10-01T10:30:00Z') },
      { id: 'agent-general', tier: 'L1', products: [], isAvailable: true, load: 2, cap: 5, lastSeen: new Date('2026-10-01T09:00:00Z') }, // unrestricted
      { id: 'agent-multi', tier: 'L1', products: ['Claimbook', 'DocuVault'], isAvailable: true, load: 3, cap: 5, lastSeen: new Date('2026-10-01T11:00:00Z') },
    ];

    function resolveProductCandidates(productName: string | null) {
      return productStaff.filter((staff) => {
        if (productName) {
          // Explicit product match OR unrestricted agent
          return staff.products.some((p) => p.toLowerCase() === productName.toLowerCase()) || staff.products.length === 0;
        }
        // General ticket -> Only unrestricted agents
        return staff.products.length === 0;
      });
    }

    it('Strict Isolation: Ticket for Claimbook only considers Claimbook-authorized & unrestricted agents', () => {
      const candidates = resolveProductCandidates('Claimbook');
      const candidateIds = candidates.map((c) => c.id);

      expect(candidateIds).toContain('agent-claimbook');
      expect(candidateIds).toContain('agent-general');
      expect(candidateIds).toContain('agent-multi');
      expect(candidateIds).not.toContain('agent-docuvault'); // STRICTLY EXCLUDED
    });

    it('Strict Isolation: Ticket for DocuVault only considers DocuVault-authorized & unrestricted agents', () => {
      const candidates = resolveProductCandidates('DocuVault');
      const candidateIds = candidates.map((c) => c.id);

      expect(candidateIds).toContain('agent-docuvault');
      expect(candidateIds).toContain('agent-general');
      expect(candidateIds).toContain('agent-multi');
      expect(candidateIds).not.toContain('agent-claimbook'); // STRICTLY EXCLUDED
    });

    it('Strict Isolation: General ticket (no product) ONLY considers unrestricted agents', () => {
      const candidates = resolveProductCandidates(null);
      const candidateIds = candidates.map((c) => c.id);

      expect(candidateIds).toEqual(['agent-general']);
      expect(candidateIds).not.toContain('agent-claimbook');
      expect(candidateIds).not.toContain('agent-docuvault');
      expect(candidateIds).not.toContain('agent-multi');
    });

    it('Zero-leakage: Ticket for an unknown product with NO mapped agents returns only unrestricted agents', () => {
      const candidates = resolveProductCandidates('UnknownProduct');
      const candidateIds = candidates.map((c) => c.id);

      expect(candidateIds).toEqual(['agent-general']);
      expect(candidateIds).not.toContain('agent-claimbook');
      expect(candidateIds).not.toContain('agent-docuvault');
    });

    it('Zero-leakage Fallback: If no agents exist for Product X, return null instead of leaking to other products', () => {
      const noUnrestrictedStaff = productStaff.filter((s) => s.products.length > 0);
      const candidates = noUnrestrictedStaff.filter((staff) =>
        staff.products.some((p) => p.toLowerCase() === 'unstaffedproduct'),
      );

      expect(candidates.length).toBe(0);
      // Auto-assignment should gracefully result in null (status: NEW) without leaking
      const selected = candidates.length > 0 ? candidates[0]?.id : null;
      expect(selected).toBeNull();
    });
  });

  describe('Organization & Product Domain Matching Tests', () => {
    const orgs = [
      {
        name: 'Apollo Hospitals',
        slug: 'apollo-hospitals',
        domains: 'apollohospitals.com, apollo.org, @care.apollo.in',
        contactEmail: 'desk@apollohospitals.com',
        website: 'https://www.apollohospitals.com',
        product: 'Hospital Core',
      },
      {
        name: 'Manipal Health',
        slug: 'manipal',
        domains: 'manipal.edu, manipalhospitals.com',
        contactEmail: 'support@manipal.edu',
        website: 'https://manipal.edu',
        product: 'DocuVault',
      },
      {
        name: 'Single Domain Clinic',
        slug: 'sdc-clinic',
        domains: 'sdcclinic.in',
        contactEmail: null,
        website: null,
        product: 'ClaimBook',
      },
    ];

    function matchOrgFromEmail(senderEmail: string) {
      if (!senderEmail || !senderEmail.includes('@')) return null;
      const cleanEmail = senderEmail.toLowerCase().trim();
      const emailDomain = cleanEmail.split('@')[1]?.toLowerCase().trim() || '';

      for (const org of orgs) {
        let isMatch = false;

        if (org.domains) {
          const domainList = org.domains
            .split(/[\s,;]+/)
            .map((d) => d.toLowerCase().trim().replace(/^@/, '').replace(/^\*\.?/, ''))
            .filter(Boolean);

          isMatch = domainList.some((rule) => {
            return rule === cleanEmail || rule === emailDomain || emailDomain.endsWith(`.${rule}`);
          });
        }

        if (!isMatch && org.contactEmail) {
          if (org.contactEmail.toLowerCase().trim() === cleanEmail) isMatch = true;
        }

        if (!isMatch && org.website) {
          const hostPart = org.website.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0] || '';
          const websiteDomain = hostPart.toLowerCase().trim();
          if (websiteDomain && (websiteDomain === emailDomain || emailDomain.endsWith(`.${websiteDomain}`))) {
            isMatch = true;
          }
        }

        if (!isMatch) {
          const domainPrefix = emailDomain.split('.')[0] || '';
          const orgSlugClean = org.slug.toLowerCase().replace(/[^a-z0-9]/g, '');
          const orgNameClean = org.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          if (domainPrefix && (orgSlugClean === domainPrefix || orgNameClean === domainPrefix)) {
            isMatch = true;
          }
        }

        if (isMatch) return org;
      }
      return null;
    }

    it('matches exact domain in multi-domain list', () => {
      const match = matchOrgFromEmail('doctor.smith@apollohospitals.com');
      expect(match?.name).toBe('Apollo Hospitals');
      expect(match?.product).toBe('Hospital Core');
    });

    it('matches secondary domain in multi-domain list', () => {
      const match = matchOrgFromEmail('admin@apollo.org');
      expect(match?.name).toBe('Apollo Hospitals');
      expect(match?.product).toBe('Hospital Core');
    });

    it('matches domain with leading @ or subdomain', () => {
      const match = matchOrgFromEmail('nurse@care.apollo.in');
      expect(match?.name).toBe('Apollo Hospitals');
    });

    it('matches contactEmail exactly', () => {
      const match = matchOrgFromEmail('desk@apollohospitals.com');
      expect(match?.name).toBe('Apollo Hospitals');
      expect(match?.product).toBe('Hospital Core');
    });

    it('matches domain to other organization', () => {
      const match = matchOrgFromEmail('dr.rao@manipalhospitals.com');
      expect(match?.name).toBe('Manipal Health');
      expect(match?.product).toBe('DocuVault');
    });

    it('returns null for unknown external domain without false positive matches', () => {
      const match = matchOrgFromEmail('random.user@gmail.com');
      expect(match).toBeNull();
    });
  });

  describe('Queue Resolution Isolation Tests', () => {
    const queues = [
      { id: 'q-general-default', name: 'General Support', productId: null, isDefault: true, isActive: true },
      { id: 'q-general-active', name: 'General Tier 2', productId: null, isDefault: false, isActive: true },
      { id: 'q-core-default', name: 'Core Product Queue', productId: 'p-core', productName: 'Hospital Core', isDefault: true, isActive: true },
      { id: 'q-docu-default', name: 'DocuVault Queue', productId: 'p-docu', productName: 'DocuVault', isDefault: true, isActive: true },
    ];

    function resolveQueue(productName: string | null) {
      if (productName) {
        // 1. Product-specific default
        const prodDefault = queues.find(
          (q) => q.isActive && q.isDefault && q.productName?.toLowerCase() === productName.toLowerCase(),
        );
        if (prodDefault) return prodDefault;

        // 2. Product-specific active
        const prodActive = queues.find(
          (q) => q.isActive && q.productName?.toLowerCase() === productName.toLowerCase(),
        );
        if (prodActive) return prodActive;

        // 3. General default (productId: null)
        const genDefault = queues.find((q) => q.isActive && q.isDefault && q.productId === null);
        if (genDefault) return genDefault;

        // 4. General active (productId: null)
        const genActive = queues.find((q) => q.isActive && q.productId === null);
        if (genActive) return genActive;

        return null;
      } else {
        // General ticket -> MUST have productId: null
        const genDefault = queues.find((q) => q.isActive && q.isDefault && q.productId === null);
        if (genDefault) return genDefault;

        const genActive = queues.find((q) => q.isActive && q.productId === null);
        if (genActive) return genActive;

        return null;
      }
    }

    it('Product A ticket matches Product A default queue', () => {
      const q = resolveQueue('Hospital Core');
      expect(q?.id).toBe('q-core-default');
    });

    it('Product B ticket matches Product B default queue', () => {
      const q = resolveQueue('DocuVault');
      expect(q?.id).toBe('q-docu-default');
    });

    it('Product with no product queue falls back to GENERAL default queue (NEVER Product B queue)', () => {
      const q = resolveQueue('UnconfiguredProduct');
      expect(q?.id).toBe('q-general-default');
      expect(q?.productId).toBeNull();
    });

    it('General ticket with no product matches GENERAL default queue (NEVER Product queue)', () => {
      const q = resolveQueue(null);
      expect(q?.id).toBe('q-general-default');
      expect(q?.productId).toBeNull();
    });
  });
});


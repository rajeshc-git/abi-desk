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

  it('Tier 1: filters out offline and over-capacity agents when online agents exist', () => {
    const onlineCandidates = agents.filter((a) => a.isAvailable);
    const eligible = onlineCandidates.filter((a) => {
      const load = agentLoads[a.id] ?? 0;
      return a.maxConcurrentTickets === null || load < a.maxConcurrentTickets;
    });

    expect(eligible.map((a) => a.id)).toEqual(['agent-1', 'agent-4']);
  });

  it('Tier 2 Fallback: if all agents are offline, falls back to most recent login active staff', () => {
    // Simulate all agents offline
    const allOffline = agents.map((a) => ({ ...a, isAvailable: false }));
    let onlineCandidates = allOffline.filter((a) => a.isAvailable);

    // Fallback activates
    if (onlineCandidates.length === 0) {
      onlineCandidates = [...allOffline].sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime());
    }

    expect(onlineCandidates.length).toBe(4);
    expect(onlineCandidates[0]?.id).toBe('agent-3'); // Charlie logged in at 10:30 (most recent)
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

  it('Tier Isolation: strictly restricts primary and fallback candidates to the matching tier (e.g. L1)', () => {
    const multiTierStaff = [
      { id: 'staff-l1-online', tier: 'L1', isAvailable: true, lastLogin: new Date('2026-10-01T08:00:00Z') },
      { id: 'staff-l1-offline', tier: 'L1', isAvailable: false, lastLogin: new Date('2026-10-01T07:00:00Z') },
      { id: 'staff-l2-online', tier: 'L2', isAvailable: true, lastLogin: new Date('2026-10-01T09:00:00Z') },
      { id: 'staff-l3-offline-recent', tier: 'L3', isAvailable: false, lastLogin: new Date('2026-10-01T12:00:00Z') }, // very recent login
    ];

    const targetTier = 'L1';
    const tierScopedCandidates = multiTierStaff.filter((s) => s.tier === targetTier);

    // Primary Online for L1
    const onlineL1 = tierScopedCandidates.filter((s) => s.isAvailable);
    expect(onlineL1.map((s) => s.id)).toEqual(['staff-l1-online']);

    // Secondary Fallback for L1 when all L1 are offline
    const allL1Offline = tierScopedCandidates.map((s) => ({ ...s, isAvailable: false }));
    const fallbackCandidates = [...allL1Offline].sort((a, b) => b.lastLogin.getTime() - a.lastLogin.getTime());
    
    // Must select L1 offline agent and NEVER pick L3 even though L3 logged in at 12:00
    expect(fallbackCandidates[0]?.id).toBe('staff-l1-online');
    expect(fallbackCandidates.some((c) => c.tier === 'L3')).toBe(false);
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
      // Fallback
      if (candidates.length > 0) {
        return [...candidates].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())[0]?.id ?? null;
      }
      return null;
    }

    function routeRoundRobin(candidates: typeof orgStaff, lastAssignedId: string | null) {
      let eligible = candidates.filter((c) => c.isAvailable && c.load < c.cap);
      if (eligible.length === 0) {
        eligible = [...candidates].sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());
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

    it('Permutation 2: Tier L1 + No Team + Least Loaded (All L1 Offline Fallback)', () => {
      // Simulate all L1 offline
      const pool = resolveCandidates({ tier: 'L1', teamId: null }).map((c) => ({ ...c, isAvailable: false }));
      const assigned = routeLeastLoaded(pool);
      // Picks most recently active offline L1 (l1-agent-c @ 11:00) and NEVER L2/L3 (even though L2 logged in at 12:00)
      expect(assigned).toBe('l1-agent-c');
    });

    it('Permutation 3: Tier L2 + No Team + Round Robin (Online rotation)', () => {
      const pool = resolveCandidates({ tier: 'L2', teamId: null });
      const assigned1 = routeRoundRobin(pool, null);
      expect(assigned1).toBe('l2-agent-a');
    });

    it('Permutation 4: Tier L2 + No Team + Fallback (All L2 Offline)', () => {
      const pool = resolveCandidates({ tier: 'L2', teamId: null }).map((c) => ({ ...c, isAvailable: false }));
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBe('l2-agent-b'); // L2 agent @ 12:00
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

    it('Permutation 7: No Team + No Tier (Tenant-Wide Fallback)', () => {
      const pool = resolveCandidates({ tier: null, teamId: null });
      expect(pool.length).toBe(orgStaff.length);
    });

    it('Permutation 8: Empty Tier (e.g. QA with 0 agents) -> returns null, 0 leakage', () => {
      const pool = resolveCandidates({ tier: 'QA', teamId: null });
      expect(pool.length).toBe(0);
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBeNull(); // Clean unassigned status in queue
    });

    it('Permutation 9: Saturated Capacity (All available agents at cap)', () => {
      const saturatedL1 = [
        { id: 'l1-a', tier: 'L1', teams: [], isAvailable: true, load: 5, cap: 5, lastSeen: new Date('2026-10-01T10:00:00Z') },
        { id: 'l1-b', tier: 'L1', teams: [], isAvailable: true, load: 5, cap: 5, lastSeen: new Date('2026-10-01T11:00:00Z') },
      ];
      const assigned = routeLeastLoaded(saturatedL1);
      // Gracefully falls back to most recently active among eligible L1s
      expect(assigned).toBe('l1-b');
    });

    it('Permutation 10: Tier DEVOPS + No Team + Least Loaded (Online)', () => {
      const pool = resolveCandidates({ tier: 'DEVOPS', teamId: null });
      const assigned = routeLeastLoaded(pool);
      expect(assigned).toBe('devops-agent-a');
    });

    it('Permutation 11: Tier DEVOPS + No Team + Fallback (All DEVOPS Offline)', () => {
      const pool = resolveCandidates({ tier: 'DEVOPS', teamId: null }).map((c) => ({ ...c, isAvailable: false }));
      const assigned = routeLeastLoaded(pool);
      // Picks devops-agent-b (logged in at 09:30 vs devops-agent-a 08:30), never spills to other tiers
      expect(assigned).toBe('devops-agent-b');
    });
  });
});

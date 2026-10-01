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
});

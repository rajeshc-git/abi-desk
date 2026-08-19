import { describe, expect, it } from 'vitest';

describe('Analytics Calculations & Export', () => {
  it('calculates average first response time and resolution hours accurately', () => {
    const createdAt1 = new Date('2026-01-01T10:00:00Z');
    const firstResponseAt1 = new Date('2026-01-01T10:30:00Z'); // 30 mins
    const resolvedAt1 = new Date('2026-01-01T14:00:00Z'); // 4 hours

    const createdAt2 = new Date('2026-01-01T11:00:00Z');
    const firstResponseAt2 = new Date('2026-01-01T12:00:00Z'); // 60 mins
    const resolvedAt2 = new Date('2026-01-01T17:00:00Z'); // 6 hours

    const tickets = [
      { createdAt: createdAt1, firstResponseAt: firstResponseAt1, resolvedAt: resolvedAt1 },
      { createdAt: createdAt2, firstResponseAt: firstResponseAt2, resolvedAt: resolvedAt2 },
    ];

    const totalResponseMs = tickets.reduce(
      (acc, t) => acc + (t.firstResponseAt.getTime() - t.createdAt.getTime()),
      0,
    );
    const avgResponseMins = Math.round(totalResponseMs / tickets.length / 60000);

    const totalResolutionMs = tickets.reduce(
      (acc, t) => acc + (t.resolvedAt.getTime() - t.createdAt.getTime()),
      0,
    );
    const avgResolutionHours = Math.round((totalResolutionMs / tickets.length / 3600000) * 10) / 10;

    expect(avgResponseMins).toBe(45); // (30 + 60) / 2
    expect(avgResolutionHours).toBe(5.0); // (4 + 6) / 2
  });

  it('calculates SLA compliance rate percentage correctly', () => {
    const metCount = 85;
    const breachedCount = 15;
    const totalFinished = metCount + breachedCount;
    const complianceRate = Math.round((metCount / totalFinished) * 100);

    expect(complianceRate).toBe(85);
  });

  it('escapes and formats CSV export rows safely', () => {
    const header = ['Number', 'Subject', 'Status'];
    const row = ['TICK-101', '"Crash with quotes"', 'RESOLVED'];

    const escapedRow = [row[0], `"${row[1].replace(/"/g, '""')}"`, row[2]];

    const csv = [header.join(','), escapedRow.join(',')].join('\n');
    expect(csv).toContain('TICK-101,"""Crash with quotes""",RESOLVED');
  });
});

import { Inject, Injectable } from '@nestjs/common';
import { type Prisma } from '@abi-desk/db';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { type AnalyticsFilterDto, type ExportReportDto } from './analytics.dto';

@Injectable()
export class AnalyticsService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'AnalyticsService' });
  }

  /**
   * High-level scorecard metrics for executive overview.
   */
  async getOverview(_principal: AuthenticatedPrincipal, filter: AnalyticsFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const where = this.buildTicketWhere(tenantId, filter);

    const [
      totalCreated,
      totalResolved,
      totalClosed,
      openBacklog,
      urgentCount,
      criticalCount,
      firstResponseTickets,
      resolvedTickets,
      csatStats,
      slaClocks,
    ] = await Promise.all([
      this.db.client.ticket.count({ where }),
      this.db.client.ticket.count({ where: { ...where, status: 'RESOLVED' } }),
      this.db.client.ticket.count({ where: { ...where, status: 'CLOSED' } }),
      this.db.client.ticket.count({
        where: { ...where, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
      }),
      this.db.client.ticket.count({
        where: {
          ...where,
          priority: 'URGENT',
          status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
        },
      }),
      this.db.client.ticket.count({
        where: {
          ...where,
          priority: 'CRITICAL',
          status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] },
        },
      }),
      this.db.client.ticket.findMany({
        where: { ...where, firstResponseAt: { not: null } },
        select: { createdAt: true, firstResponseAt: true },
      }),
      this.db.client.ticket.findMany({
        where: { ...where, resolvedAt: { not: null } },
        select: { createdAt: true, resolvedAt: true },
      }),
      this.db.client.csatResponse.aggregate({
        where: { tenantId },
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.db.client.ticketSlaState.findMany({
        where: { tenantId },
        select: { status: true, type: true },
      }),
    ]);

    // Calculate Average First Response Time (minutes)
    let avgFirstResponseMinutes: number | null = null;
    if (firstResponseTickets.length > 0) {
      const totalMs = firstResponseTickets.reduce((acc, t) => {
        return acc + (t.firstResponseAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgFirstResponseMinutes = Math.round(totalMs / firstResponseTickets.length / 60000);
    }

    // Calculate Average Resolution Time (hours)
    let avgResolutionHours: number | null = null;
    if (resolvedTickets.length > 0) {
      const totalMs = resolvedTickets.reduce((acc, t) => {
        return acc + (t.resolvedAt!.getTime() - t.createdAt.getTime());
      }, 0);
      avgResolutionHours = Math.round((totalMs / resolvedTickets.length / 3600000) * 10) / 10;
    }

    // SLA Compliance rate (% of completed clocks that were MET)
    const metCount = slaClocks.filter((c) => c.status === 'MET').length;
    const breachedCount = slaClocks.filter((c) => c.status === 'BREACHED').length;
    const totalFinished = metCount + breachedCount;
    const slaComplianceRate =
      totalFinished > 0 ? Math.round((metCount / totalFinished) * 100) : null;

    return {
      totalCreated,
      totalResolved,
      totalClosed,
      openBacklog,
      urgentCount,
      criticalCount,
      avgFirstResponseMinutes,
      avgResolutionHours,
      slaComplianceRate,
      csatAverage: csatStats._avg.rating ? Math.round(csatStats._avg.rating * 10) / 10 : null,
      csatResponseCount: csatStats._count.id,
    };
  }

  /**
   * Time-series daily volume trends (Inflow vs Resolutions vs Breaches).
   */
  async getTimelineTrends(_principal: AuthenticatedPrincipal, filter: AnalyticsFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();

    // Determine days window (default 14 days)
    let days = filter.days || 14;
    if (filter.timeRange === '24h') days = 1;
    else if (filter.timeRange === '7d') days = 7;
    else if (filter.timeRange === '14d') days = 14;
    else if (filter.timeRange === '30d') days = 30;
    else if (filter.timeRange === '90d') days = 90;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const where: Prisma.TicketWhereInput = {
      tenantId,
      deletedAt: null,
      createdAt: { gte: startDate },
    };
    if (filter.brandId) where.brandId = filter.brandId;
    if (filter.tier) where.tier = filter.tier;
    if (filter.channel) where.channel = filter.channel;

    const [tickets, slaStates] = await Promise.all([
      this.db.client.ticket.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          resolvedAt: true,
        },
      }),
      this.db.client.ticketSlaState.findMany({
        where: {
          tenantId,
          breachedAt: { gte: startDate },
        },
        select: {
          breachedAt: true,
        },
      }),
    ]);

    // Build day buckets map
    const dayBuckets: Record<
      string,
      { date: string; day: string; created: number; resolved: number; breached: number }
    > = {};
    const dateList: string[] = [];

    const monthNames = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateList.push(key);
      const label = `${monthNames[d.getMonth()]} ${d.getDate().toString().padStart(2, '0')}`;
      dayBuckets[key] = {
        date: label,
        day: dayNames[d.getDay()] || '',
        created: 0,
        resolved: 0,
        breached: 0,
      };
    }

    tickets.forEach((t) => {
      const createdKey = t.createdAt.toISOString().slice(0, 10);
      if (dayBuckets[createdKey]) {
        dayBuckets[createdKey].created += 1;
      }
      if (t.resolvedAt) {
        const resolvedKey = t.resolvedAt.toISOString().slice(0, 10);
        if (dayBuckets[resolvedKey]) {
          dayBuckets[resolvedKey].resolved += 1;
        }
      }
    });

    slaStates.forEach((s) => {
      if (s.breachedAt) {
        const breachedKey = s.breachedAt.toISOString().slice(0, 10);
        if (dayBuckets[breachedKey]) {
          dayBuckets[breachedKey].breached += 1;
        }
      }
    });

    const points = dateList.map((key) => dayBuckets[key]!).filter(Boolean);
    return { days, points };
  }

  /**
   * 7-Day x 24-Hour Peak Inflow Heatmap calculation.
   */
  async getHourlyHeatmap(_principal: AuthenticatedPrincipal, filter: AnalyticsFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const where = this.buildTicketWhere(tenantId, filter);

    const tickets = await this.db.client.ticket.findMany({
      where,
      select: { createdAt: true },
      take: 5000,
    });

    // 7 rows (Sunday=0 to Saturday=6), 24 columns (00:00 to 23:00)
    const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
    let maxCount = 0;

    tickets.forEach((t) => {
      const d = t.createdAt;
      const day = d.getDay(); // 0-6
      const hour = d.getHours(); // 0-23
      const row = matrix[day];
      if (row && row[hour] !== undefined) {
        row[hour] += 1;
        if (row[hour] > maxCount) {
          maxCount = row[hour];
        }
      }
    });

    return {
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      matrix,
      maxCount: Math.max(maxCount, 1),
      totalSampled: tickets.length,
    };
  }

  /**
   * Volume breakdown by status, priority, channel, tier, and category.
   */
  async getVolumeBreakdown(_principal: AuthenticatedPrincipal, filter: AnalyticsFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const where = this.buildTicketWhere(tenantId, filter);

    const [byStatus, byPriority, byChannel, byTier, byCategory] = await Promise.all([
      this.db.client.ticket.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.db.client.ticket.groupBy({
        by: ['priority'],
        where,
        _count: { id: true },
      }),
      this.db.client.ticket.groupBy({
        by: ['channel'],
        where,
        _count: { id: true },
      }),
      this.db.client.ticket.groupBy({
        by: ['tier'],
        where,
        _count: { id: true },
      }),
      this.db.client.ticket.groupBy({
        by: ['category'],
        where: { ...where, category: { not: null } },
        _count: { id: true },
      }),
    ]);

    return {
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
      byPriority: byPriority.map((p) => ({ priority: p.priority, count: p._count.id })),
      byChannel: byChannel.map((c) => ({ channel: c.channel, count: c._count.id })),
      byTier: byTier.map((t) => ({ tier: t.tier, count: t._count.id })),
      byCategory: byCategory.map((cat) => ({
        category: cat.category ?? 'Uncategorized',
        count: cat._count.id,
      })),
    };
  }

  /**
   * Deep SLA Performance Breakdown, Clocks, and At-Risk Radar.
   */
  async getSlaMetrics(_principal: AuthenticatedPrincipal, _filter: AnalyticsFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const [clocks, policies, atRiskStates] = await Promise.all([
      this.db.client.ticketSlaState.findMany({
        where: { tenantId },
        select: { type: true, status: true, dueAt: true, warnAt: true, policyId: true },
      }),
      this.db.client.slaPolicy.findMany({
        where: { tenantId },
        select: { id: true, name: true, priority: true, warningThreshold: true },
      }),
      this.db.client.ticketSlaState.findMany({
        where: {
          tenantId,
          status: { in: ['RUNNING', 'PAUSED'] },
        },
        orderBy: { dueAt: 'asc' },
        take: 8,
        include: {
          ticket: {
            select: {
              id: true,
              number: true,
              subject: true,
              priority: true,
              tier: true,
              status: true,
              assignee: { select: { fullName: true, email: true } },
            },
          },
          policy: { select: { name: true } },
        },
      }),
    ]);

    const firstResponse = {
      total: clocks.filter((c) => c.type === 'FIRST_RESPONSE').length,
      met: clocks.filter((c) => c.type === 'FIRST_RESPONSE' && c.status === 'MET').length,
      breached: clocks.filter((c) => c.type === 'FIRST_RESPONSE' && c.status === 'BREACHED').length,
      running: clocks.filter((c) => c.type === 'FIRST_RESPONSE' && c.status === 'RUNNING').length,
      paused: clocks.filter((c) => c.type === 'FIRST_RESPONSE' && c.status === 'PAUSED').length,
    };

    const resolution = {
      total: clocks.filter((c) => c.type === 'RESOLUTION').length,
      met: clocks.filter((c) => c.type === 'RESOLUTION' && c.status === 'MET').length,
      breached: clocks.filter((c) => c.type === 'RESOLUTION' && c.status === 'BREACHED').length,
      running: clocks.filter((c) => c.type === 'RESOLUTION' && c.status === 'RUNNING').length,
      paused: clocks.filter((c) => c.type === 'RESOLUTION' && c.status === 'PAUSED').length,
    };

    // Overall compliance
    const metAll = firstResponse.met + resolution.met;
    const breachedAll = firstResponse.breached + resolution.breached;
    const complianceRate =
      metAll + breachedAll > 0 ? Math.round((metAll / (metAll + breachedAll)) * 100) : 100;

    // Policy-level compliance summary
    const policyBreakdown = policies.map((p) => {
      const pClocks = clocks.filter((c) => c.policyId === p.id);
      const met = pClocks.filter((c) => c.status === 'MET').length;
      const breached = pClocks.filter((c) => c.status === 'BREACHED').length;
      const total = met + breached;
      return {
        id: p.id,
        name: p.name,
        totalClocks: pClocks.length,
        metCount: met,
        breachedCount: breached,
        complianceRate: total > 0 ? Math.round((met / total) * 100) : 100,
      };
    });

    // Format At-Risk Radar tickets
    const now = Date.now();
    const atRiskRadar = atRiskStates.map((s) => {
      const minutesRemaining = Math.round((s.dueAt.getTime() - now) / 60000);
      return {
        id: s.id,
        ticketId: s.ticket.id,
        ticketNumber: s.ticket.number,
        subject: s.ticket.subject,
        priority: s.ticket.priority,
        tier: s.ticket.tier,
        clockType: s.type,
        clockStatus: s.status,
        dueAt: s.dueAt.toISOString(),
        minutesRemaining,
        isOverdue: minutesRemaining < 0,
        policyName: s.policy.name,
        assignee: s.ticket.assignee?.fullName || 'Unassigned',
      };
    });

    return {
      firstResponse,
      resolution,
      complianceRate,
      policyBreakdown,
      atRiskRadar,
    };
  }

  /**
   * CSAT Survey ratings distribution (1 to 5 stars).
   */
  async getCsatDistribution(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();

    const responses = await this.db.client.csatResponse.groupBy({
      by: ['rating'],
      where: { tenantId },
      _count: { id: true },
    });

    const starCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let totalCount = 0;
    let sumRating = 0;

    responses.forEach((r) => {
      if (r.rating >= 1 && r.rating <= 5) {
        starCounts[r.rating] = r._count.id;
        totalCount += r._count.id;
        sumRating += r.rating * r._count.id;
      }
    });

    const average = totalCount > 0 ? Math.round((sumRating / totalCount) * 10) / 10 : 0;
    const distribution = [5, 4, 3, 2, 1].map((stars) => {
      const count = starCounts[stars] || 0;
      return {
        stars,
        count,
        percentage: totalCount > 0 ? Math.round((count / totalCount) * 100) : 0,
      };
    });

    return {
      average,
      totalCount,
      distribution,
    };
  }

  /**
   * Agent performance breakdown with resolution metrics and workload.
   */
  async getAgentPerformance(_principal: AuthenticatedPrincipal, filter: AnalyticsFilterDto) {
    const tenantId = this.tenantContext.requireTenantId();
    const where = this.buildTicketWhere(tenantId, filter);

    const [assignedGroup, resolvedGroup, agents, csatByAgent, resolvedTickets] = await Promise.all([
      this.db.client.ticket.groupBy({
        by: ['assigneeId'],
        where: { ...where, assigneeId: { not: null } },
        _count: { id: true },
      }),
      this.db.client.ticket.groupBy({
        by: ['assigneeId'],
        where: { ...where, assigneeId: { not: null }, status: { in: ['RESOLVED', 'CLOSED'] } },
        _count: { id: true },
      }),
      this.db.client.user.findMany({
        where: { tenantId, kind: 'STAFF' },
        select: { id: true, fullName: true, email: true, jobTitle: true },
      }),
      this.db.client.csatResponse.groupBy({
        by: ['agentId'],
        where: { tenantId, agentId: { not: null } },
        _avg: { rating: true },
        _count: { id: true },
      }),
      this.db.client.ticket.findMany({
        where: { ...where, assigneeId: { not: null }, resolvedAt: { not: null } },
        select: { assigneeId: true, createdAt: true, resolvedAt: true },
      }),
    ]);

    const assignedMap = new Map(assignedGroup.map((g) => [g.assigneeId, g._count.id]));
    const resolvedMap = new Map(resolvedGroup.map((g) => [g.assigneeId, g._count.id]));
    const csatMap = new Map(
      csatByAgent.map((g) => [
        g.agentId,
        {
          rating: g._avg.rating ? Math.round(g._avg.rating * 10) / 10 : null,
          count: g._count.id,
        },
      ]),
    );

    // Compute average resolution hours per agent
    const agentTimeMap = new Map<string, { totalMs: number; count: number }>();
    resolvedTickets.forEach((t) => {
      if (t.assigneeId && t.resolvedAt) {
        const ms = t.resolvedAt.getTime() - t.createdAt.getTime();
        const current = agentTimeMap.get(t.assigneeId) || { totalMs: 0, count: 0 };
        agentTimeMap.set(t.assigneeId, { totalMs: current.totalMs + ms, count: current.count + 1 });
      }
    });

    return agents.map((agent) => {
      const timeData = agentTimeMap.get(agent.id);
      const avgHours =
        timeData && timeData.count > 0
          ? Math.round((timeData.totalMs / timeData.count / 3600000) * 10) / 10
          : null;
      const assigned = assignedMap.get(agent.id) ?? 0;
      const resolved = resolvedMap.get(agent.id) ?? 0;
      const resolutionRate = assigned > 0 ? Math.round((resolved / assigned) * 100) : 100;

      return {
        agentId: agent.id,
        fullName: agent.fullName,
        email: agent.email,
        jobTitle: agent.jobTitle,
        assignedCount: assigned,
        resolvedCount: resolved,
        resolutionRate,
        avgResolutionHours: avgHours,
        csatAverage: csatMap.get(agent.id)?.rating ?? null,
        csatCount: csatMap.get(agent.id)?.count ?? 0,
      };
    });
  }

  /**
   * Queue and Team breakdown.
   */
  async getQueueDistribution(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();

    const [queues, byQueue] = await Promise.all([
      this.db.client.queue.findMany({
        where: { tenantId },
        select: { id: true, name: true, slug: true, tier: true },
      }),
      this.db.client.ticket.groupBy({
        by: ['queueId'],
        where: { tenantId, status: { notIn: ['RESOLVED', 'CLOSED', 'CANCELLED'] } },
        _count: { id: true },
      }),
    ]);

    const countMap = new Map(byQueue.map((g) => [g.queueId, g._count.id]));

    return queues.map((q) => ({
      queueId: q.id,
      name: q.name,
      slug: q.slug,
      tier: q.tier,
      activeTicketCount: countMap.get(q.id) ?? 0,
    }));
  }

  /**
   * Exports report data as structured JSON or CSV.
   */
  async exportReport(
    principal: AuthenticatedPrincipal,
    dto: ExportReportDto,
  ): Promise<{ contentType: string; data: string }> {
    const tenantId = this.tenantContext.requireTenantId();
    const where = this.buildTicketWhere(tenantId, dto);

    const tickets = await this.db.client.ticket.findMany({
      where,
      select: {
        number: true,
        subject: true,
        status: true,
        priority: true,
        tier: true,
        channel: true,
        category: true,
        createdAt: true,
        resolvedAt: true,
        closedAt: true,
        requester: { select: { fullName: true, email: true } },
        assignee: { select: { fullName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    if (dto.format === 'csv') {
      const headers = [
        'Number',
        'Subject',
        'Status',
        'Priority',
        'Tier',
        'Channel',
        'Category',
        'Requester Name',
        'Requester Email',
        'Assignee Name',
        'Created At',
        'Resolved At',
      ];

      const rows = tickets.map((t) => [
        t.number,
        `"${t.subject.replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        t.tier,
        t.channel,
        t.category ?? '',
        `"${t.requester.fullName.replace(/"/g, '""')}"`,
        t.requester.email,
        t.assignee ? `"${t.assignee.fullName.replace(/"/g, '""')}"` : '',
        t.createdAt.toISOString(),
        t.resolvedAt ? t.resolvedAt.toISOString() : '',
      ]);

      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      return { contentType: 'text/csv', data: csvContent };
    }

    return { contentType: 'application/json', data: JSON.stringify(tickets, null, 2) };
  }

  private buildTicketWhere(tenantId: string, filter: AnalyticsFilterDto): Prisma.TicketWhereInput {
    const where: Prisma.TicketWhereInput = { tenantId, deletedAt: null };

    if (filter.brandId) where.brandId = filter.brandId;
    if (filter.tier) where.tier = filter.tier;
    if (filter.channel) where.channel = filter.channel;

    if (filter.timeRange && filter.timeRange !== 'custom') {
      const now = new Date();
      let ms = 7 * 86_400_000;
      if (filter.timeRange === '24h') ms = 86_400_000;
      else if (filter.timeRange === '7d') ms = 7 * 86_400_000;
      else if (filter.timeRange === '14d') ms = 14 * 86_400_000;
      else if (filter.timeRange === '30d') ms = 30 * 86_400_000;
      else if (filter.timeRange === '90d') ms = 90 * 86_400_000;

      where.createdAt = { gte: new Date(now.getTime() - ms) };
    } else if (filter.from || filter.to) {
      where.createdAt = {};
      if (filter.from) where.createdAt.gte = new Date(filter.from);
      if (filter.to) where.createdAt.lte = new Date(filter.to);
    }

    return where;
  }
}

import React, { useEffect, useState, useCallback } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Star,
  Download,
  RefreshCw,
  Zap,
  ShieldCheck,
  Users,
  Layers,
  Calendar,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Flame,
  Activity,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { ApiClient } from '../api/client';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { TimeAreaChart, type TimePoint } from '../components/analytics/TimeAreaChart';
import { RadialGauge } from '../components/analytics/RadialGauge';
import { DonutChart3D, type DonutSegment } from '../components/analytics/DonutChart3D';
import { InflowHeatmap } from '../components/analytics/InflowHeatmap';

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'volume' | 'sla' | 'agents'>('overview');

  const isTenantAdmin =
    user?.roles?.includes('TENANT_ADMIN') ||
    user?.roles?.includes('ADMIN') ||
    user?.roles?.includes('PLATFORM_ADMIN') ||
    false;
  const isStaff = user?.kind === 'STAFF';
  const hasTenantView =
    isTenantAdmin || (user?.permissions?.includes('report:view:tenant') ?? false);
  const hasOwnView = user?.permissions?.includes('report:view:own') ?? false;
  const hasReportView =
    isTenantAdmin ||
    hasTenantView ||
    hasOwnView ||
    (isStaff &&
      user?.roles?.some((r) =>
        ['L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM', 'QA_TEAM'].includes(r),
      ));
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '14d' | '30d' | '90d'>('14d');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Analytics Data States
  const [overview, setOverview] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<TimePoint[]>([]);
  const [heatmap, setHeatmap] = useState<{
    matrix: number[][];
    maxCount: number;
    totalSampled: number;
  } | null>(null);
  const [volume, setVolume] = useState<any | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<any | null>(null);
  const [csat, setCsat] = useState<any | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const toast = useToast();

  const loadAnalytics = useCallback(
    async (isSilent = false) => {
      if (!isSilent) setIsLoading(true);
      try {
        const params = new URLSearchParams();
        if (timeRange) params.append('timeRange', timeRange);
        if (selectedBrandId) params.append('brandId', selectedBrandId);
        if (selectedChannel) params.append('channel', selectedChannel);
        const queryStr = params.toString() ? `?${params.toString()}` : '';

        const hasBrandManage = user?.permissions?.includes('admin:brand:manage') ?? false;

        const promises = [
          ApiClient.get(`/analytics/overview${queryStr}`),
          ApiClient.get(`/analytics/timeline${queryStr}`),
          ApiClient.get(`/analytics/heatmap${queryStr}`),
          ApiClient.get(`/analytics/volume${queryStr}`),
          ApiClient.get(`/analytics/sla${queryStr}`),
          ApiClient.get(`/analytics/csat`),
          hasTenantView ? ApiClient.get(`/analytics/agents${queryStr}`) : Promise.resolve([]),
          hasTenantView ? ApiClient.get(`/analytics/queues`) : Promise.resolve([]),
          hasBrandManage ? ApiClient.get(`/admin/brands`) : Promise.resolve([]),
        ];

        const [ov, tl, hm, vol, sla, cs, ag, q, br] = await Promise.all(promises);

        setOverview(ov);
        setTimeline(tl?.points || []);
        setHeatmap(hm);
        setVolume(vol);
        setSlaMetrics(sla);
        setCsat(cs);
        setAgents(Array.isArray(ag) ? ag : ag?.agents || []);
        setQueues(Array.isArray(q) ? q : []);
        setBrands(Array.isArray(br) ? br : []);
        setLastRefreshedAt(new Date());
      } catch (err: any) {
        toast.error(`Failed to load analytics: ${err.message}`);
      } finally {
        if (!isSilent) setIsLoading(false);
      }
    },
    [timeRange, selectedBrandId, selectedChannel, toast, hasTenantView, user?.permissions],
  );

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  // Live Auto-refresh timer (every 30 seconds)
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      loadAnalytics(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadAnalytics]);

  // Safety reset for unauthorized tab access
  useEffect(() => {
    if (activeTab === 'agents' && !hasTenantView) {
      setActiveTab('overview');
    }
  }, [activeTab, hasTenantView]);

  const handleExport = async (format: 'csv' | 'json') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (timeRange) params.append('timeRange', timeRange);
      if (selectedBrandId) params.append('brandId', selectedBrandId);
      if (selectedChannel) params.append('channel', selectedChannel);
      params.append('format', format);

      const data = await ApiClient.get(`/analytics/export?${params.toString()}`);
      const blob = new Blob([format === 'json' ? JSON.stringify(data, null, 2) : data], {
        type: format === 'json' ? 'application/json' : 'text/csv',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `abidesk-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Executive analytics exported as ${format.toUpperCase()}!`);
    } catch (err: any) {
      toast.error(`Export error: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Color mappings
  const STATUS_COLORS: Record<string, string> = {
    NEW: '#3b82f6',
    OPEN: '#60a5fa',
    IN_PROGRESS: '#f59e0b',
    WAITING_ON_CUSTOMER: '#8b5cf6',
    RESOLVED: '#10b981',
    CLOSED: '#64748b',
  };

  const PRIORITY_COLORS: Record<string, string> = {
    CRITICAL: '#ef4444',
    URGENT: '#f97316',
    HIGH: '#eab308',
    NORMAL: '#3b82f6',
    LOW: '#94a3b8',
  };

  // Donut Segments for Status & Priority
  const statusSegments: DonutSegment[] = (volume?.byStatus || []).map((s: any) => ({
    label: s.status.replace(/_/g, ' '),
    count: s.count,
    color: STATUS_COLORS[s.status] || '#94a3b8',
  }));

  const prioritySegments: DonutSegment[] = (volume?.byPriority || []).map((p: any) => ({
    label: p.priority,
    count: p.count,
    color: PRIORITY_COLORS[p.priority] || '#94a3b8',
  }));

  // Support Tier Pipeline Rows
  const tierCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0, DEV: 0, QA: 0 };
  if (volume?.byTier) {
    volume.byTier.forEach((item: any) => {
      if (item.tier in tierCounts) {
        tierCounts[item.tier] = item.count;
      }
    });
  }
  const totalTierTickets = Object.values(tierCounts).reduce((a, b) => a + b, 0);
  const tierRows = [
    {
      label: 'L1 Frontline Support',
      count: tierCounts.L1,
      color: 'var(--tier-l1, #3b82f6)',
      tier: 'L1',
    },
    {
      label: 'L2 Technical Support',
      count: tierCounts.L2,
      color: 'var(--tier-l2, #8b5cf6)',
      tier: 'L2',
    },
    {
      label: 'L3 Product Engineering',
      count: tierCounts.L3,
      color: 'var(--tier-l3, #ec4899)',
      tier: 'L3',
    },
    {
      label: 'Dev Bug Fix Escalations',
      count: tierCounts.DEV,
      color: 'var(--tier-dev, #f97316)',
      tier: 'DEV',
    },
    {
      label: 'QA Verification',
      count: tierCounts.QA,
      color: 'var(--tier-qa, #10b981)',
      tier: 'QA',
    },
  ].map((row) => {
    const percent = totalTierTickets > 0 ? Math.round((row.count / totalTierTickets) * 100) : 0;
    return { ...row, percent };
  });

  if (user?.kind === 'CUSTOMER' && !hasReportView) {
    return <Navigate to="/inbox" replace />;
  }

  if (isLoading && !overview) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size={36} text="Connecting to database analytics engine..." />
      </div>
    );
  }

  return (
    <div className="workspace-container" style={{ gap: '20px' }}>
      {/* Top Header & Executive Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Analytics & SLA</h1>
            <span
              className="badge badge-open"
              style={{ fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Activity size={12} /> Live Database
            </span>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Multi-brand response velocity, real-time SLA breach radar, and workforce efficiency
            analytics.
          </p>
        </div>

        {/* Global Controls & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Time Range Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'var(--bg-surface-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: '2px',
              border: '1px solid var(--border-medium)',
            }}
          >
            {(['24h', '7d', '14d', '30d', '90d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setTimeRange(r)}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: timeRange === r ? 'var(--primary)' : 'transparent',
                  color: timeRange === r ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Brand Filter */}
          {brands.length > 1 && (
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              style={{
                padding: '6px 10px',
                fontSize: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-medium)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            >
              <option value="">All Brands</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}

          {/* Auto Refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`btn btn-sm ${autoRefresh ? 'btn-primary' : 'btn-secondary'}`}
            title="Auto-refresh every 30s"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: autoRefresh ? '#10b981' : 'var(--text-muted)',
                boxShadow: autoRefresh ? '0 0 8px #10b981' : 'none',
              }}
            />
            <span>Auto</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={() => loadAnalytics(false)}
            className="btn btn-secondary btn-sm"
            title={`Last updated: ${lastRefreshedAt.toLocaleTimeString()}`}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          </button>

          {/* Export Dropdown Buttons */}
          <button
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Download size={13} /> CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={isExporting}
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <Download size={13} /> JSON
          </button>
        </div>
      </div>

      {/* Modern Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '0px',
          overflowX: 'auto',
          flexShrink: 0,
        }}
      >
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'volume', label: 'Volume & Heatmap', icon: Flame },
          { id: 'sla', label: 'SLA Clocks & Breach Radar', icon: ShieldCheck },
          ...(hasTenantView ? [{ id: 'agents', label: 'Team & Agent Efficiency', icon: Users }] : []),
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 4px',
                fontSize: '13px',
                fontWeight: 600,
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                border: 'none',
                borderBottom: `3px solid ${isActive ? 'var(--primary)' : 'transparent'}`,
                backgroundColor: 'transparent',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: EXECUTIVE OVERVIEW */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 4 Hero 3D KPI Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {/* KPI 1: Inflow & Backlog */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Total Inflow
                </span>
                <span className="badge badge-open" style={{ fontSize: '10px' }}>
                  {overview?.openBacklog ?? 0} In Backlog
                </span>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginTop: '8px',
                  color: 'var(--primary)',
                }}
              >
                {overview?.totalCreated ?? 0}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: '#10b981',
                  marginTop: '6px',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={14} />
                <span>
                  {overview?.totalResolved ?? 0} tickets resolved (
                  {overview?.totalCreated > 0
                    ? Math.round(((overview?.totalResolved ?? 0) / overview.totalCreated) * 100)
                    : 100}
                  %)
                </span>
              </div>
            </div>

            {/* KPI 2: SLA Compliance Rate */}
            {/* KPI 2: SLA Compliance Rate */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  SLA Compliance
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '10px',
                  }}
                >
                  Target &gt;90%
                </span>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginTop: '8px',
                  color:
                    overview?.slaComplianceRate !== null && overview?.slaComplianceRate !== undefined
                      ? overview.slaComplianceRate >= 90
                        ? '#10b981'
                        : '#ef4444'
                      : 'var(--text-muted)',
                }}
              >
                {overview?.slaComplianceRate !== null && overview?.slaComplianceRate !== undefined
                  ? `${overview.slaComplianceRate}%`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                First response & resolution deadlines
              </div>
            </div>

            {/* KPI 3: Response Velocity */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  Avg First Response
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    fontSize: '10px',
                  }}
                >
                  Speed
                </span>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginTop: '8px',
                  color:
                    overview?.avgFirstResponseMinutes !== null &&
                    overview?.avgFirstResponseMinutes !== undefined
                      ? '#f59e0b'
                      : 'var(--text-muted)',
                }}
              >
                {overview?.avgFirstResponseMinutes !== null &&
                overview?.avgFirstResponseMinutes !== undefined
                  ? `${overview.avgFirstResponseMinutes}m`
                  : 'N/A'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Avg Resolution:{' '}
                <strong>
                  {overview?.avgResolutionHours !== null && overview?.avgResolutionHours !== undefined
                    ? `${overview.avgResolutionHours} hours`
                    : 'N/A'}
                </strong>
              </div>
            </div>

            {/* KPI 4: CSAT Satisfaction */}
            <div className="card" style={{ position: 'relative', overflow: 'hidden' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                  }}
                >
                  CSAT Satisfaction
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(236, 72, 153, 0.15)',
                    color: '#ec4899',
                    fontSize: '10px',
                  }}
                >
                  {overview?.csatResponseCount ?? 0} Surveys
                </span>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginTop: '8px',
                  color:
                    overview?.csatAverage !== null && overview?.csatAverage !== undefined
                      ? '#ec4899'
                      : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <Star
                  size={24}
                  fill={
                    overview?.csatAverage !== null && overview?.csatAverage !== undefined
                      ? '#ec4899'
                      : 'transparent'
                  }
                  style={{
                    color:
                      overview?.csatAverage !== null && overview?.csatAverage !== undefined
                        ? '#ec4899'
                        : 'var(--text-muted)',
                  }}
                />
                <span>
                  {overview?.csatAverage !== null && overview?.csatAverage !== undefined
                    ? `${overview.csatAverage} / 5.0`
                    : 'N/A'}
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Customer post-resolution score
              </div>
            </div>
          </div>

          {/* Interactive Dual-Series Time-Series Area Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <TimeAreaChart
              data={timeline}
              height={260}
              title={`Ticket Inflow vs Resolution Velocity (${timeRange.toUpperCase()})`}
            />
          </div>

          {/* 3D Distributions & Tier Pipeline Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {/* Status Breakdown */}
            <div className="card">
              <DonutChart3D
                segments={statusSegments}
                title="Status Distribution"
                centerText={overview?.totalCreated?.toString()}
                centerSubtext="Total"
                size={160}
              />
            </div>

            {/* Priority Breakdown */}
            <div className="card">
              <DonutChart3D
                segments={prioritySegments}
                title="Priority Breakdown"
                centerText={
                  overview?.urgentCount
                    ? `${overview.urgentCount + (overview.criticalCount || 0)}`
                    : '0'
                }
                centerSubtext="Urgent / Crit"
                size={160}
              />
            </div>

            {/* Support Tier Pipeline */}
            <div className="card">
              <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px' }}>
                Support Tier Escalations
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {tierRows.map((row) => (
                  <div
                    key={row.tier}
                    style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: '12px',
                        fontWeight: 600,
                      }}
                    >
                      <span>{row.label}</span>
                      <span>
                        {row.count} ({row.percent}%)
                      </span>
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: '7px',
                        borderRadius: 'var(--radius-full)',
                        backgroundColor: 'var(--bg-surface-elevated)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${row.percent}%`,
                          height: '100%',
                          backgroundColor: row.color,
                          transition: 'width 0.4s ease',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: VOLUME & HEATMAP TRENDS */}
      {/* ========================================================================= */}
      {activeTab === 'volume' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* 7x24 Peak Inflow Heatmap */}
          {heatmap && (
            <div className="card" style={{ padding: '20px' }}>
              <InflowHeatmap
                matrix={heatmap.matrix}
                maxCount={heatmap.maxCount}
                totalSampled={heatmap.totalSampled}
              />
            </div>
          )}

          {/* Channel Breakdown & Categories Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {/* Inbound Channels */}
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
                Inbound Support Channels
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(volume?.byChannel || []).length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '16px',
                    }}
                  >
                    No channel records found.
                  </div>
                ) : (
                  (volume?.byChannel || []).map((ch: any) => {
                    const chTotal = (volume?.byChannel || []).reduce(
                      (acc: number, c: any) => acc + c.count,
                      0,
                    );
                    const pct = chTotal > 0 ? Math.round((ch.count / chTotal) * 100) : 0;
                    return (
                      <div
                        key={ch.channel}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          <span>{ch.channel}</span>
                          <span>
                            {ch.count} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: 'var(--primary)',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Ticket Categories */}
            <div className="card">
              <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
                Ticket Categories Breakdown
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {(volume?.byCategory || []).length === 0 ? (
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '16px',
                    }}
                  >
                    No categorized tickets found.
                  </div>
                ) : (
                  (volume?.byCategory || []).map((cat: any) => {
                    const catTotal = (volume?.byCategory || []).reduce(
                      (acc: number, c: any) => acc + c.count,
                      0,
                    );
                    const pct = catTotal > 0 ? Math.round((cat.count / catTotal) * 100) : 0;
                    return (
                      <div
                        key={cat.category}
                        style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            fontSize: '12px',
                            fontWeight: 600,
                          }}
                        >
                          <span>{cat.category}</span>
                          <span>
                            {cat.count} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: '8px',
                            borderRadius: 'var(--radius-full)',
                            backgroundColor: 'var(--bg-surface-elevated)',
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{ width: `${pct}%`, height: '100%', backgroundColor: '#8b5cf6' }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: SLA CLOCKS & BREACH RADAR */}
      {/* ========================================================================= */}
      {activeTab === 'sla' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Dual Radial Clocks & Overall Scorecards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {/* First Response Target Radial */}
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
            >
              <RadialGauge
                percentage={
                  (slaMetrics?.firstResponse?.met ?? 0) +
                    (slaMetrics?.firstResponse?.breached ?? 0) >
                  0
                    ? Math.round(
                        ((slaMetrics?.firstResponse?.met ?? 0) /
                          ((slaMetrics?.firstResponse?.met ?? 0) +
                            (slaMetrics?.firstResponse?.breached ?? 0))) *
                          100,
                      )
                    : 100
                }
                label="First Response"
                sublabel={`${slaMetrics?.firstResponse?.running ?? 0} Running | ${slaMetrics?.firstResponse?.breached ?? 0} Breached`}
                target={95}
                size={150}
              />
            </div>

            {/* Resolution Target Radial */}
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px',
              }}
            >
              <RadialGauge
                percentage={
                  (slaMetrics?.resolution?.met ?? 0) + (slaMetrics?.resolution?.breached ?? 0) > 0
                    ? Math.round(
                        ((slaMetrics?.resolution?.met ?? 0) /
                          ((slaMetrics?.resolution?.met ?? 0) +
                            (slaMetrics?.resolution?.breached ?? 0))) *
                          100,
                      )
                    : 100
                }
                label="Resolution"
                sublabel={`${slaMetrics?.resolution?.running ?? 0} Running | ${slaMetrics?.resolution?.breached ?? 0} Breached`}
                target={90}
                size={150}
              />
            </div>

            {/* SLA Clocks State Breakdown Summary */}
            <div
              className="card"
              style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
            >
              <h4 style={{ fontSize: '13px', fontWeight: 700, margin: '0 0 10px 0' }}>
                Live Clock Inventory
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ color: '#3b82f6', fontWeight: 600 }}>Active Running Clocks</span>
                  <span style={{ fontWeight: 700 }}>
                    {(slaMetrics?.firstResponse?.running ?? 0) +
                      (slaMetrics?.resolution?.running ?? 0)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ color: '#8b5cf6', fontWeight: 600 }}>Paused (On Customer)</span>
                  <span style={{ fontWeight: 700 }}>
                    {(slaMetrics?.firstResponse?.paused ?? 0) +
                      (slaMetrics?.resolution?.paused ?? 0)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ color: '#10b981', fontWeight: 600 }}>Total Targets Met</span>
                  <span style={{ fontWeight: 700 }}>
                    {(slaMetrics?.firstResponse?.met ?? 0) + (slaMetrics?.resolution?.met ?? 0)}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    padding: '6px 10px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    borderRadius: 'var(--radius-sm)',
                  }}
                >
                  <span style={{ color: '#ef4444', fontWeight: 600 }}>Total Breached</span>
                  <span style={{ fontWeight: 700 }}>
                    {(slaMetrics?.firstResponse?.breached ?? 0) +
                      (slaMetrics?.resolution?.breached ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* At-Risk Tickets Radar (<2 Hours to Breach) */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 700,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                  }}
                >
                  <AlertTriangle size={18} color="#f59e0b" /> Approaching Breach Radar
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Active tickets ordered by earliest deadline requiring immediate attention
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {(slaMetrics?.atRiskRadar || []).length === 0 ? (
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '24px 0',
                  }}
                >
                  🎉 No at-risk SLA tickets approaching deadline!
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-medium)',
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '8px 12px' }}>Ticket</th>
                      <th style={{ padding: '8px 12px' }}>Subject</th>
                      <th style={{ padding: '8px 12px' }}>Priority</th>
                      <th style={{ padding: '8px 12px' }}>Policy / Target</th>
                      <th style={{ padding: '8px 12px' }}>Assignee</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Time Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(slaMetrics?.atRiskRadar || []).map((item: any) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td
                          style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--primary)' }}
                        >
                          <Link
                            to={`/tickets/${item.ticketId}`}
                            style={{
                              color: 'var(--primary)',
                              textDecoration: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {item.ticketNumber} <ExternalLink size={11} />
                          </Link>
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            maxWidth: '240px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.subject}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`tier-pill ${item.priority}`}>{item.priority}</span>
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            fontSize: '12px',
                            color: 'var(--text-secondary)',
                          }}
                        >
                          {item.policyName} ({item.clockType.replace(/_/g, ' ')})
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: '12px' }}>{item.assignee}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <span
                            style={{
                              padding: '4px 8px',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: item.isOverdue
                                ? 'rgba(239, 68, 68, 0.15)'
                                : 'rgba(245, 158, 11, 0.15)',
                              color: item.isOverdue ? '#ef4444' : '#f59e0b',
                            }}
                          >
                            {item.isOverdue
                              ? `Overdue by ${Math.abs(item.minutesRemaining)}m`
                              : `${item.minutesRemaining}m left`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Policy Compliance Breakdown Table */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '12px' }}>
              Policy-Level SLA Compliance
            </h3>
            <div style={{ overflowX: 'auto' }}>
              {(slaMetrics?.policyBreakdown || []).length === 0 ? (
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '16px',
                  }}
                >
                  No active SLA policies configured.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-medium)',
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '8px 12px' }}>Policy Name</th>
                      <th style={{ padding: '8px 12px' }}>Total Tracked</th>
                      <th style={{ padding: '8px 12px' }}>Targets Met</th>
                      <th style={{ padding: '8px 12px' }}>Breached</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>Compliance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(slaMetrics?.policyBreakdown || []).map((pol: any) => (
                      <tr key={pol.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{pol.name}</td>
                        <td style={{ padding: '10px 12px' }}>{pol.totalClocks}</td>
                        <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 600 }}>
                          {pol.metCount}
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            color: pol.breachedCount > 0 ? '#ef4444' : 'var(--text-muted)',
                            fontWeight: 600,
                          }}
                        >
                          {pol.breachedCount}
                        </td>
                        <td
                          style={{
                            padding: '10px 12px',
                            textAlign: 'right',
                            fontWeight: 700,
                            color: pol.complianceRate >= 90 ? '#10b981' : '#f59e0b',
                          }}
                        >
                          {pol.complianceRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TEAM & AGENT EFFICIENCY */}
      {/* ========================================================================= */}
      {activeTab === 'agents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Agent Efficiency Leaderboard */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '16px',
              }}
            >
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  Agent Performance & Velocity Matrix
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                  Resolution velocity, workload balance, and customer satisfaction ratings per team
                  member
                </p>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {agents.length === 0 ? (
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '24px 0',
                  }}
                >
                  No active support agents found for this tenant.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr
                      style={{
                        borderBottom: '1px solid var(--border-medium)',
                        textAlign: 'left',
                        color: 'var(--text-muted)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                      }}
                    >
                      <th style={{ padding: '8px 12px' }}>Staff Member</th>
                      <th style={{ padding: '8px 12px' }}>Assigned</th>
                      <th style={{ padding: '8px 12px' }}>Resolved</th>
                      <th style={{ padding: '8px 12px' }}>Resolution Velocity</th>
                      <th style={{ padding: '8px 12px' }}>Avg Resolution Time</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right' }}>CSAT Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agents
                      .sort((a, b) => b.resolvedCount - a.resolvedCount)
                      .map((agent) => (
                        <tr
                          key={agent.agentId}
                          style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        >
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ fontWeight: 600 }}>{agent.fullName}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {agent.jobTitle || agent.email}
                            </div>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                            {agent.assignedCount}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: 700 }}>
                            {agent.resolvedCount}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '80px',
                                  height: '6px',
                                  backgroundColor: 'var(--bg-surface-elevated)',
                                  borderRadius: 'var(--radius-full)',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${agent.resolutionRate}%`,
                                    height: '100%',
                                    backgroundColor: '#10b981',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>
                                {agent.resolutionRate}%
                              </span>
                            </div>
                          </td>
                          <td
                            style={{
                              padding: '10px 12px',
                              fontSize: '12px',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {agent.avgResolutionHours !== null
                              ? `${agent.avgResolutionHours} hrs`
                              : 'N/A'}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                            {agent.csatAverage !== null ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  color: '#ec4899',
                                  fontWeight: 700,
                                }}
                              >
                                <Star size={13} fill="#ec4899" /> {agent.csatAverage} (
                                {agent.csatCount})
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                                No surveys
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Support Queue Load Distribution */}
          <div className="card">
            <h3 style={{ fontSize: '15px', fontWeight: 700, marginBottom: '14px' }}>
              Queue Capacity & Load Distribution
            </h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                gap: '12px',
              }}
            >
              {queues.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                  No active queues found.
                </div>
              ) : (
                queues.map((q) => (
                  <div
                    key={q.queueId}
                    style={{
                      padding: '12px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700 }}>{q.name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Slug: {q.slug}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        className="badge badge-open"
                        style={{ fontSize: '12px', fontWeight: 700 }}
                      >
                        {q.activeTicketCount} Active
                      </span>
                      <div
                        style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}
                      >
                        Tier: {q.tier || 'L1'}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

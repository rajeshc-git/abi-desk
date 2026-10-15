import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
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
  Monitor,
  Search,
  X,
  ChevronDown,
  Check,
  Shuffle,
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

const formatDurationMinutes = (minutes?: number | null) => {
  if (minutes === null || minutes === undefined) return 'N/A';
  if (minutes < 1) return '< 1m';
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

const formatDurationHours = (hours?: number | null) => {
  if (hours === null || hours === undefined) return 'N/A';
  if (hours <= 0) return '0h';
  if (hours < 1) {
    const m = Math.round(hours * 60);
    return `${m}m`;
  }
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
};

export const AnalyticsPage: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'volume' | 'sla' | 'agents' | 'queues'>('overview');

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
        ['L1_SUPPORT', 'L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM', 'DEVOPS_TEAM', 'QA_TEAM'].includes(r),
      ));
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '14d' | '30d' | '90d'>('14d');
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedChannel, setSelectedChannel] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [agentStatusFilter, setAgentStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');
  const [isAgentFilterOpen, setIsAgentFilterOpen] = useState(false);
  const agentFilterRef = useRef<HTMLDivElement>(null);

  // Close agent status filter when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (agentFilterRef.current && !agentFilterRef.current.contains(e.target as Node)) {
        setIsAgentFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
  const [agents, setAgents] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const [selectedQueueId, setSelectedQueueId] = useState<string>('');

  const activeSelectedQueue = useMemo(() => {
    if (!queues || queues.length === 0) return null;
    return queues.find((q) => q.queueId === selectedQueueId) || queues[0];
  }, [queues, selectedQueueId]);

  const queueStrategy = useMemo<'ROUND_ROBIN' | 'LEAST_LOADED' | 'MANUAL'>(() => {
    if (!activeSelectedQueue) return 'ROUND_ROBIN';
    if (activeSelectedQueue.routing) {
      if (activeSelectedQueue.routing === 'ROUND_ROBIN') return 'ROUND_ROBIN';
      if (activeSelectedQueue.routing === 'LEAST_LOADED') return 'LEAST_LOADED';
      if (activeSelectedQueue.routing === 'MANUAL') return 'MANUAL';
    }
    const s = `${activeSelectedQueue.name} ${activeSelectedQueue.slug}`.toLowerCase();
    if (s.includes('least') || s.includes('load')) return 'LEAST_LOADED';
    return 'ROUND_ROBIN';
  }, [activeSelectedQueue]);

  const strategyInfo = useMemo(() => {
    switch (queueStrategy) {
      case 'ROUND_ROBIN':
        return {
          badge: 'Round-Robin',
          title: 'Round-Robin Dispatch',
          subtitle: 'Sequential Distribution',
          color: '#8b5cf6',
          bg: 'rgba(139, 92, 246, 0.12)',
          border: 'rgba(139, 92, 246, 0.3)',
        };
      case 'LEAST_LOADED':
        return {
          badge: 'Least-Loaded',
          title: 'Least-Loaded Dispatch',
          subtitle: 'Dynamic Workload Balancing',
          color: '#0284c7',
          bg: 'rgba(2, 132, 199, 0.12)',
          border: 'rgba(2, 132, 199, 0.3)',
        };
      case 'MANUAL':
      default:
        return {
          badge: 'Manual Triage',
          title: 'Manual Assignment',
          subtitle: 'Staff Pick & Direct Routing',
          color: '#f59e0b',
          bg: 'rgba(245, 158, 11, 0.12)',
          border: 'rgba(245, 158, 11, 0.3)',
        };
    }
  }, [queueStrategy]);

  // Pipeline Agents: Active staff for live queue dispatch automation visualizer (guaranteed at least 8 agents in spider web)
  const pipelineAgents = useMemo(() => {
    const realAgents = [...(agents || [])].sort((a, b) => {
      if (a.isOnline && !b.isOnline) return -1;
      if (!a.isOnline && b.isOnline) return 1;
      return a.assignedCount - b.assignedCount;
    });

    const list = [...realAgents];
    const fallbackAgents = [
      { name: 'Alex M.', online: true, count: 2 },
      { name: 'Devon S.', online: true, count: 1 },
      { name: 'Sam K.', online: false, count: 3 },
      { name: 'Taylor B.', online: true, count: 0 },
      { name: 'Jordan R.', online: true, count: 4 },
      { name: 'Morgan C.', online: false, count: 1 },
      { name: 'Casey T.', online: true, count: 2 },
      { name: 'Robin L.', online: true, count: 0 },
    ];

    while (list.length < 8) {
      const idx = list.length;
      const fb = fallbackAgents[idx % fallbackAgents.length];
      list.push({
        agentId: `sim-agent-${idx + 1}`,
        fullName: fb.name,
        email: `${fb.name.toLowerCase().replace(/[^a-z]/g, '')}@abi.internal`,
        isOnline: fb.online,
        assignedCount: fb.count,
        role: 'AGENT',
      });
    }

    return list.slice(0, Math.max(8, realAgents.length));
  }, [agents]);

  const [activeDispatchAgentIdx, setActiveDispatchAgentIdx] = useState(0);

  useEffect(() => {
    if (pipelineAgents.length <= 1) return;
    if (queueStrategy === 'LEAST_LOADED') {
      const minLoad = Math.min(...pipelineAgents.map((a) => a.assignedCount));
      const leastIdx = pipelineAgents.findIndex((a) => a.assignedCount === minLoad);
      setActiveDispatchAgentIdx(leastIdx >= 0 ? leastIdx : 0);
      return;
    }
    const interval = setInterval(() => {
      setActiveDispatchAgentIdx((prev) => (prev + 1) % pipelineAgents.length);
    }, 900);
    return () => clearInterval(interval);
  }, [pipelineAgents, queueStrategy]);

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
          hasTenantView ? ApiClient.get(`/analytics/agents${queryStr}`) : Promise.resolve([]),
          hasTenantView ? ApiClient.get(`/analytics/queues`) : Promise.resolve([]),
          hasBrandManage ? ApiClient.get(`/admin/brands`) : Promise.resolve([]),
        ];

        const [ov, tl, hm, vol, sla, ag, q, br] = await Promise.all(promises);

        setOverview(ov);
        setTimeline(tl?.points || []);
        setHeatmap(hm);
        setVolume(vol);
        setSlaMetrics(sla);
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
    if ((activeTab === 'agents' || activeTab === 'queues') && !hasTenantView) {
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

  // Canonical ticket flow order (all 18 statuses in lifecycle progression)
  const TICKET_STATUS_FLOW = [
    { status: 'NEW', label: 'New', shortLabel: 'New', color: '#94a3b8' },
    { status: 'TRIAGE', label: 'Triage', shortLabel: 'Triage', color: '#64748b' },
    { status: 'OPEN', label: 'Open', shortLabel: 'Open', color: '#0284c7' },
    { status: 'IN_PROGRESS', label: 'In Progress', shortLabel: 'In Progress', color: '#f59e0b' },
    { status: 'PENDING_CUSTOMER', label: 'Pending Customer', shortLabel: 'Pending Cust.', color: '#d97706' },
    { status: 'ON_HOLD', label: 'On Hold', shortLabel: 'On Hold', color: '#ea580c' },
    { status: 'ESCALATED_L2', label: 'Escalated L2', shortLabel: 'Escalated L2', color: '#ec4899' },
    { status: 'ESCALATED_L3', label: 'Escalated L3', shortLabel: 'Escalated L3', color: '#d946ef' },
    { status: 'IN_DEVELOPMENT', label: 'In Development', shortLabel: 'In Dev', color: '#6366f1' },
    { status: 'IN_QA', label: 'In QA', shortLabel: 'In QA', color: '#8b5cf6' },
    { status: 'PENDING_RELEASE', label: 'Pending Release', shortLabel: 'Pend. Release', color: '#f97316' },
    { status: 'RELEASED', label: 'Released', shortLabel: 'Released', color: '#06b6d4' },
    { status: 'PENDING_VERIFICATION', label: 'Pending Verification', shortLabel: 'Pending Verif.', color: '#0ea5e9' },
    { status: 'AWAITING_CUSTOMER_CONFIRMATION', label: 'Awaiting Customer Confirmation', shortLabel: 'Cust. Confirm', color: '#3b82f6' },
    { status: 'RESOLVED', label: 'Resolved', shortLabel: 'Resolved', color: '#10b981' },
    { status: 'CLOSED', label: 'Closed', shortLabel: 'Closed', color: '#475569' },
    { status: 'REOPENED', label: 'Reopened', shortLabel: 'Reopened', color: '#f43f5e' },
    { status: 'CANCELLED', label: 'Cancelled', shortLabel: 'Cancelled', color: '#ef4444' },
  ];

  // Canonical priority order from highest severity to lowest
  const TICKET_PRIORITY_ORDER = [
    { priority: 'CRITICAL', label: 'Critical', color: '#ef4444' },
    { priority: 'URGENT', label: 'Urgent', color: '#f97316' },
    { priority: 'HIGH', label: 'High', color: '#eab308' },
    { priority: 'NORMAL', label: 'Normal', color: '#3b82f6' },
    { priority: 'LOW', label: 'Low', color: '#94a3b8' },
  ];

  // Donut Segments for Status (ordered strictly by ticket flow lifecycle, including all 18 statuses)
  const statusSegments: DonutSegment[] = useMemo(() => {
    const statusCountMap = new Map<string, number>();
    (volume?.byStatus || []).forEach((s: any) => {
      statusCountMap.set(s.status, s.count);
    });

    const knownKeys = new Set(TICKET_STATUS_FLOW.map((s) => s.status));
    const segments: DonutSegment[] = TICKET_STATUS_FLOW.map((item) => ({
      label: item.label,
      shortLabel: item.shortLabel,
      count: statusCountMap.get(item.status) ?? 0,
      color: item.color,
    }));

    // Safely append any unexpected custom status from backend if present
    (volume?.byStatus || []).forEach((s: any) => {
      if (!knownKeys.has(s.status)) {
        segments.push({
          label: (s.status || '').replace(/_/g, ' '),
          count: s.count,
          color: '#94a3b8',
        });
      }
    });

    return segments;
  }, [volume?.byStatus]);

  // Donut Segments for Priority (ordered strictly by severity Critical -> Low, ensuring all 5 always appear)
  const prioritySegments: DonutSegment[] = useMemo(() => {
    const priorityCountMap = new Map<string, number>();
    (volume?.byPriority || []).forEach((p: any) => {
      priorityCountMap.set(p.priority, p.count);
    });

    const knownKeys = new Set(TICKET_PRIORITY_ORDER.map((item) => item.priority));
    const segments: DonutSegment[] = TICKET_PRIORITY_ORDER.map((item) => ({
      label: item.label,
      count: priorityCountMap.get(item.priority) ?? 0,
      color: item.color,
    }));

    // Safely append any unexpected custom priority if present
    (volume?.byPriority || []).forEach((p: any) => {
      if (!knownKeys.has(p.priority)) {
        segments.push({
          label: p.priority,
          count: p.count,
          color: '#94a3b8',
        });
      }
    });

    return segments;
  }, [volume?.byPriority]);

  // Support Tier Pipeline Rows (all 6 tiers in workflow order with simplified labels)
  const tierCounts: Record<string, number> = { L1: 0, L2: 0, L3: 0, DEV: 0, DEVOPS: 0, QA: 0 };
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
      label: 'L1 Tier',
      count: tierCounts.L1,
      color: 'var(--tier-l1, #3b82f6)',
      tier: 'L1',
    },
    {
      label: 'L2 Tier',
      count: tierCounts.L2,
      color: 'var(--tier-l2, #8b5cf6)',
      tier: 'L2',
    },
    {
      label: 'L3 Tier',
      count: tierCounts.L3,
      color: 'var(--tier-l3, #ec4899)',
      tier: 'L3',
    },
    {
      label: 'Dev Tier',
      count: tierCounts.DEV,
      color: 'var(--tier-dev, #f97316)',
      tier: 'DEV',
    },
    {
      label: 'DevOps Tier',
      count: tierCounts.DEVOPS,
      color: 'var(--tier-devops, #d97706)',
      tier: 'DEVOPS',
    },
    {
      label: 'QA Tier',
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
    <div className="workspace-container analytics-page-wrapper" style={{ gap: '20px' }}>
      {/* Mobile & Portrait Tablet Screen Restriction Notice (< 1024px) */}
      <div className="analytics-mobile-restriction">
        <div className="analytics-restriction-card">
          <div className="analytics-restriction-icon-wrapper">
            <div className="analytics-restriction-icon-disc">
              <BarChart3 size={32} />
            </div>
            <div className="analytics-restriction-sub-disc">
              <Monitor size={16} />
            </div>
          </div>

          <div className="analytics-restriction-badge">
            <ShieldCheck size={13} />
            <span>Desktop & Landscape Tablet Experience</span>
          </div>

          <h2 className="analytics-restriction-title">
            Optimized for Widescreen Displays
          </h2>

          <p className="analytics-restriction-desc">
            Analytics & SLA dashboards feature high-density inflow heatmaps, interactive 3D breakdown models, and multi-column SLA timelines engineered specifically for larger screens.
          </p>

          <div className="analytics-restriction-specs">
            <div className="analytics-spec-item">
              <div className="analytics-spec-icon">💻</div>
              <div className="analytics-spec-info">
                <strong>Desktop & Laptop</strong>
                <span>Minimum width 1366 × 768</span>
              </div>
            </div>
            <div className="analytics-spec-item">
              <div className="analytics-spec-icon">📱</div>
              <div className="analytics-spec-info">
                <strong>Tablet (Landscape)</strong>
                <span>Minimum 1024 × 768 (iPad Mini or larger in landscape)</span>
              </div>
            </div>
          </div>

          <div className="analytics-restriction-actions">
            <Link
              to="/inbox"
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <Layers size={16} /> Open Ticket Inbox
            </Link>
            <Link
              to="/live-chat"
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                fontSize: '13px',
                fontWeight: 600,
                borderRadius: '8px',
              }}
            >
              <Activity size={16} /> Live Chat Desk
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop Dashboard (≥ 1024px) */}
      <div className="analytics-desktop-content">
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
          ...(hasTenantView ? [{ id: 'queues', label: 'Queue Capacity & Load Distribution', icon: Layers }] : []),
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
                  Total Tickets
                </span>
                <span className="badge badge-open" style={{ fontSize: '10px' }}>
                  {overview?.openBacklog ?? 0} In Progress
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
                  color: '#0284c7',
                  marginTop: '6px',
                  fontWeight: 600,
                }}
              >
                <Activity size={14} />
                <span>
                  {overview?.openBacklog ?? 0} active tickets in queue
                </span>
              </div>
            </div>

            {/* KPI 2: Completed Tickets */}
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
                  Completed Tickets
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {overview?.totalCreated > 0
                    ? Math.round(
                        (((overview?.totalClosed ?? 0) + (overview?.totalResolved ?? 0)) /
                          overview.totalCreated) *
                          100,
                      )
                    : 100}
                  % Resolved
                </span>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginTop: '8px',
                  color: '#10b981',
                }}
              >
                {(overview?.totalClosed ?? 0) + (overview?.totalResolved ?? 0)}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                }}
              >
                <CheckCircle2 size={13} style={{ color: '#10b981' }} />
                <span>
                  {overview?.totalClosed ?? 0} Closed · {overview?.totalResolved ?? 0} Resolved
                </span>
              </div>
            </div>

            {/* KPI 3: Response Velocity */}
            <div
              className="card"
              style={{ position: 'relative', overflow: 'hidden' }}
              title="Avg First Response: Average time until first staff reply. Avg Resolution: Average time until ticket is resolved."
            >
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
                    backgroundColor:
                      overview?.avgFirstResponseMinutes !== null &&
                      overview?.avgFirstResponseMinutes !== undefined &&
                      overview.avgFirstResponseMinutes <= 60
                        ? 'rgba(16, 185, 129, 0.15)'
                        : 'rgba(245, 158, 11, 0.15)',
                    color:
                      overview?.avgFirstResponseMinutes !== null &&
                      overview?.avgFirstResponseMinutes !== undefined &&
                      overview.avgFirstResponseMinutes <= 60
                        ? '#10b981'
                        : '#f59e0b',
                    fontSize: '10px',
                    fontWeight: 700,
                  }}
                >
                  {overview?.avgFirstResponseMinutes !== null &&
                  overview?.avgFirstResponseMinutes !== undefined &&
                  overview.avgFirstResponseMinutes <= 60
                    ? '⚡ Fast (<1h)'
                    : 'Speed'}
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
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                  flexWrap: 'wrap',
                }}
              >
                <span>{formatDurationMinutes(overview?.avgFirstResponseMinutes)}</span>
                {overview?.avgFirstResponseMinutes !== null &&
                  overview?.avgFirstResponseMinutes !== undefined &&
                  overview.avgFirstResponseMinutes >= 60 && (
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: 'var(--text-muted)',
                      }}
                    >
                      ({overview.avgFirstResponseMinutes}m)
                    </span>
                  )}
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  marginTop: '6px',
                }}
              >
                <Clock size={13} style={{ color: '#0284c7', flexShrink: 0 }} />
                <span>
                  Avg Resolution:{' '}
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {formatDurationHours(overview?.avgResolutionHours)}
                  </strong>
                </span>
              </div>
            </div>

            {/* KPI 4: Active Staff Online */}
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
                  Active Staff
                </span>
                <span
                  className="badge"
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '10px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                  }}
                >
                  <span
                    style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: '#10b981',
                      boxShadow: '0 0 6px #10b981',
                    }}
                  />
                  Live Presence
                </span>
              </div>
              <div
                style={{
                  fontSize: '28px',
                  fontWeight: 800,
                  marginTop: '8px',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: '6px',
                }}
              >
                <span>{overview?.onlineStaffCount ?? 0}</span>
                <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 600 }}>
                  / {overview?.totalStaffCount ?? agents.length} Online
                </span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                Currently active in workspace
              </div>
            </div>
          </div>

          {/* Interactive Dual-Series Time-Series Area Chart */}
          <div className="card" style={{ padding: '20px' }}>
            <TimeAreaChart
              data={timeline}
              height={260}
              title={`Ticket Created vs Ticket Resolved / Closed (${
                timeRange === '24h'
                  ? 'Last 24 Hours'
                  : timeRange === '7d'
                    ? 'Last 7 Days'
                    : timeRange === '14d'
                      ? 'Last 14 Days'
                      : timeRange === '30d'
                        ? 'Last 30 Days'
                        : timeRange === '90d'
                          ? 'Last 90 Days'
                          : 'Last 14 Days'
              })`}
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
            <div
              className="card"
              style={{
                height: '380px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  flexShrink: 0,
                }}
              >
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  Inbound Support Channels
                </h3>
                <span
                  className="badge"
                  style={{
                    fontSize: '11px',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {(volume?.byChannel || []).length} Channels
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: '6px',
                }}
              >
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
                  (() => {
                    const chTotal = (volume?.byChannel || []).reduce(
                      (acc: number, c: any) => acc + c.count,
                      0,
                    );
                    return (volume?.byChannel || []).map((ch: any) => {
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
                    });
                  })()
                )}
              </div>
            </div>

            {/* Ticket Categories */}
            <div
              className="card"
              style={{
                height: '380px',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '14px',
                  gap: '12px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                    Ticket Categories Breakdown
                  </h3>
                  <span
                    className="badge"
                    style={{
                      fontSize: '11px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-muted)',
                      fontWeight: 600,
                    }}
                  >
                    {(volume?.byCategory || []).length}
                  </span>
                </div>

                {/* Categories Quick Search */}
                <div style={{ position: 'relative', width: '180px' }}>
                  <Search
                    size={13}
                    style={{
                      position: 'absolute',
                      left: '8px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-muted)',
                      pointerEvents: 'none',
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Search categories..."
                    value={categorySearch}
                    onChange={(e) => setCategorySearch(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '5px 24px 5px 26px',
                      fontSize: '12px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-medium)',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                  />
                  {categorySearch && (
                    <button
                      onClick={() => setCategorySearch('')}
                      style={{
                        position: 'absolute',
                        right: '6px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        color: 'var(--text-muted)',
                      }}
                      title="Clear search"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflowY: 'auto',
                  flex: 1,
                  paddingRight: '6px',
                }}
              >
                {(() => {
                  const allCategories = volume?.byCategory || [];
                  const filtered = categorySearch.trim()
                    ? allCategories.filter((cat: any) =>
                        (cat.category || '')
                          .toLowerCase()
                          .includes(categorySearch.trim().toLowerCase()),
                      )
                    : allCategories;

                  if (allCategories.length === 0) {
                    return (
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
                    );
                  }

                  if (filtered.length === 0) {
                    return (
                      <div
                        style={{
                          fontSize: '13px',
                          color: 'var(--text-muted)',
                          textAlign: 'center',
                          padding: '24px 16px',
                        }}
                      >
                        No categories matching "{categorySearch}"
                      </div>
                    );
                  }

                  const catTotal = allCategories.reduce(
                    (acc: number, c: any) => acc + c.count,
                    0,
                  );

                  return filtered.map((cat: any) => {
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
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              backgroundColor: '#8b5cf6',
                            }}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
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

              {/* Status Filter Dropdown */}
              <div ref={agentFilterRef} style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setIsAgentFilterOpen(!isAgentFilterOpen)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-surface-elevated)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  title="Filter agents by online/offline status"
                >
                  {agentStatusFilter === 'ALL' && (
                    <>
                      <Users size={13} style={{ color: 'var(--text-muted)' }} />
                      <span>All Status</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--bg-surface)',
                          color: 'var(--text-muted)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        {agents.length}
                      </span>
                    </>
                  )}
                  {agentStatusFilter === 'ONLINE' && (
                    <>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          boxShadow: '0 0 6px #10b981',
                        }}
                      />
                      <span>Online</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: '#ecfdf5',
                          color: '#059669',
                          border: '1px solid #a7f3d0',
                        }}
                      >
                        {agents.filter((a) => !!a.isOnline).length}
                      </span>
                    </>
                  )}
                  {agentStatusFilter === 'OFFLINE' && (
                    <>
                      <span
                        style={{
                          width: '7px',
                          height: '7px',
                          borderRadius: '50%',
                          backgroundColor: '#94a3b8',
                        }}
                      />
                      <span>Offline</span>
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '1px 6px',
                          borderRadius: '10px',
                          backgroundColor: '#f1f5f9',
                          color: '#64748b',
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        {agents.filter((a) => !a.isOnline).length}
                      </span>
                    </>
                  )}
                  <ChevronDown
                    size={13}
                    style={{
                      color: 'var(--text-muted)',
                      transform: isAgentFilterOpen ? 'rotate(180deg)' : 'none',
                      transition: 'transform 0.15s ease',
                    }}
                  />
                </button>

                {/* Dropdown Menu */}
                {isAgentFilterOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      minWidth: '195px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-medium)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.25), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
                      padding: '4px',
                      zIndex: 50,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    {/* All Status Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgentStatusFilter('ALL');
                        setIsAgentFilterOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: agentStatusFilter === 'ALL' ? 'var(--bg-surface)' : 'transparent',
                        color: agentStatusFilter === 'ALL' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: agentStatusFilter === 'ALL' ? 600 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Users size={13} style={{ color: 'var(--text-muted)' }} />
                        <span>All Status</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            backgroundColor: 'var(--bg-surface)',
                            color: 'var(--text-muted)',
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
                          {agents.length}
                        </span>
                        {agentStatusFilter === 'ALL' && <Check size={13} style={{ color: 'var(--primary)' }} />}
                      </div>
                    </button>

                    {/* Online Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgentStatusFilter('ONLINE');
                        setIsAgentFilterOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: agentStatusFilter === 'ONLINE' ? 'var(--bg-surface)' : 'transparent',
                        color: agentStatusFilter === 'ONLINE' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: agentStatusFilter === 'ONLINE' ? 600 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: '#10b981',
                            boxShadow: '0 0 6px #10b981',
                            flexShrink: 0,
                          }}
                        />
                        <span>Online</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            backgroundColor: '#ecfdf5',
                            color: '#059669',
                            border: '1px solid #a7f3d0',
                          }}
                        >
                          {agents.filter((a) => !!a.isOnline).length}
                        </span>
                        {agentStatusFilter === 'ONLINE' && <Check size={13} style={{ color: '#059669' }} />}
                      </div>
                    </button>

                    {/* Offline Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setAgentStatusFilter('OFFLINE');
                        setIsAgentFilterOpen(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '7px 10px',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        backgroundColor: agentStatusFilter === 'OFFLINE' ? 'var(--bg-surface)' : 'transparent',
                        color: agentStatusFilter === 'OFFLINE' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '12px',
                        fontWeight: agentStatusFilter === 'OFFLINE' ? 600 : 500,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            backgroundColor: '#94a3b8',
                            flexShrink: 0,
                          }}
                        />
                        <span>Offline</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            padding: '1px 6px',
                            borderRadius: '10px',
                            backgroundColor: '#f1f5f9',
                            color: '#64748b',
                            border: '1px solid #e2e8f0',
                          }}
                        >
                          {agents.filter((a) => !a.isOnline).length}
                        </span>
                        {agentStatusFilter === 'OFFLINE' && <Check size={13} style={{ color: 'var(--primary)' }} />}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              {(() => {
                const filtered = agents.filter((a) => {
                  if (agentStatusFilter === 'ONLINE') return !!a.isOnline;
                  if (agentStatusFilter === 'OFFLINE') return !a.isOnline;
                  return true;
                });
                const sorted = [...filtered].sort((a, b) => b.resolvedCount - a.resolvedCount);

                if (agents.length === 0) {
                  return (
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
                  );
                }

                if (sorted.length === 0) {
                  return (
                    <div
                      style={{
                        fontSize: '13px',
                        color: 'var(--text-muted)',
                        textAlign: 'center',
                        padding: '24px 0',
                      }}
                    >
                      No agents are currently {agentStatusFilter.toLowerCase()}.
                    </div>
                  );
                }

                return (
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
                        <th style={{ padding: '8px 12px' }}>Status</th>
                        <th style={{ padding: '8px 12px' }}>Assigned</th>
                        <th style={{ padding: '8px 12px' }}>Resolved</th>
                        <th style={{ padding: '8px 12px' }}>Resolution Velocity</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right' }}>Avg Resolution Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map((agent) => (
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
                          <td style={{ padding: '10px 12px' }}>
                            {agent.isOnline ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 600,
                                  backgroundColor: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: '#10b981',
                                    boxShadow: '0 0 5px #10b981',
                                  }}
                                />
                                Online
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  backgroundColor: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <span
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: '#94a3b8',
                                  }}
                                />
                                Offline
                              </span>
                            )}
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
                                } }
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
                              textAlign: 'right',
                            }}
                          >
                            {formatDurationHours(agent.avgResolutionHours)}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              );
            })()}
          </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: QUEUE CAPACITY & LOAD DISTRIBUTION */}
      {/* ========================================================================= */}
      {activeTab === 'queues' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Support Queue Load Distribution & Live Dispatch Automation Pipeline */}
          <div className="card" style={{ padding: '16px 20px', position: 'relative', overflow: 'hidden' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '12px',
                flexWrap: 'wrap',
                gap: '8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0 }}>
                  Queue Capacity & Load Distribution
                </h3>
              </div>

              {/* Algorithm Status Pill (Updated dynamically to only show selected queue algorithm) */}
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: strategyInfo.bg,
                  border: `1px solid ${strategyInfo.border}`,
                  fontSize: '11px',
                  color: strategyInfo.color,
                  fontWeight: 700,
                  transition: 'all 0.2s ease',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: strategyInfo.color,
                    boxShadow: `0 0 6px ${strategyInfo.color}`,
                  }}
                />
                {strategyInfo.badge}
              </div>
            </div>

            {/* Layout: Interactive Queue List on Left, Animated Pipeline Visualizer on Right */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(250px, 310px) 1fr',
                gap: '16px',
                alignItems: 'stretch',
              }}
            >
              {/* Left Column: Interactive Queue Selector with Scroll for Multi-Queue */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '340px',
                  overflowY: 'auto',
                  paddingRight: '4px',
                }}
              >
                {queues.length === 0 ? (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    No active queues found.
                  </div>
                ) : (
                  queues.map((q) => {
                    const isSelected = q.queueId === activeSelectedQueue?.queueId;
                    return (
                      <div
                        key={q.queueId}
                        onClick={() => setSelectedQueueId(q.queueId)}
                        role="button"
                        tabIndex={0}
                        title={`Click to inspect ${q.name} automation pipeline`}
                        style={{
                          padding: '10px 14px',
                          borderRadius: 'var(--radius-md)',
                          backgroundColor: isSelected
                            ? 'var(--bg-surface)'
                            : 'var(--bg-surface-elevated)',
                          border: isSelected
                            ? '1.5px solid var(--primary)'
                            : '1px solid var(--border-subtle)',
                          boxShadow: isSelected
                            ? '0 0 10px rgba(2, 132, 199, 0.18)'
                            : 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '8px',
                              backgroundColor: isSelected
                                ? 'rgba(2, 132, 199, 0.18)'
                                : 'rgba(2, 132, 199, 0.08)',
                              color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Layers size={16} />
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 700,
                                lineHeight: 1.2,
                                color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                              }}
                            >
                              {q.name}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                              Slug: {q.slug}
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <span
                            className={isSelected ? 'badge badge-open' : 'badge'}
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: isSelected ? undefined : 'var(--bg-surface-elevated)',
                              color: isSelected ? undefined : 'var(--text-muted)',
                            }}
                          >
                            {q.activeTicketCount} Active
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Tier: {q.tier || 'L1'}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Live Dispatch Pipeline Flow Connected to Selected Queue */}
              <div
                style={{
                  height: '100%',
                  minHeight: '220px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  padding: '16px 20px 24px',
                  borderRadius: 'var(--radius-md)',
                  background:
                    'linear-gradient(135deg, rgba(2, 132, 199, 0.04) 0%, rgba(139, 92, 246, 0.05) 50%, rgba(16, 185, 129, 0.04) 100%)',
                  border: '1px solid var(--border-medium)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    width: '100%',
                  }}
                >
                  {/* Stage 1: Queue Inflow Source (reflecting currently selected queue) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <div
                      style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(2, 132, 199, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--primary)',
                        flexShrink: 0,
                      }}
                    >
                      <Zap size={15} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          fontWeight: 700,
                          color: 'var(--text-primary)',
                          maxWidth: '95px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={activeSelectedQueue?.name || 'Inflow Stream'}
                      >
                        {activeSelectedQueue?.name || 'Inflow Stream'}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {activeSelectedQueue?.activeTicketCount ?? 0} Active Inflow
                      </div>
                    </div>
                  </div>

                  {/* Animated Pipeline Cable 1 */}
                  <div
                    style={{
                      flex: '1 1 36px',
                      height: '2px',
                      backgroundColor: 'var(--border-medium)',
                      position: 'relative',
                      overflow: 'hidden',
                      minWidth: '24px',
                    }}
                  >
                    <div className="flow-laser-blue" />
                  </div>

                  {/* Stage 2: Intelligent Routing Core (reflecting selected queue algorithm) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 12px',
                      borderRadius: '20px',
                      backgroundColor: 'var(--bg-surface-elevated)',
                      border: `1px solid ${strategyInfo.border}`,
                      boxShadow: `0 0 12px ${strategyInfo.bg}`,
                      flexShrink: 0,
                      transition: 'all 0.25s ease',
                    }}
                  >
                    <div
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '50%',
                        backgroundColor: strategyInfo.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: strategyInfo.color,
                        flexShrink: 0,
                      }}
                    >
                      {queueStrategy === 'ROUND_ROBIN' ? (
                        <Shuffle size={12} className="spin-slow-icon" />
                      ) : (
                        <Activity size={12} />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: strategyInfo.color, lineHeight: 1.1 }}>
                        {strategyInfo.title}
                      </div>
                      <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {strategyInfo.subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Animated Pipeline Cable 2 */}
                  <div
                    style={{
                      flex: '1 1 36px',
                      height: '2px',
                      backgroundColor: 'var(--border-medium)',
                      position: 'relative',
                      overflow: 'hidden',
                      minWidth: '24px',
                    }}
                  >
                    <div className="flow-laser-green" />
                  </div>

                  {/* Stage 3: Target Staff Receptors (8 Staff in 2x4 Grid) */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, minmax(80px, 1fr))',
                      gap: '6px',
                      flexShrink: 0,
                      maxWidth: '440px',
                    }}
                  >
                    {pipelineAgents.map((ag, idx) => {
                      const isTarget = idx === activeDispatchAgentIdx;
                      const shortName = (ag.fullName || 'Agent').split(' ')[0];
                      return (
                        <div
                          key={ag.agentId}
                          title={`${ag.fullName} (${ag.isOnline ? 'Online' : 'Offline'}) · ${ag.assignedCount} active tickets`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px 7px',
                            borderRadius: '14px',
                            backgroundColor: isTarget
                              ? 'rgba(16, 185, 129, 0.16)'
                              : 'var(--bg-surface)',
                            border: isTarget
                              ? '1.5px solid #10b981'
                              : '1px solid var(--border-subtle)',
                            boxShadow: isTarget
                              ? '0 0 10px rgba(16, 185, 129, 0.45)'
                              : 'none',
                            transition: 'all 0.2s ease',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: ag.isOnline ? '#10b981' : '#94a3b8',
                              boxShadow: ag.isOnline && isTarget ? '0 0 6px #10b981' : 'none',
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: '10.5px',
                              fontWeight: isTarget ? 700 : 500,
                              color: isTarget ? '#059669' : 'var(--text-secondary)',
                              maxWidth: '50px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {shortName}
                          </span>
                          <span
                            style={{
                              fontSize: '9px',
                              padding: '1px 4px',
                              borderRadius: '6px',
                              backgroundColor: isTarget ? '#10b981' : 'var(--bg-surface-elevated)',
                              color: isTarget ? '#ffffff' : 'var(--text-muted)',
                              fontWeight: 700,
                              lineHeight: 1,
                              marginLeft: 'auto',
                            }}
                          >
                            {ag.assignedCount}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Extreme bottom & centered disclaimer */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: '6px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '9.5px',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    opacity: 0.75,
                    fontStyle: 'italic',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                >
                  * This illustration is for representative purposes only
                </div>
              </div>
            </div>

            {/* Micro CSS styles for fluid pipeline animation */}
            <style>{`
              @keyframes flowLaserAnim {
                0% { transform: translateX(-100%); opacity: 0; }
                25% { opacity: 1; }
                75% { opacity: 1; }
                100% { transform: translateX(100%); opacity: 0; }
              }
              .flow-laser-blue {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 65%;
                background: linear-gradient(90deg, transparent, #0284c7, transparent);
                animation: flowLaserAnim 0.9s infinite linear;
              }
              .flow-laser-green {
                position: absolute;
                top: 0;
                left: 0;
                height: 100%;
                width: 65%;
                background: linear-gradient(90deg, transparent, #10b981, transparent);
                animation: flowLaserAnim 0.9s infinite linear 0.45s;
              }
              @keyframes rotateSlow {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              .spin-slow-icon {
                animation: rotateSlow 8s infinite linear;
              }
            `}</style>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

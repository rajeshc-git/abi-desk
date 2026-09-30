import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Download,
  Calendar,
  Search,
  Users,
  User,
  CheckCircle2,
  Clock,
  TrendingUp,
  BarChart3,
  Award,
  Layers,
  RefreshCw,
  SlidersHorizontal,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Shield,
  Activity,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { LoadingSpinner } from '../common/LoadingSpinner';

export type ReportDatePreset =
  | 'today'
  | 'this_week'
  | '7days'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_year'
  | 'all'
  | 'custom';

interface PerformanceReportsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AgentPerformance {
  agentId: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  roles?: string[];
  teamNames?: string[];
  isOnline: boolean;
  assignedCount: number;
  resolvedCount: number;
  openCount: number;
  resolutionRate: number;
  avgResolutionHours: number | null;
  csatRating?: number | null;
}

interface TeamPerformance {
  teamId: string;
  name: string;
  slug?: string;
  tier?: string;
  description?: string;
  assignedCount: number;
  resolvedCount: number;
  openCount: number;
  resolutionRate: number;
  avgResolutionHours: number | null;
  memberCount: number;
  memberNames: string[];
  members: AgentPerformance[];
}

export const PerformanceReportsModal: React.FC<PerformanceReportsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'agents' | 'teams' | 'kpis'>('agents');
  const [preset, setPreset] = useState<ReportDatePreset>('this_month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Sorting state for Agents Table
  const [agentSortField, setAgentSortField] = useState<keyof AgentPerformance>('resolvedCount');
  const [agentSortDir, setAgentSortDir] = useState<'asc' | 'desc'>('desc');

  // Sorting state for Teams Table
  const [teamSortField, setTeamSortField] = useState<keyof TeamPerformance>('resolvedCount');
  const [teamSortDir, setTeamSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedTeamIds, setExpandedTeamIds] = useState<Set<string>>(new Set());

  const toggleTeamExpand = (teamId: string) => {
    setExpandedTeamIds((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) {
        next.delete(teamId);
      } else {
        next.add(teamId);
      }
      return next;
    });
  };

  // Raw data
  const [agents, setAgents] = useState<AgentPerformance[]>([]);
  const [teams, setTeams] = useState<TeamPerformance[]>([]);
  const [overview, setOverview] = useState<any>(null);

  // Calculate Date Ranges based on Preset
  const computeDateRange = (selectedPreset: ReportDatePreset): { start: string; end: string } => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    switch (selectedPreset) {
      case 'today':
        return { start: `${todayStr}T00:00:00.000Z`, end: `${todayStr}T23:59:59.999Z` };

      case 'this_week': {
        const dayOfWeek = now.getDay() || 7;
        const monday = new Date(now);
        monday.setDate(now.getDate() - dayOfWeek + 1);
        const mStr = monday.toISOString().split('T')[0];
        return { start: `${mStr}T00:00:00.000Z`, end: now.toISOString() };
      }

      case '7days': {
        const d = new Date(now);
        d.setDate(d.getDate() - 7);
        return { start: d.toISOString(), end: now.toISOString() };
      }

      case 'this_month': {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        const fStr = firstDay.toISOString().split('T')[0];
        return { start: `${fStr}T00:00:00.000Z`, end: now.toISOString() };
      }

      case 'last_month': {
        const firstDayLast = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDayLast = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
        return { start: firstDayLast.toISOString(), end: lastDayLast.toISOString() };
      }

      case 'this_quarter': {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        const qStart = new Date(now.getFullYear(), qMonth, 1);
        return { start: qStart.toISOString(), end: now.toISOString() };
      }

      case 'this_year': {
        const yStart = new Date(now.getFullYear(), 0, 1);
        return { start: yStart.toISOString(), end: now.toISOString() };
      }

      case 'all':
      default:
        return { start: '', end: '' };
    }
  };

  // Initial date setting when preset changes
  useEffect(() => {
    if (preset !== 'custom') {
      const { start, end } = computeDateRange(preset);
      setStartDate(start ? start.split('T')[0] : '');
      setEndDate(end ? end.split('T')[0] : '');
    }
  }, [preset]);

  // Load Report Data
  const fetchReportData = async () => {
    if (!isOpen) return;
    setIsLoading(true);
    try {
      let fromIso = '';
      let toIso = '';

      if (preset === 'custom') {
        if (startDate) fromIso = `${startDate}T00:00:00.000Z`;
        if (endDate) toIso = `${endDate}T23:59:59.999Z`;
      } else {
        const computed = computeDateRange(preset);
        fromIso = computed.start;
        toIso = computed.end;
      }

      const params = new URLSearchParams();
      if (fromIso) params.set('from', fromIso);
      if (toIso) params.set('to', toIso);
      const queryStr = params.toString() ? `?${params.toString()}` : '';

      const [agentsRes, queuesRes, teamsRes, usersRes, overviewRes] = await Promise.allSettled([
        ApiClient.get<any[]>(`/analytics/agents${queryStr}`).catch(() => []),
        ApiClient.get<any[]>('/analytics/queues').catch(() => []),
        ApiClient.get<any[]>('/admin/teams').catch(() => ApiClient.get('/teams').catch(() => [])),
        ApiClient.get<any[]>('/admin/users').catch(() => ApiClient.get('/users').catch(() => [])),
        ApiClient.get<any>(`/analytics/overview${queryStr}`).catch(() => null),
      ]);

      const rawAgents = agentsRes.status === 'fulfilled' && Array.isArray(agentsRes.value) ? agentsRes.value : [];
      const rawTeams = teamsRes.status === 'fulfilled' && Array.isArray(teamsRes.value) ? teamsRes.value : [];
      const rawUsers = usersRes.status === 'fulfilled' && Array.isArray(usersRes.value) ? usersRes.value : [];
      const rawQueues = queuesRes.status === 'fulfilled' && Array.isArray(queuesRes.value) ? queuesRes.value : [];

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value);
      }

      // Build User metadata map
      const userMetaMap = new Map<string, any>();
      rawUsers.forEach((u: any) => {
        userMetaMap.set(u.id, u);
      });

      // Build Team Members map
      const teamMembersMap = new Map<string, string[]>();
      rawTeams.forEach((t: any) => {
        const memberNames = (t.members || []).map((m: any) => m.user?.fullName || m.user?.email || 'Agent');
        teamMembersMap.set(t.id, memberNames);
      });

      // Enrich Agent Data
      const enrichedAgents: AgentPerformance[] = rawAgents.map((ag: any) => {
        const u = userMetaMap.get(ag.agentId);
        const roles = u?.roles?.map((r: any) => r.role?.name || r.role?.key || r) || [];
        const teamNames = u?.teamMembers?.map((tm: any) => tm.team?.name) || [];
        const open = Math.max(0, (ag.assignedCount || 0) - (ag.resolvedCount || 0));

        return {
          agentId: ag.agentId,
          fullName: ag.fullName || u?.fullName || 'Support Agent',
          email: ag.email || u?.email || '',
          jobTitle: ag.jobTitle || u?.jobTitle || '',
          roles: Array.isArray(roles) ? roles : [],
          teamNames: Array.isArray(teamNames) ? teamNames : [],
          isOnline: Boolean(ag.isOnline),
          assignedCount: ag.assignedCount || 0,
          resolvedCount: ag.resolvedCount || 0,
          openCount: open,
          resolutionRate: typeof ag.resolutionRate === 'number' ? ag.resolutionRate : (ag.assignedCount > 0 ? Math.round((ag.resolvedCount / ag.assignedCount) * 100) : 100),
          avgResolutionHours: ag.avgResolutionHours ?? null,
        };
      });

      setAgents(enrichedAgents);

      // Build Team Performance Data
      const teamPerfList: TeamPerformance[] = rawTeams.map((team: any) => {
        // Match member performance from assigned agents or user teamMemberships
        const teamAgents = enrichedAgents.filter((a) => {
          if (a.teamNames?.includes(team.name)) return true;
          const u = userMetaMap.get(a.agentId);
          return u?.teamMembers?.some((tm: any) => tm.teamId === team.id || tm.team?.id === team.id || tm.team?.name === team.name);
        });

        const memberList = teamAgents.map((a) => a.fullName || a.email);
        const totalAssigned = teamAgents.reduce((sum, a) => sum + a.assignedCount, 0);
        const totalResolved = teamAgents.reduce((sum, a) => sum + a.resolvedCount, 0);
        const totalOpen = Math.max(0, totalAssigned - totalResolved);
        const avgHoursList = teamAgents.map((a) => a.avgResolutionHours).filter((h): h is number => h !== null);
        const avgHours = avgHoursList.length > 0 ? Math.round((avgHoursList.reduce((a, b) => a + b, 0) / avgHoursList.length) * 10) / 10 : null;
        const rate = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 100;

        return {
          teamId: team.id,
          name: team.name,
          slug: team.slug,
          tier: team.tier || 'L1',
          description: team.description,
          assignedCount: totalAssigned,
          resolvedCount: totalResolved,
          openCount: totalOpen,
          resolutionRate: rate,
          avgResolutionHours: avgHours,
          memberCount: teamAgents.length || team.members?.length || memberList.length,
          memberNames: memberList,
          members: teamAgents,
        };
      });

      setTeams(teamPerfList);
    } catch (err: any) {
      toast.error(`Failed to load performance reports: ${err?.message || 'Server error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchReportData();
    }
  }, [isOpen, preset, startDate, endDate]);

  // Sorting handlers
  const handleAgentSort = (field: keyof AgentPerformance) => {
    if (agentSortField === field) {
      setAgentSortDir(agentSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setAgentSortField(field);
      setAgentSortDir('desc');
    }
  };

  const handleTeamSort = (field: keyof TeamPerformance) => {
    if (teamSortField === field) {
      setTeamSortDir(teamSortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setTeamSortField(field);
      setTeamSortDir('desc');
    }
  };

  // Filtered & Sorted Agents
  const filteredAgents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = agents.filter((a) => {
      const matchSearch =
        !q ||
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.jobTitle && a.jobTitle.toLowerCase().includes(q)) ||
        a.roles?.some((r) => r.toLowerCase().includes(q)) ||
        a.teamNames?.some((t) => t.toLowerCase().includes(q));

      const matchTier =
        tierFilter === 'all' ||
        a.roles?.some((r) => r.toUpperCase().includes(tierFilter.toUpperCase())) ||
        a.teamNames?.some((t) => t.toUpperCase().includes(tierFilter.toUpperCase()));

      return matchSearch && matchTier;
    });

    list.sort((a, b) => {
      const valA = a[agentSortField];
      const valB = b[agentSortField];
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return agentSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return agentSortDir === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    return list;
  }, [agents, searchQuery, tierFilter, agentSortField, agentSortDir]);

  // Filtered & Sorted Teams
  const filteredTeams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = teams.filter((t) => {
      const matchSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        (t.tier && t.tier.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q));

      const matchTier = tierFilter === 'all' || (t.tier && t.tier.toUpperCase() === tierFilter.toUpperCase());

      return matchSearch && matchTier;
    });

    list.sort((a, b) => {
      const valA = a[teamSortField];
      const valB = b[teamSortField];
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;
      if (typeof valA === 'string' && typeof valB === 'string') {
        return teamSortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return teamSortDir === 'asc' ? Number(valA) - Number(valB) : Number(valB) - Number(valA);
    });

    return list;
  }, [teams, searchQuery, tierFilter, teamSortField, teamSortDir]);

  // Summary Metrics
  const summaryKpis = useMemo(() => {
    const totalAssigned = agents.reduce((sum, a) => sum + a.assignedCount, 0);
    const totalResolved = agents.reduce((sum, a) => sum + a.resolvedCount, 0);
    const totalOpen = agents.reduce((sum, a) => sum + a.openCount, 0);
    const onlineCount = agents.filter((a) => a.isOnline).length;
    const avgVelocity = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 100;

    const topPerformer = [...agents].sort((a, b) => b.resolvedCount - a.resolvedCount)[0];

    const validHours = agents.map((a) => a.avgResolutionHours).filter((h): h is number => h !== null);
    const avgHours = validHours.length > 0 ? Math.round((validHours.reduce((a, b) => a + b, 0) / validHours.length) * 10) / 10 : null;

    return {
      totalStaff: agents.length,
      onlineStaff: onlineCount,
      totalAssigned,
      totalResolved,
      totalOpen,
      avgVelocity,
      avgHours,
      topPerformer: topPerformer && topPerformer.resolvedCount > 0 ? topPerformer : null,
    };
  }, [agents]);

  // Export Agent Report to CSV
  const exportAgentReportCsv = () => {
    if (filteredAgents.length === 0) {
      toast.error('No agent performance data to export.');
      return;
    }

    const headers = [
      'Staff Name',
      'Email',
      'Job Title / Role',
      'Assigned Teams',
      'Tickets Assigned',
      'Tickets Resolved',
      'Unresolved Tickets',
      'Resolution Velocity (%)',
      'Avg Resolution Time (Hours)',
    ];

    const rows = filteredAgents.map((a) => [
      `"${a.fullName.replace(/"/g, '""')}"`,
      `"${a.email}"`,
      `"${(a.jobTitle || a.roles?.join(', ') || 'Support Agent').replace(/"/g, '""')}"`,
      `"${(a.teamNames?.join(', ') || 'General Queue').replace(/"/g, '""')}"`,
      a.assignedCount,
      a.resolvedCount,
      a.openCount,
      `${a.resolutionRate}%`,
      a.avgResolutionHours !== null ? a.avgResolutionHours : 'N/A',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `Agent-Performance-Report_${preset}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Agent Performance CSV exported (${filteredAgents.length} staff members)!`);
  };

  // Export Team Report to CSV
  const exportTeamReportCsv = () => {
    if (filteredTeams.length === 0) {
      toast.error('No team performance data to export.');
      return;
    }

    const headers = [
      'Team Name',
      'Support Tier',
      'Staff Member Count',
      'Team Members',
      'Tickets Assigned',
      'Tickets Resolved',
      'Unresolved Tickets',
      'Team Resolution Rate (%)',
      'Avg Resolution Time (Hours)',
    ];

    const rows = filteredTeams.map((t) => [
      `"${t.name.replace(/"/g, '""')}"`,
      t.tier || 'L1',
      t.memberCount,
      `"${(t.memberNames?.join('; ') || '').replace(/"/g, '""')}"`,
      t.assignedCount,
      t.resolvedCount,
      t.openCount,
      `${t.resolutionRate}%`,
      t.avgResolutionHours !== null ? t.avgResolutionHours : 'N/A',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const dateStamp = new Date().toISOString().split('T')[0];
    link.href = url;
    link.setAttribute('download', `Team-Performance-Report_${preset}_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`Team Performance CSV exported (${filteredTeams.length} teams)!`);
  };

  if (!isOpen) return null;

  return (
    <div
      className="perf-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
      }}
      onClick={onClose}
    >
      <style>{`
        .perf-modal-window {
          width: 100%;
          max-width: 1280px;
          max-height: 94vh;
          height: 92vh;
          background-color: var(--bg-surface, #ffffff);
          border: 1px solid var(--border-medium, #e2e8f0);
          border-radius: 16px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .perf-modal-header {
          padding: 18px 24px;
          border-bottom: 1px solid var(--border-subtle, #e2e8f0);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background-color: var(--bg-surface-elevated, #f8fafc);
          flex-shrink: 0;
          gap: 16px;
        }
        .perf-header-main {
          display: flex;
          align-items: center;
          gap: 12px;
          flex: 1;
        }
        .perf-header-title-box {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .perf-header-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .perf-close-btn-desktop {
          display: flex;
        }
        .perf-close-btn-mobile {
          display: none;
        }
        .perf-presets-scroll {
          display: flex;
          align-items: center;
          gap: 6px;
          overflow-x: auto;
          overflow-y: hidden;
          width: 100%;
          max-width: 100%;
          min-width: 0;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .perf-presets-scroll::-webkit-scrollbar {
          display: none;
        }
        .perf-preset-btn {
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 12px;
          flex-shrink: 0;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .perf-tier-select {
          height: 34px;
          font-size: 13px;
          font-weight: 600;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid var(--border-medium, #e2e8f0);
          background-color: var(--bg-surface, #ffffff);
          color: var(--text-primary);
          cursor: pointer;
        }
        .perf-tier-select option {
          font-size: 14px;
          padding: 6px 10px;
          color: #0f172a;
          background-color: #ffffff;
        }
        .perf-refresh-btn {
          height: 34px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--border-medium, #e2e8f0);
          background-color: var(--bg-surface, #ffffff);
          color: var(--text-primary);
          font-size: 12px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .perf-kpi-grid {
          padding: 14px 24px;
          background-color: var(--bg-surface-elevated, #f8fafc);
          border-bottom: 1px solid var(--border-subtle, #e2e8f0);
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          flex-shrink: 0;
        }
        .perf-tabs-toolbar {
          padding: 12px 24px;
          border-bottom: 1px solid var(--border-subtle, #e2e8f0);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        }
        .perf-tabs-list {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .perf-search-box {
          position: relative;
          width: 280px;
        }
        .perf-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          width: 100%;
        }
        .perf-table-wrapper table th,
        .perf-table-wrapper table td {
          white-space: nowrap;
        }
        .perf-content-area {
          flex: 1;
          overflow-y: auto;
          padding: 16px 24px;
        }
        .perf-footer-bar {
          padding: 12px 24px;
          border-top: 1px solid var(--border-subtle, #e2e8f0);
          background-color: var(--bg-surface-elevated, #f8fafc);
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 12px;
          color: var(--text-muted, #64748b);
          flex-shrink: 0;
        }

        @media (max-width: 768px) {
          .perf-modal-overlay {
            padding: 0 !important;
          }
          .perf-modal-window {
            width: 100vw !important;
            height: 100dvh !important;
            max-height: 100dvh !important;
            border-radius: 0 !important;
            border: none !important;
          }
          .perf-modal-header {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 12px 14px !important;
            gap: 10px !important;
          }
          .perf-header-main {
            justify-content: space-between !important;
            align-items: flex-start !important;
            width: 100% !important;
          }
          .perf-close-btn-desktop {
            display: none !important;
          }
          .perf-close-btn-mobile {
            display: flex !important;
            flex-shrink: 0;
          }
          .perf-header-desc {
            font-size: 11.5px !important;
            line-height: 1.35;
          }
          .perf-header-actions {
            width: 100% !important;
          }
          .perf-header-actions button,
          .perf-header-actions .btn {
            width: 100% !important;
            justify-content: center !important;
          }
          .perf-filter-toolbar {
            padding: 10px 14px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
            width: 100% !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
          }
          .perf-presets-scroll {
            width: 100% !important;
            max-width: 100% !important;
            min-width: 0 !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            flex-wrap: nowrap !important;
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            padding: 2px 2px 6px 2px !important;
            -webkit-overflow-scrolling: touch !important;
            scrollbar-width: none !important;
            touch-action: pan-x !important;
          }
          .perf-presets-scroll::-webkit-scrollbar {
            display: none;
          }
          .perf-preset-btn {
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            font-size: 12.5px !important;
            padding: 6px 12px !important;
            touch-action: pan-x !important;
          }
          .perf-filter-controls {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            width: 100% !important;
            justify-content: space-between !important;
          }
          .perf-tier-select {
            flex: 1 !important;
            height: 38px !important;
            min-height: 38px !important;
            font-size: 14px !important;
            padding: 0 12px !important;
            border-radius: 8px !important;
          }
          .perf-tier-select option {
            font-size: 14px !important;
            padding: 8px 12px !important;
          }
          .perf-refresh-btn {
            height: 38px !important;
            min-height: 38px !important;
            padding: 0 14px !important;
            font-size: 13px !important;
            font-weight: 700 !important;
            border-radius: 8px !important;
          }
          .perf-kpi-grid {
            padding: 10px 14px !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .perf-kpi-card-wide {
            grid-column: span 2 !important;
          }
          .perf-tabs-toolbar {
            padding: 10px 14px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .perf-tabs-list {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            width: 100% !important;
            gap: 6px !important;
          }
          .perf-tabs-list button {
            justify-content: center !important;
            padding: 8px 10px !important;
            font-size: 11.5px !important;
          }
          .perf-search-box {
            width: 100% !important;
          }
          .perf-content-area {
            padding: 10px 14px !important;
          }
          .perf-table-wrapper {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
          }
          .perf-table-wrapper table th,
          .perf-table-wrapper table td {
            white-space: nowrap !important;
          }
          .perf-footer-bar {
            padding: 10px 14px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
            text-align: center !important;
          }
          .perf-footer-bar button {
            width: 100% !important;
          }
        }
      `}</style>

      <div
        className="perf-modal-window"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Modal Header */}
        <div className="perf-modal-header">
          <div className="perf-header-main">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                  color: 'var(--primary, #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 4px rgba(37, 99, 235, 0.15)',
                  flexShrink: 0,
                }}
              >
                <BarChart3 size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="perf-header-title-box">
                  <h2 style={{ fontSize: '16.5px', fontWeight: 800, margin: 0, color: 'var(--text-primary, #0f172a)', lineHeight: 1.2 }}>
                    Team & Agent Performance Reports
                  </h2>
                  <span
                    style={{
                      fontSize: '10.5px',
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: '10px',
                      backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                      color: 'var(--primary, #2563eb)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Analytics Suite
                  </span>
                </div>
                <p className="perf-header-desc" style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)', margin: '2px 0 0' }}>
                  Resolution velocity, workload balance, and performance matrices for individual staff and support teams.
                </p>
              </div>
            </div>

            {/* Mobile Close Button on Top Right */}
            <button
              type="button"
              onClick={onClose}
              className="perf-close-btn-mobile"
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #e2e8f0)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-muted, #64748b)',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Close Reports Modal"
            >
              <X size={18} />
            </button>
          </div>

          <div className="perf-header-actions">
            {activeTab === 'agents' ? (
              <button
                type="button"
                onClick={exportAgentReportCsv}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                }}
              >
                <Download size={14} /> Export Agent CSV ({filteredAgents.length})
              </button>
            ) : activeTab === 'teams' ? (
              <button
                type="button"
                onClick={exportTeamReportCsv}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '12.5px',
                  fontWeight: 700,
                  height: '36px',
                  padding: '0 14px',
                  borderRadius: '8px',
                }}
              >
                <Download size={14} /> Export Team CSV ({filteredTeams.length})
              </button>
            ) : (
              <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                <button
                  type="button"
                  onClick={exportAgentReportCsv}
                  className="btn btn-primary"
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                  }}
                >
                  <Download size={13} /> Agent CSV
                </button>
                <button
                  type="button"
                  onClick={exportTeamReportCsv}
                  className="btn btn-outline"
                  style={{
                    flex: 1,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    fontSize: '12px',
                    fontWeight: 700,
                    height: '34px',
                    padding: '0 12px',
                    borderRadius: '8px',
                  }}
                >
                  <Download size={13} /> Team CSV
                </button>
              </div>
            )}

            {/* Desktop Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="perf-close-btn-desktop"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #e2e8f0)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-muted, #64748b)',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Close Reports Modal"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Filter & Date Range Toolbar */}
        <div
          className="perf-filter-toolbar"
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexShrink: 0,
          }}
        >
          {/* Preset Buttons */}
          <div className="perf-presets-scroll">
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary, #475569)', marginRight: '4px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              <Calendar size={13} style={{ display: 'inline', verticalAlign: '-2px', marginRight: '4px' }} />
              Time Window:
            </span>
            {[
              { id: 'today', label: 'Today' },
              { id: 'this_week', label: 'This Week' },
              { id: '7days', label: 'Last 7 Days' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
              { id: 'this_quarter', label: 'This Quarter' },
              { id: 'this_year', label: 'This Year' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map((p) => {
              const isSelected = preset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id as ReportDatePreset)}
                  className="perf-preset-btn"
                  style={{
                    fontWeight: isSelected ? 700 : 500,
                    backgroundColor: isSelected ? 'var(--primary, #2563eb)' : 'var(--bg-surface-elevated, #f1f5f9)',
                    color: isSelected ? '#ffffff' : 'var(--text-secondary, #475569)',
                    border: `1px solid ${isSelected ? 'var(--primary, #2563eb)' : 'var(--border-subtle, #e2e8f0)'}`,
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Custom Date Inputs if Custom selected or extra filters */}
          <div className="perf-filter-controls">
            {preset === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  style={{
                    height: '34px',
                    fontSize: '12px',
                    padding: '0 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                  }}
                />
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  style={{
                    height: '34px',
                    fontSize: '12px',
                    padding: '0 6px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium, #e2e8f0)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                  }}
                />
              </div>
            )}

            {/* Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="perf-tier-select"
            >
              <option value="all">All Support Tiers</option>
              <option value="L1">L1 Support</option>
              <option value="L2">L2 Support</option>
              <option value="L3">L3 Support</option>
              <option value="DEV">Engineering / Dev</option>
              <option value="DEVOPS">DevOps / Infra</option>
              <option value="QA">QA Team</option>
            </select>

            <button
              type="button"
              onClick={fetchReportData}
              disabled={isLoading}
              className="perf-refresh-btn"
              title="Refresh Data"
            >
              <RefreshCw size={12} className={isLoading ? 'spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Executive KPI Scorecards */}
        <div className="perf-kpi-grid">
          {/* Card 1: Active Staff */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#eff6ff',
                color: '#2563eb',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Users size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Active Staff Roster</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {summaryKpis.totalStaff}{' '}
                <span style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600 }}>
                  ({summaryKpis.onlineStaff} Online)
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Total Assigned */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#f5f3ff',
                color: '#7c3aed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Activity size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Period Workload Assigned</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-primary)' }}>
                {summaryKpis.totalAssigned.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 3: Total Resolved */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Period Tickets Resolved</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                {summaryKpis.totalResolved.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 4: Avg Resolution Velocity */}
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#fffbeb',
                color: '#d97706',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <TrendingUp size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Avg Resolution Rate</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#d97706' }}>
                {summaryKpis.avgVelocity}%
              </div>
            </div>
          </div>

          {/* Card 5: Top Resolution Agent (Spans full width on mobile) */}
          <div
            className="perf-kpi-card-wide"
            style={{
              padding: '10px 14px',
              borderRadius: '10px',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                color: '#dc2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Award size={18} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Top Performer</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {summaryKpis.topPerformer ? summaryKpis.topPerformer.fullName : 'N/A'}
              </div>
              {summaryKpis.topPerformer && (
                <div style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600 }}>
                  {summaryKpis.topPerformer.resolvedCount} tickets resolved
                </div>
              )}
            </div>
          </div>
        </div>

        {/* View Selection & Search Bar */}
        <div className="perf-tabs-toolbar">
          {/* Navigation Tabs */}
          <div className="perf-tabs-list">
            <button
              type="button"
              onClick={() => setActiveTab('agents')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'agents' ? 700 : 600,
                backgroundColor: activeTab === 'agents' ? 'var(--primary, #2563eb)' : 'transparent',
                color: activeTab === 'agents' ? '#ffffff' : 'var(--text-secondary)',
                border: activeTab === 'agents' ? 'none' : '1px solid var(--border-subtle, #e2e8f0)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <User size={15} /> Individual Agents ({filteredAgents.length})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('teams')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: activeTab === 'teams' ? 700 : 600,
                backgroundColor: activeTab === 'teams' ? 'var(--primary, #2563eb)' : 'transparent',
                color: activeTab === 'teams' ? '#ffffff' : 'var(--text-secondary)',
                border: activeTab === 'teams' ? 'none' : '1px solid var(--border-subtle, #e2e8f0)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Users size={15} /> Team-wise Performance ({filteredTeams.length})
            </button>
          </div>

          {/* Search Bar */}
          <div className="perf-search-box">
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder={activeTab === 'agents' ? 'Search agent name, email, role...' : 'Search team name or tier...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                height: '34px',
                paddingLeft: '32px',
                paddingRight: searchQuery ? '30px' : '12px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #e2e8f0)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                fontSize: '12px',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Main Scrollable Table Area */}
        <div className="perf-content-area">
          {isLoading ? (
            <div style={{ padding: '60px 0', display: 'flex', justifyContent: 'center' }}>
              <LoadingSpinner size={36} text="Compiling detailed performance data..." />
            </div>
          ) : activeTab === 'agents' ? (
            /* ========================================================================= */
            /* TAB 1: INDIVIDUAL AGENTS TABLE */
            /* ========================================================================= */
            filteredAgents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <User size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  No Matching Staff Members Found
                </h4>
                <p style={{ fontSize: '12.5px', margin: 0 }}>Try clearing your search query or adjusting the date range filters.</p>
              </div>
            ) : (
              <div
                className="perf-table-wrapper"
                style={{
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                        borderBottom: '1px solid var(--border-medium, #e2e8f0)',
                        textAlign: 'left',
                        color: 'var(--text-secondary, #475569)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th
                        onClick={() => handleAgentSort('fullName')}
                        style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Staff Member
                          {agentSortField === 'fullName' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th style={{ padding: '10px 14px' }}>Roles & Teams</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center' }}>Live Status</th>
                      <th
                        onClick={() => handleAgentSort('assignedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Assigned
                          {agentSortField === 'assignedCount' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('resolvedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Resolved
                          {agentSortField === 'resolvedCount' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('openCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Unresolved
                          {agentSortField === 'openCount' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('resolutionRate')}
                        style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none', width: '170px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Resolution Velocity
                          {agentSortField === 'resolutionRate' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('avgResolutionHours')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Avg Resolution Time
                          {agentSortField === 'avgResolutionHours' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAgents.map((agent, index) => {
                      const isTop = index === 0 && agent.resolvedCount > 0 && agentSortField === 'resolvedCount';
                      return (
                        <tr
                          key={agent.agentId}
                          style={{
                            borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                            backgroundColor: isTop ? '#f0fdf4' : 'transparent',
                            transition: 'background-color 0.15s ease',
                          }}
                        >
                          {/* Staff Info */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                                  color: 'var(--primary, #2563eb)',
                                  fontWeight: 700,
                                  fontSize: '12px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {agent.fullName.substring(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {agent.fullName}
                                  {isTop && (
                                    <span
                                      style={{
                                        fontSize: '9.5px',
                                        backgroundColor: '#16a34a',
                                        color: '#ffffff',
                                        padding: '1px 5px',
                                        borderRadius: '4px',
                                        fontWeight: 800,
                                        letterSpacing: '0.03em',
                                      }}
                                    >
                                      #TOP
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>{agent.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Roles & Teams */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {agent.teamNames && agent.teamNames.length > 0 ? (
                                agent.teamNames.map((tm) => (
                                  <span
                                    key={tm}
                                    style={{
                                      fontSize: '10.5px',
                                      fontWeight: 600,
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: '#f1f5f9',
                                      color: '#334155',
                                    }}
                                  >
                                    {tm}
                                  </span>
                                ))
                              ) : (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>General Staff</span>
                              )}
                            </div>
                          </td>

                          {/* Online Status */}
                          <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                            {agent.isOnline ? (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  backgroundColor: '#ecfdf5',
                                  color: '#059669',
                                  border: '1px solid #a7f3d0',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                Online
                              </span>
                            ) : (
                              <span
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '12px',
                                  fontSize: '11px',
                                  fontWeight: 500,
                                  backgroundColor: '#f1f5f9',
                                  color: '#64748b',
                                  border: '1px solid #e2e8f0',
                                }}
                              >
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                                Offline
                              </span>
                            )}
                          </td>

                          {/* Assigned Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                            {agent.assignedCount}
                          </td>

                          {/* Resolved Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                            {agent.resolvedCount}
                          </td>

                          {/* Open Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: agent.openCount > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                            {agent.openCount}
                          </td>

                          {/* Resolution Velocity Bar */}
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: '7px',
                                  backgroundColor: 'var(--border-subtle, #e2e8f0)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${Math.min(100, agent.resolutionRate)}%`,
                                    height: '100%',
                                    backgroundColor: agent.resolutionRate >= 80 ? '#10b981' : agent.resolutionRate >= 50 ? '#f59e0b' : '#ef4444',
                                    borderRadius: '4px',
                                  }}
                                />
                              </div>
                              <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--text-primary)', width: '36px', textAlign: 'right' }}>
                                {agent.resolutionRate}%
                              </span>
                            </div>
                          </td>

                          {/* Avg Resolution Hours */}
                          <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                            {agent.avgResolutionHours !== null ? `${agent.avgResolutionHours} hrs` : 'N/A'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : (
            /* ========================================================================= */
            /* TAB 2: TEAM-WISE PERFORMANCE TABLE */
            /* ========================================================================= */
            filteredTeams.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                <Users size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <h4 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                  No Matching Support Teams Found
                </h4>
                <p style={{ fontSize: '12.5px', margin: 0 }}>No teams match your search or tier filter.</p>
              </div>
            ) : (
              <div
                className="perf-table-wrapper"
                style={{
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  border: '1px solid var(--border-medium, #e2e8f0)',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                  <thead>
                    <tr
                      style={{
                        backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                        borderBottom: '1px solid var(--border-medium, #e2e8f0)',
                        textAlign: 'left',
                        color: 'var(--text-secondary, #475569)',
                        fontSize: '11px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      <th
                        onClick={() => handleTeamSort('name')}
                        style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Team Name
                          {teamSortField === 'name' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th style={{ padding: '10px 14px' }}>Support Tier</th>
                      <th
                        onClick={() => handleTeamSort('memberCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Staff Roster
                          {teamSortField === 'memberCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('assignedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Tickets Routed
                          {teamSortField === 'assignedCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('resolvedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Tickets Resolved
                          {teamSortField === 'resolvedCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('openCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Unresolved
                          {teamSortField === 'openCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('resolutionRate')}
                        style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none', width: '170px' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Team Velocity
                          {teamSortField === 'resolutionRate' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('avgResolutionHours')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'right', userSelect: 'none' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                          Avg Resolution Time
                          {teamSortField === 'avgResolutionHours' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTeams.map((team) => {
                      const isExpanded = expandedTeamIds.has(team.teamId);
                      return (
                        <React.Fragment key={team.teamId}>
                          <tr
                            onClick={() => toggleTeamExpand(team.teamId)}
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle, #f1f5f9)',
                              backgroundColor: isExpanded ? 'var(--bg-surface-elevated, #f8fafc)' : 'transparent',
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            title="Click to view all agents in this team"
                          >
                            {/* Team Name with Expand Arrow */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '4px',
                                    backgroundColor: isExpanded ? 'var(--primary-subtle, #e0e7ff)' : '#f1f5f9',
                                    color: isExpanded ? 'var(--primary, #2563eb)' : 'var(--text-muted, #64748b)',
                                    transition: 'all 0.2s ease',
                                  }}
                                >
                                  <ChevronDown
                                    size={13}
                                    style={{
                                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                      transition: 'transform 0.2s ease',
                                    }}
                                  />
                                </span>
                                <div>
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                                    {team.name}
                                  </div>
                                  {team.description && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                                      {team.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Tier */}
                            <td style={{ padding: '12px 14px' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 750,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                                  color: 'var(--primary, #2563eb)',
                                }}
                              >
                                {team.tier || 'L1'}
                              </span>
                            </td>

                            {/* Staff Count Badge (Interactive) */}
                            <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTeamExpand(team.teamId);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  backgroundColor: isExpanded ? 'var(--primary, #2563eb)' : '#f1f5f9',
                                  color: isExpanded ? '#ffffff' : '#334155',
                                  border: `1px solid ${isExpanded ? 'var(--primary, #2563eb)' : '#cbd5e1'}`,
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                title="Click to expand/collapse member roster"
                              >
                                <Users size={12} />
                                <span>{team.memberCount} Agents</span>
                                <ChevronDown
                                  size={11}
                                  style={{
                                    transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.15s ease',
                                  }}
                                />
                              </button>
                            </td>

                            {/* Routed / Assigned Count */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                              {team.assignedCount}
                            </td>

                            {/* Resolved Count */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                              {team.resolvedCount}
                            </td>

                            {/* Unresolved */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontWeight: 600, color: team.openCount > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                              {team.openCount}
                            </td>

                            {/* Resolution Velocity Bar */}
                            <td style={{ padding: '12px 14px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    flex: 1,
                                    height: '7px',
                                    backgroundColor: 'var(--border-subtle, #e2e8f0)',
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                  }}
                                >
                                  <div
                                    style={{
                                      width: `${Math.min(100, team.resolutionRate)}%`,
                                      height: '100%',
                                      backgroundColor: team.resolutionRate >= 80 ? '#10b981' : team.resolutionRate >= 50 ? '#f59e0b' : '#ef4444',
                                      borderRadius: '4px',
                                    }}
                                  />
                                </div>
                                <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--text-primary)', width: '36px', textAlign: 'right' }}>
                                  {team.resolutionRate}%
                                </span>
                              </div>
                            </td>

                            {/* Avg Resolution Hours */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                              {team.avgResolutionHours !== null ? `${team.avgResolutionHours} hrs` : 'N/A'}
                            </td>
                          </tr>

                          {/* Expanded Sub-Table: Team Member Agents */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: 'var(--bg-surface-elevated, #f8fafc)' }}>
                              <td
                                colSpan={8}
                                style={{
                                  padding: '0 16px 16px 36px',
                                  borderBottom: '1px solid var(--border-medium, #e2e8f0)',
                                }}
                              >
                                <div
                                  style={{
                                    backgroundColor: 'var(--bg-surface, #ffffff)',
                                    border: '1px solid var(--border-medium, #e2e8f0)',
                                    borderRadius: '10px',
                                    padding: '12px 16px',
                                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      marginBottom: '10px',
                                      paddingBottom: '8px',
                                      borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        fontWeight: 750,
                                        color: 'var(--text-primary)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                      }}
                                    >
                                      <Users size={14} style={{ color: 'var(--primary, #2563eb)' }} />
                                      {team.name} Assigned Members ({team.members.length} Agents)
                                    </div>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      Individual member performance within {team.name}
                                    </span>
                                  </div>

                                  {team.members.length === 0 ? (
                                    <div
                                      style={{
                                        fontSize: '12px',
                                        color: 'var(--text-muted)',
                                        fontStyle: 'italic',
                                        padding: '12px 0',
                                        textAlign: 'center',
                                      }}
                                    >
                                      No individual staff members are currently mapped to this team in the roster.
                                    </div>
                                  ) : (
                                    <div style={{ overflowX: 'auto' }}>
                                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                                        <thead>
                                          <tr
                                            style={{
                                              borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                                              textAlign: 'left',
                                              color: 'var(--text-muted, #64748b)',
                                              fontSize: '10px',
                                              textTransform: 'uppercase',
                                              letterSpacing: '0.04em',
                                            }}
                                          >
                                            <th style={{ padding: '6px 10px' }}>Staff Agent</th>
                                            <th style={{ padding: '6px 10px' }}>Email & Role</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center' }}>Live Status</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Assigned</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Resolved</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Unresolved</th>
                                            <th style={{ padding: '6px 10px', width: '140px' }}>Velocity</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'right' }}>Avg Resolution Time</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {team.members.map((m) => (
                                            <tr
                                              key={m.agentId}
                                              style={{
                                                borderBottom: '1px solid var(--border-subtle, #f8fafc)',
                                                transition: 'background-color 0.15s ease',
                                              }}
                                            >
                                              {/* Agent Name with Avatar Disc */}
                                              <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                  <div
                                                    style={{
                                                      width: '24px',
                                                      height: '24px',
                                                      borderRadius: '50%',
                                                      backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                                                      color: 'var(--primary, #2563eb)',
                                                      fontSize: '10px',
                                                      fontWeight: 700,
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      flexShrink: 0,
                                                    }}
                                                  >
                                                    {m.fullName.substring(0, 2).toUpperCase()}
                                                  </div>
                                                  <span>{m.fullName}</span>
                                                </div>
                                              </td>

                                              {/* Email & Role */}
                                              <td style={{ padding: '8px 10px', color: 'var(--text-muted)' }}>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{m.email}</div>
                                                {m.jobTitle && (
                                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{m.jobTitle}</div>
                                                )}
                                              </td>

                                              {/* Live Status */}
                                              <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                                                {m.isOnline ? (
                                                  <span
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px',
                                                      fontSize: '10.5px',
                                                      fontWeight: 700,
                                                      color: '#059669',
                                                      backgroundColor: '#ecfdf5',
                                                      padding: '1px 6px',
                                                      borderRadius: '10px',
                                                      border: '1px solid #a7f3d0',
                                                    }}
                                                  >
                                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                                                    Online
                                                  </span>
                                                ) : (
                                                  <span
                                                    style={{
                                                      display: 'inline-flex',
                                                      alignItems: 'center',
                                                      gap: '3px',
                                                      fontSize: '10px',
                                                      fontWeight: 500,
                                                      color: '#64748b',
                                                      backgroundColor: '#f1f5f9',
                                                      padding: '1px 6px',
                                                      borderRadius: '10px',
                                                    }}
                                                  >
                                                    <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#94a3b8' }} />
                                                    Offline
                                                  </span>
                                                )}
                                              </td>

                                              {/* Workload Stats */}
                                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)' }}>
                                                {m.assignedCount}
                                              </td>
                                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 800, color: '#059669' }}>
                                                {m.resolvedCount}
                                              </td>
                                              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 600, color: m.openCount > 0 ? '#2563eb' : 'var(--text-muted)' }}>
                                                {m.openCount}
                                              </td>

                                              {/* Velocity */}
                                              <td style={{ padding: '8px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                  <div
                                                    style={{
                                                      flex: 1,
                                                      height: '5px',
                                                      backgroundColor: 'var(--border-subtle, #e2e8f0)',
                                                      borderRadius: '3px',
                                                      overflow: 'hidden',
                                                    }}
                                                  >
                                                    <div
                                                      style={{
                                                        width: `${Math.min(100, m.resolutionRate)}%`,
                                                        height: '100%',
                                                        backgroundColor: m.resolutionRate >= 80 ? '#10b981' : m.resolutionRate >= 50 ? '#f59e0b' : '#ef4444',
                                                      }}
                                                    />
                                                  </div>
                                                  <span style={{ fontSize: '10.5px', fontWeight: 700, width: '32px', textAlign: 'right' }}>
                                                    {m.resolutionRate}%
                                                  </span>
                                                </div>
                                              </td>

                                              {/* Avg Resolution Time */}
                                              <td style={{ padding: '8px 10px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                {m.avgResolutionHours !== null ? `${m.avgResolutionHours} hrs` : 'N/A'}
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* Footer info bar */}
        <div
          className="perf-footer-bar"
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
            color: 'var(--text-muted, #64748b)',
            flexShrink: 0,
          }}
        >
          <div>
            Showing <strong style={{ color: 'var(--text-primary)' }}>{activeTab === 'agents' ? filteredAgents.length : filteredTeams.length}</strong>{' '}
            {activeTab === 'agents' ? 'staff performance entries' : 'teams'} for time window:{' '}
            <strong style={{ color: 'var(--primary, #2563eb)' }}>
              {preset.replace('_', ' ').toUpperCase()} {startDate && endDate ? `(${startDate} ~ ${endDate})` : ''}
            </strong>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-outline"
              style={{ height: '32px', padding: '0 14px', fontSize: '12px', fontWeight: 600, borderRadius: '6px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

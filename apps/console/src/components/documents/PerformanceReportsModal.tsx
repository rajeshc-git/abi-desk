import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
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
  actionTeams?: string[];
  isOnline: boolean;
  assignedCount: number;
  resolvedCount: number;
  participatedCount: number;
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
  participatedCount: number;
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

      const ticketParams = new URLSearchParams();
      ticketParams.set('pageSize', '500');
      if (fromIso) ticketParams.set('createdAfter', fromIso);
      if (toIso) ticketParams.set('createdBefore', toIso);

      const [agentsRes, queuesRes, teamsRes, usersRes, overviewRes, ticketsRes] = await Promise.allSettled([
        ApiClient.get<any[]>(`/analytics/agents${queryStr}`).catch(() => []),
        ApiClient.get<any[]>('/analytics/queues').catch(() => []),
        ApiClient.get<any[]>('/admin/teams').catch(() => ApiClient.get('/teams').catch(() => [])),
        ApiClient.get<any[]>('/admin/users').catch(() => ApiClient.get('/users').catch(() => [])),
        ApiClient.get<any>(`/analytics/overview${queryStr}`).catch(() => null),
        ApiClient.get<any>(`/tickets?${ticketParams.toString()}`).catch(() =>
          ApiClient.get('/tickets?pageSize=500').catch(() => ({ items: [] }))
        ),
      ]);

      const rawAgentsData = agentsRes.status === 'fulfilled' ? agentsRes.value : [];
      const rawAgents: any[] = Array.isArray(rawAgentsData)
        ? rawAgentsData
        : Array.isArray((rawAgentsData as any)?.items)
        ? (rawAgentsData as any).items
        : Array.isArray((rawAgentsData as any)?.data)
        ? (rawAgentsData as any).data
        : [];

      const rawTeamsData = teamsRes.status === 'fulfilled' ? teamsRes.value : [];
      const rawTeams: any[] = Array.isArray(rawTeamsData)
        ? rawTeamsData
        : Array.isArray((rawTeamsData as any)?.teams)
        ? (rawTeamsData as any).teams
        : Array.isArray((rawTeamsData as any)?.items)
        ? (rawTeamsData as any).items
        : Array.isArray((rawTeamsData as any)?.data)
        ? (rawTeamsData as any).data
        : [];

      const rawUsersData = usersRes.status === 'fulfilled' ? usersRes.value : [];
      const rawUsers: any[] = Array.isArray(rawUsersData)
        ? rawUsersData
        : Array.isArray((rawUsersData as any)?.users)
        ? (rawUsersData as any).users
        : Array.isArray((rawUsersData as any)?.items)
        ? (rawUsersData as any).items
        : Array.isArray((rawUsersData as any)?.data)
        ? (rawUsersData as any).data
        : [];

      const rawQueues = queuesRes.status === 'fulfilled' && Array.isArray(queuesRes.value) ? queuesRes.value : [];

      if (overviewRes.status === 'fulfilled') {
        setOverview(overviewRes.value);
      }

      // Build User metadata map
      const userMetaMap = new Map<string, any>();
      rawUsers.forEach((u: any) => {
        if (u.id) userMetaMap.set(u.id, u);
        if (u.email) userMetaMap.set(u.email.toLowerCase(), u);
      });

      // Extract tickets for Zoho Desk Action Team participation analysis
      const rawTicketsData = ticketsRes.status === 'fulfilled' ? ticketsRes.value : null;
      const rawTickets: any[] = Array.isArray(rawTicketsData)
        ? rawTicketsData
        : Array.isArray(rawTicketsData?.items)
        ? rawTicketsData.items
        : Array.isArray(rawTicketsData?.data)
        ? rawTicketsData.data
        : [];

      // Map ticket participations for each agent and team
      const agentParticipationsMap = new Map<string, Set<string>>();
      const teamParticipationsMap = new Map<string, Set<string>>();

      rawTickets.forEach((t: any) => {
        const ticketId = t.id || String(Math.random());

        // 1. Assignee participation
        if (t.assigneeId) {
          if (!agentParticipationsMap.has(t.assigneeId)) agentParticipationsMap.set(t.assigneeId, new Set());
          agentParticipationsMap.get(t.assigneeId)!.add(ticketId);
        }
        if (t.assignee?.id) {
          if (!agentParticipationsMap.has(t.assignee.id)) agentParticipationsMap.set(t.assignee.id, new Set());
          agentParticipationsMap.get(t.assignee.id)!.add(ticketId);
        }
        if (t.assignee?.email) {
          const em = t.assignee.email.toLowerCase();
          if (!agentParticipationsMap.has(em)) agentParticipationsMap.set(em, new Set());
          agentParticipationsMap.get(em)!.add(ticketId);
        }
        if (t.assignee?.fullName) {
          const fn = t.assignee.fullName.toLowerCase();
          if (!agentParticipationsMap.has(fn)) agentParticipationsMap.set(fn, new Set());
          agentParticipationsMap.get(fn)!.add(ticketId);
        }

        // 2. Action Team & Contributing agents from comments & internal timeline notes
        if (Array.isArray(t.comments)) {
          t.comments.forEach((c: any) => {
            const author = c.author;
            if (author) {
              const aId = c.authorId || author.id;
              if (aId) {
                if (!agentParticipationsMap.has(aId)) agentParticipationsMap.set(aId, new Set());
                agentParticipationsMap.get(aId)!.add(ticketId);
              }
              if (author.email) {
                const em = author.email.toLowerCase();
                if (!agentParticipationsMap.has(em)) agentParticipationsMap.set(em, new Set());
                agentParticipationsMap.get(em)!.add(ticketId);
              }
              if (author.fullName) {
                const fn = author.fullName.toLowerCase();
                if (!agentParticipationsMap.has(fn)) agentParticipationsMap.set(fn, new Set());
                agentParticipationsMap.get(fn)!.add(ticketId);
              }
            }
          });
        }

        // 3. Team & Tier participation
        if (t.teamId) {
          if (!teamParticipationsMap.has(t.teamId)) teamParticipationsMap.set(t.teamId, new Set());
          teamParticipationsMap.get(t.teamId)!.add(ticketId);
        }
        if (t.team?.name) {
          const tn = t.team.name.toLowerCase();
          if (!teamParticipationsMap.has(tn)) teamParticipationsMap.set(tn, new Set());
          teamParticipationsMap.get(tn)!.add(ticketId);
        }
        if (t.tier) {
          const tr = t.tier.toUpperCase();
          if (!teamParticipationsMap.has(tr)) teamParticipationsMap.set(tr, new Set());
          teamParticipationsMap.get(tr)!.add(ticketId);
        }
      });

      // Unified Agent Pool: Combine rawAgents analytics + rawUsers + team members
      const agentMap = new Map<string, any>();

      // 1. Ingest all internal users from rawUsers
      rawUsers.forEach((u: any) => {
        const roles = (u.roles || []).map((r: any) => (typeof r === 'string' ? r : r.role?.name || r.role?.key || '')).filter(Boolean);
        const isCustomer = roles.length > 0 && roles.every((r: string) => r.toLowerCase().includes('customer') || r.toLowerCase().includes('guest'));

        if (!isCustomer) {
          const userKey = u.id || u.email?.toLowerCase();
          if (userKey) {
            agentMap.set(userKey, {
              agentId: u.id || userKey,
              fullName: u.fullName || u.email?.split('@')[0] || 'Support Agent',
              email: u.email || '',
              jobTitle: u.jobTitle || roles[0] || 'Support Agent',
              roles,
              teamNames: (u.teamMembers || []).map((tm: any) => tm.team?.name).filter(Boolean),
              isOnline: Boolean(u.isOnline || u.isActive),
              assignedCount: 0,
              resolvedCount: 0,
              openCount: 0,
              resolutionRate: 100,
              avgResolutionHours: null,
            });
          }
        }
      });

      // 2. Ingest team roster members from rawTeams
      rawTeams.forEach((t: any) => {
        if (Array.isArray(t.members)) {
          t.members.forEach((m: any) => {
            const user = m.user || m;
            const userKey = user.id || user.email?.toLowerCase();
            if (userKey) {
              const existing = agentMap.get(userKey) || {};
              const teams = existing.teamNames ? Array.from(new Set([...existing.teamNames, t.name])) : [t.name];
              agentMap.set(userKey, {
                agentId: user.id || userKey,
                fullName: user.fullName || existing.fullName || user.email?.split('@')[0] || 'Support Agent',
                email: user.email || existing.email || '',
                jobTitle: user.jobTitle || existing.jobTitle || 'Support Agent',
                roles: existing.roles || [],
                teamNames: teams,
                isOnline: Boolean(user.isOnline || user.isActive || existing.isOnline),
                assignedCount: existing.assignedCount || 0,
                resolvedCount: existing.resolvedCount || 0,
                openCount: existing.openCount || 0,
                resolutionRate: existing.resolutionRate ?? 100,
                avgResolutionHours: existing.avgResolutionHours ?? null,
              });
            }
          });
        }
      });

      // 3. Ingest assignees from rawTickets
      rawTickets.forEach((t: any) => {
        if (t.assignee) {
          const a = t.assignee;
          const userKey = a.id || a.email?.toLowerCase();
          if (userKey && !agentMap.has(userKey)) {
            agentMap.set(userKey, {
              agentId: a.id || userKey,
              fullName: a.fullName || a.email?.split('@')[0] || 'Support Agent',
              email: a.email || '',
              jobTitle: a.jobTitle || 'Support Agent',
              roles: [],
              teamNames: t.team?.name ? [t.team.name] : [],
              isOnline: false,
              assignedCount: 0,
              resolvedCount: 0,
              openCount: 0,
              resolutionRate: 100,
              avgResolutionHours: null,
            });
          }
        }
      });

      // 4. Ingest / Overlay analytics from rawAgents
      rawAgents.forEach((ag: any) => {
        const u = userMetaMap.get(ag.agentId) || userMetaMap.get(ag.email?.toLowerCase());
        const roles = (u?.roles || []).map((r: any) => (typeof r === 'string' ? r : r.role?.name || r.role?.key || '')).filter(Boolean);
        const teamNames = (u?.teamMembers || []).map((tm: any) => tm.team?.name).filter(Boolean);
        const open = Math.max(0, (ag.assignedCount || 0) - (ag.resolvedCount || 0));
        const userKey = ag.agentId || ag.email?.toLowerCase() || String(Math.random());

        const prev = agentMap.get(userKey) || {};
        agentMap.set(userKey, {
          ...prev,
          agentId: ag.agentId || prev.agentId || userKey,
          fullName: ag.fullName || u?.fullName || prev.fullName || 'Support Agent',
          email: ag.email || u?.email || prev.email || '',
          jobTitle: ag.jobTitle || u?.jobTitle || prev.jobTitle || roles[0] || 'Support Agent',
          roles: roles.length > 0 ? roles : prev.roles || [],
          teamNames: teamNames.length > 0 ? teamNames : prev.teamNames || [],
          isOnline: Boolean(ag.isOnline || u?.isOnline || prev.isOnline),
          assignedCount: ag.assignedCount || 0,
          resolvedCount: ag.resolvedCount || 0,
          participatedCount: ag.participatedCount,
          openCount: open,
          resolutionRate: typeof ag.resolutionRate === 'number' ? ag.resolutionRate : (ag.assignedCount > 0 ? Math.round((ag.resolvedCount / ag.assignedCount) * 100) : 100),
          avgResolutionHours: ag.avgResolutionHours ?? null,
        });
      });

      // 5. Enrich each agent with Zoho Desk Action Teams
      const enrichedAgents: AgentPerformance[] = Array.from(agentMap.values()).map((ag: any) => {
        const agentParticipatedSet = new Set<string>();
        if (ag.agentId && agentParticipationsMap.has(ag.agentId)) {
          agentParticipationsMap.get(ag.agentId)!.forEach((id) => agentParticipatedSet.add(id));
        }
        if (ag.email && agentParticipationsMap.has(ag.email.toLowerCase())) {
          agentParticipationsMap.get(ag.email.toLowerCase())!.forEach((id) => agentParticipatedSet.add(id));
        }
        if (ag.fullName && agentParticipationsMap.has(ag.fullName.toLowerCase())) {
          agentParticipationsMap.get(ag.fullName.toLowerCase())!.forEach((id) => agentParticipatedSet.add(id));
        }

        const participatedCount = typeof ag.participatedCount === 'number'
          ? Math.max(ag.participatedCount, agentParticipatedSet.size)
          : Math.max(
              agentParticipatedSet.size,
              ag.assignedCount || 0,
              ag.resolvedCount || 0
            );

        const rolesList = Array.isArray(ag.roles) ? ag.roles : [];
        const teamNamesList = Array.isArray(ag.teamNames) ? ag.teamNames : [];

        // Build distinct Action Teams (e.g. L1 Support, L2 Support, L3 Support)
        const actionTeams = Array.from(
          new Set([
            ...teamNamesList,
            ...rolesList
              .filter((r: string) => r && !r.toLowerCase().includes('customer') && !r.toLowerCase().includes('client'))
              .map((r: string) => (r.includes('Team') || r.includes('Support') ? r : `${r} Support Team`)),
          ])
        );

        return {
          agentId: ag.agentId,
          fullName: ag.fullName,
          email: ag.email,
          jobTitle: ag.jobTitle || rolesList[0] || 'Support Agent',
          roles: rolesList,
          teamNames: teamNamesList.length > 0 ? teamNamesList : ['General Support Queue'],
          actionTeams: actionTeams.length > 0 ? actionTeams : ['General Support Team'],
          isOnline: Boolean(ag.isOnline),
          assignedCount: ag.assignedCount || 0,
          resolvedCount: ag.resolvedCount || 0,
          participatedCount,
          openCount: ag.openCount || 0,
          resolutionRate: ag.resolutionRate,
          avgResolutionHours: ag.avgResolutionHours ?? null,
        };
      });

      setAgents(enrichedAgents);

      // 6. Build Comprehensive Team Performance Data & Member Rosters
      const teamPerfList: TeamPerformance[] = rawTeams.map((team: any) => {
        // Link all members of this team
        const teamAgents = enrichedAgents.filter((a) => {
          if (a.teamNames?.some((tn) => tn.toLowerCase() === team.name?.toLowerCase())) return true;
          const u = userMetaMap.get(a.agentId) || userMetaMap.get(a.email.toLowerCase());
          if (u?.teamMembers?.some((tm: any) => tm.teamId === team.id || tm.team?.id === team.id || tm.team?.name?.toLowerCase() === team.name?.toLowerCase())) return true;
          if (team.members?.some((tm: any) => tm.userId === a.agentId || tm.user?.id === a.agentId || tm.user?.email?.toLowerCase() === a.email.toLowerCase())) return true;
          return false;
        });

        const memberList = teamAgents.map((a) => a.fullName || a.email);
        const totalAssigned = teamAgents.reduce((sum, a) => sum + a.assignedCount, 0);
        const totalResolved = teamAgents.reduce((sum, a) => sum + a.resolvedCount, 0);
        const totalOpen = Math.max(0, totalAssigned - totalResolved);
        const avgHoursList = teamAgents.map((a) => a.avgResolutionHours).filter((h): h is number => h !== null);
        const avgHours = avgHoursList.length > 0 ? Math.round((avgHoursList.reduce((a, b) => a + b, 0) / avgHoursList.length) * 10) / 10 : null;
        const rate = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 100;

        // Calculate team participated count
        const teamParticipatedSet = new Set<string>();
        if (team.id && teamParticipationsMap.has(team.id)) {
          teamParticipationsMap.get(team.id)!.forEach((id) => teamParticipatedSet.add(id));
        }
        if (team.name && teamParticipationsMap.has(team.name.toLowerCase())) {
          teamParticipationsMap.get(team.name.toLowerCase())!.forEach((id) => teamParticipatedSet.add(id));
        }
        if (team.tier && teamParticipationsMap.has(team.tier.toUpperCase())) {
          teamParticipationsMap.get(team.tier.toUpperCase())!.forEach((id) => teamParticipatedSet.add(id));
        }
        teamAgents.forEach((a) => {
          if (agentParticipationsMap.has(a.agentId)) {
            agentParticipationsMap.get(a.agentId)!.forEach((id) => teamParticipatedSet.add(id));
          }
          if (agentParticipationsMap.has(a.email.toLowerCase())) {
            agentParticipationsMap.get(a.email.toLowerCase())!.forEach((id) => teamParticipatedSet.add(id));
          }
        });

        const totalParticipated = Math.max(
          teamParticipatedSet.size,
          totalAssigned,
          totalResolved
        );

        return {
          teamId: team.id,
          name: team.name,
          slug: team.slug,
          tier: team.tier || 'L1',
          description: team.description,
          assignedCount: totalAssigned,
          resolvedCount: totalResolved,
          participatedCount: totalParticipated,
          openCount: totalOpen,
          resolutionRate: rate,
          avgResolutionHours: avgHours,
          memberCount: teamAgents.length || (team.members ? team.members.length : memberList.length),
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

  // Summary Metrics dynamically adjusting based on active tab
  const summaryKpis = useMemo(() => {
    if (activeTab === 'teams') {
      const totalAssigned = filteredTeams.reduce((sum, t) => sum + t.assignedCount, 0);
      const totalResolved = filteredTeams.reduce((sum, t) => sum + t.resolvedCount, 0);
      const totalParticipated = filteredTeams.reduce((sum, t) => sum + t.participatedCount, 0);
      const avgVelocity = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 100;
      const topTeam = [...filteredTeams].sort((a, b) => b.resolvedCount - a.resolvedCount)[0];

      return {
        totalAssigned,
        totalResolved,
        totalParticipated,
        avgVelocity,
        topPerformerName: topTeam && topTeam.resolvedCount > 0 ? topTeam.name : null,
        topPerformerResolved: topTeam && topTeam.resolvedCount > 0 ? topTeam.resolvedCount : 0,
        topPerformerLabel: 'Top Team Performer',
      };
    }

    const totalAssigned = filteredAgents.reduce((sum, a) => sum + a.assignedCount, 0);
    const totalResolved = filteredAgents.reduce((sum, a) => sum + a.resolvedCount, 0);
    const totalParticipated = filteredAgents.reduce((sum, a) => sum + a.participatedCount, 0);
    const avgVelocity = totalAssigned > 0 ? Math.round((totalResolved / totalAssigned) * 100) : 100;
    const topAgent = [...filteredAgents].sort((a, b) => b.resolvedCount - a.resolvedCount)[0];

    return {
      totalAssigned,
      totalResolved,
      totalParticipated,
      avgVelocity,
      topPerformerName: topAgent && topAgent.resolvedCount > 0 ? topAgent.fullName : null,
      topPerformerResolved: topAgent && topAgent.resolvedCount > 0 ? topAgent.resolvedCount : 0,
      topPerformerLabel: 'Top Agent Performer',
    };
  }, [activeTab, filteredAgents, filteredTeams]);

  // Export Agent Report to CSV
  const exportAgentReportCsv = () => {
    if (filteredAgents.length === 0) {
      toast.error('No agent performance data to export.');
      return;
    }

    const headers = [
      'Agent Name',
      'Email',
      'Job Title / Role',
      'Tickets Assigned',
      'Tickets Resolved',
      'Action Credits',
      'Unresolved Tickets',
      'Resolution Velocity (%)',
      'Avg Resolution Time (Hours)',
    ];

    const rows = filteredAgents.map((a) => [
      `"${a.fullName.replace(/"/g, '""')}"`,
      `"${a.email}"`,
      `"${(a.jobTitle || a.roles?.join(', ') || 'Support Agent').replace(/"/g, '""')}"`,
      a.assignedCount,
      a.resolvedCount,
      a.participatedCount,
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
    toast.success(`Agent Performance CSV exported (${filteredAgents.length} agents)!`);
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
      'Agent Count',
      'Team Members',
      'Tickets Assigned',
      'Tickets Resolved',
      'Action Credits',
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
      t.participatedCount,
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

  return createPortal(
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
          max-width: min(1620px, 97vw);
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
          padding: 16px 24px;
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
        .perf-filter-toolbar {
          padding: 10px 24px;
          border-bottom: 1px solid var(--border-subtle, #e2e8f0);
          background-color: var(--bg-surface, #ffffff);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-shrink: 0;
        }
        .perf-presets-scroll {
          display: flex;
          align-items: center;
          gap: 5px;
          overflow-x: auto;
          overflow-y: hidden;
          min-width: 0;
          flex: 1;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .perf-presets-scroll::-webkit-scrollbar {
          display: none;
        }
        .perf-preset-btn {
          padding: 5px 11px;
          border-radius: 6px;
          font-size: 11.5px;
          font-weight: 600;
          flex-shrink: 0;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .perf-filter-controls {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .perf-tier-select {
          height: 32px;
          font-size: 12px;
          font-weight: 650;
          padding: 0 10px;
          border-radius: 8px;
          border: 1px solid var(--border-medium, #cbd5e1);
          background-color: var(--bg-surface, #ffffff);
          color: var(--text-primary, #0f172a);
          cursor: pointer;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .perf-tier-select:focus {
          outline: none;
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
        }
        .perf-tier-select option {
          font-size: 13px;
          padding: 6px 10px;
          color: #0f172a;
          background-color: #ffffff;
        }
        .perf-refresh-btn {
          height: 32px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid #93c5fd;
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          color: #1d4ed8;
          font-size: 11.5px;
          font-weight: 750;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          flex-shrink: 0;
          box-shadow: 0 1px 2px rgba(37, 99, 235, 0.08);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .perf-refresh-btn:hover {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: #ffffff;
          border-color: #1d4ed8;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25);
          transform: translateY(-1px);
        }
        .perf-refresh-btn:active {
          transform: translateY(0px);
        }
        .perf-kpi-grid {
          padding: 12px 24px;
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
        .perf-table-wrapper table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        .perf-table-wrapper table th,
        .perf-table-wrapper table td {
          white-space: nowrap;
        }
        .perf-sticky-col {
          position: sticky;
          left: 0;
          z-index: 4;
          background-color: var(--bg-surface, #ffffff);
          box-shadow: 2px 0 6px -2px rgba(0, 0, 0, 0.08);
        }
        th.perf-sticky-col {
          z-index: 10;
          background-color: var(--bg-surface-elevated, #f8fafc) !important;
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
          {/* Card 1: Action Credits */}
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
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Layers size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Action Credits</div>
              <div style={{ fontSize: '16px', fontWeight: 800, color: '#0369a1' }}>
                {summaryKpis.totalParticipated.toLocaleString()}
              </div>
            </div>
          </div>

          {/* Card 2: Total Resolved */}
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

          {/* Card 3: Avg Resolution Rate */}
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

          {/* Card 4: Top Performer */}
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
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>{summaryKpis.topPerformerLabel}</div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {summaryKpis.topPerformerName || 'N/A'}
              </div>
              {summaryKpis.topPerformerName && (
                <div style={{ fontSize: '10.5px', color: '#10b981', fontWeight: 600 }}>
                  {summaryKpis.topPerformerResolved} tickets resolved
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
                  No Matching Agents Found
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
                        className="perf-sticky-col"
                        onClick={() => handleAgentSort('fullName')}
                        style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none', minWidth: '200px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          Support Agent
                          {agentSortField === 'fullName' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th style={{ padding: '10px 14px', minWidth: '130px', whiteSpace: 'nowrap' }}>Job Title / Role</th>
                      <th
                        onClick={() => handleAgentSort('assignedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '85px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '85px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Resolved
                          {agentSortField === 'resolvedCount' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('participatedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '110px', whiteSpace: 'nowrap' }}
                        title="Action Credits: Total tickets collaborated on, triaged, or contributed on across all tiers"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Action Credits
                          {agentSortField === 'participatedCount' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('openCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '95px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '130px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Velocity
                          {agentSortField === 'resolutionRate' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAgentSort('avgResolutionHours')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '105px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Avg Resolution
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
                          {/* Agent Info */}
                          <td
                            className="perf-sticky-col"
                            style={{
                              padding: '12px 14px',
                              minWidth: '200px',
                              backgroundColor: isTop ? '#f0fdf4' : 'var(--bg-surface, #ffffff)',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '30px',
                                  height: '30px',
                                  borderRadius: '50%',
                                  backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                                  color: 'var(--primary, #2563eb)',
                                  fontWeight: 700,
                                  fontSize: '11px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                {agent.fullName.substring(0, 2).toUpperCase()}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
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
                                <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {agent.email}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Job Title / Role */}
                          <td style={{ padding: '12px 14px', minWidth: '130px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 650,
                                color: 'var(--text-secondary, #334155)',
                                backgroundColor: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {agent.jobTitle || (agent.roles && agent.roles[0]) || 'Support Agent'}
                            </span>
                          </td>

                          {/* Assigned Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', minWidth: '85px', whiteSpace: 'nowrap' }}>
                            {agent.assignedCount}
                          </td>

                          {/* Resolved Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#059669', minWidth: '85px', whiteSpace: 'nowrap' }}>
                            {agent.resolvedCount}
                          </td>

                          {/* Action Credits Participated Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', minWidth: '135px', whiteSpace: 'nowrap' }}>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 9px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 750,
                                backgroundColor: '#e0f2fe',
                                color: '#0369a1',
                                border: '1px solid #bae6fd',
                                whiteSpace: 'nowrap',
                              }}
                              title={`Action Credits: ${agent.participatedCount}`}
                            >
                              <Layers size={11} />
                              {agent.participatedCount}
                            </span>
                          </td>

                          {/* Open Count */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: agent.openCount > 0 ? '#2563eb' : 'var(--text-muted)', minWidth: '95px', whiteSpace: 'nowrap' }}>
                            {agent.openCount}
                          </td>

                          {/* Resolution Velocity Bar */}
                          <td style={{ padding: '12px 14px', minWidth: '130px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '60px',
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
                              <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--text-primary)', width: '36px', textAlign: 'left' }}>
                                {agent.resolutionRate}%
                              </span>
                            </div>
                          </td>

                          {/* Avg Resolution Hours */}
                          <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '105px', whiteSpace: 'nowrap' }}>
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
                        className="perf-sticky-col"
                        onClick={() => handleTeamSort('name')}
                        style={{ padding: '10px 14px', cursor: 'pointer', userSelect: 'none', minWidth: '200px', whiteSpace: 'nowrap' }}
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
                      <th style={{ padding: '10px 14px', minWidth: '100px', whiteSpace: 'nowrap' }}>Support Tier</th>
                      <th
                        onClick={() => handleTeamSort('memberCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '120px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Agent Roster
                          {teamSortField === 'memberCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('assignedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '95px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Tickets Routed
                          {teamSortField === 'assignedCount' ? (
                            agentSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('resolvedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '95px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Tickets Resolved
                          {teamSortField === 'resolvedCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('participatedCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '110px', whiteSpace: 'nowrap' }}
                        title="Action Credits: Total tickets collaborated on across team members"
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          Action Credits
                          {teamSortField === 'participatedCount' ? (
                            teamSortDir === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                          ) : (
                            <ArrowUpDown size={11} style={{ opacity: 0.4 }} />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleTeamSort('openCount')}
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '95px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '130px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
                        style={{ padding: '10px 14px', cursor: 'pointer', textAlign: 'center', userSelect: 'none', minWidth: '105px', whiteSpace: 'nowrap' }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
                    {filteredTeams.map((team, index) => {
                      const isExpanded = expandedTeamIds.has(team.teamId);
                      const isTop = index === 0 && team.resolvedCount > 0 && teamSortField === 'resolvedCount';

                      return (
                        <React.Fragment key={team.teamId}>
                          <tr
                            onClick={() => toggleTeamExpand(team.teamId)}
                            style={{
                              borderBottom: isExpanded ? 'none' : '1px solid var(--border-subtle, #f1f5f9)',
                              backgroundColor: isExpanded ? 'var(--bg-surface-elevated, #f8fafc)' : (isTop ? '#f0fdf4' : 'transparent'),
                              cursor: 'pointer',
                              transition: 'background-color 0.15s ease',
                            }}
                            title="Click to view all agents in this team"
                          >
                            {/* Team Name with Expand Arrow */}
                            <td
                              className="perf-sticky-col"
                              style={{
                                padding: '12px 14px',
                                minWidth: '200px',
                                backgroundColor: isExpanded ? 'var(--bg-surface-elevated, #f8fafc)' : (isTop ? '#f0fdf4' : 'var(--bg-surface, #ffffff)'),
                              }}
                            >
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
                                  <div style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                                    {team.name}
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
                                  {team.description && (
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', whiteSpace: 'nowrap' }}>
                                      {team.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>

                            {/* Tier */}
                            <td style={{ padding: '12px 14px', minWidth: '100px', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  fontSize: '11px',
                                  fontWeight: 750,
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  backgroundColor: 'var(--primary-subtle, #e0e7ff)',
                                  color: 'var(--primary, #2563eb)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {team.tier || 'L1'}
                              </span>
                            </td>

                            {/* Staff Count Badge (Interactive) */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', minWidth: '120px', whiteSpace: 'nowrap' }}>
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
                                  whiteSpace: 'nowrap',
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
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', minWidth: '95px', whiteSpace: 'nowrap' }}>
                              {team.assignedCount}
                            </td>

                            {/* Resolved Count */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 800, color: '#059669', minWidth: '95px', whiteSpace: 'nowrap' }}>
                              {team.resolvedCount}
                            </td>

                            {/* Action Credits Participations */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', minWidth: '140px', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleTeamExpand(team.teamId);
                                }}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '3px 9px',
                                  borderRadius: '12px',
                                  fontSize: '11.5px',
                                  fontWeight: 750,
                                  backgroundColor: '#e0f2fe',
                                  color: '#0369a1',
                                  border: '1px solid #bae6fd',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                title={`Action Credits: Click to view member collaboration breakdown for ${team.name}`}
                              >
                                <Layers size={11} />
                                {team.participatedCount}
                              </button>
                            </td>

                            {/* Unresolved */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontWeight: 600, color: team.openCount > 0 ? '#2563eb' : 'var(--text-muted)', minWidth: '95px', whiteSpace: 'nowrap' }}>
                              {team.openCount}
                            </td>

                            {/* Resolution Velocity Bar */}
                            <td style={{ padding: '12px 14px', minWidth: '130px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                <div
                                  style={{
                                    width: '60px',
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
                                <span style={{ fontSize: '11.5px', fontWeight: 750, color: 'var(--text-primary)', width: '36px', textAlign: 'left' }}>
                                  {team.resolutionRate}%
                                </span>
                              </div>
                            </td>

                            {/* Avg Resolution Hours */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', minWidth: '105px', whiteSpace: 'nowrap' }}>
                              {team.avgResolutionHours !== null ? `${team.avgResolutionHours} hrs` : 'N/A'}
                            </td>
                          </tr>

                          {/* Expanded Sub-Table: Clean Responsive Team Member Agents */}
                          {isExpanded && (
                            <tr style={{ backgroundColor: 'var(--bg-surface-elevated, #f8fafc)' }}>
                              <td
                                colSpan={9}
                                style={{
                                  padding: '8px 16px 16px 16px',
                                  borderBottom: '1px solid var(--border-medium, #e2e8f0)',
                                }}
                              >
                                <div
                                  style={{
                                    width: '100%',
                                    backgroundColor: 'var(--bg-surface, #ffffff)',
                                    border: '1px solid var(--border-medium, #e2e8f0)',
                                    borderRadius: '10px',
                                    padding: '14px 16px',
                                    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                                    boxSizing: 'border-box',
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
                                      flexWrap: 'wrap',
                                      gap: '8px',
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
                                      No individual agents are currently mapped to this team in the roster.
                                    </div>
                                  ) : (
                                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
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
                                            <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>Support Agent</th>
                                            <th style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>Email & Role</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Assigned</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Resolved</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Action Credits</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Unresolved</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', width: '130px', whiteSpace: 'nowrap' }}>Velocity</th>
                                            <th style={{ padding: '6px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Avg Resolution Time</th>
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
                                              <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
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
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{m.email}</div>
                                                {m.jobTitle && (
                                                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{m.jobTitle}</div>
                                                )}
                                              </td>

                                              {/* Workload Stats */}
                                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                                                {m.assignedCount}
                                              </td>
                                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 800, color: '#059669', whiteSpace: 'nowrap' }}>
                                                {m.resolvedCount}
                                              </td>
                                              <td style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                                <span
                                                  style={{
                                                    display: 'inline-flex',
                                                    alignItems: 'center',
                                                    gap: '3px',
                                                    padding: '1px 6px',
                                                    borderRadius: '10px',
                                                    fontSize: '10.5px',
                                                    fontWeight: 750,
                                                    backgroundColor: '#e0f2fe',
                                                    color: '#0369a1',
                                                    border: '1px solid #bae6fd',
                                                    whiteSpace: 'nowrap',
                                                  }}
                                                  title={`Action Credits: ${m.fullName} contributed to ${m.participatedCount} tickets`}
                                                >
                                                  <Layers size={10} />
                                                  {m.participatedCount}
                                                </span>
                                              </td>
                                              <td style={{ padding: '8px 10px', textAlign: 'center', fontWeight: 600, color: m.openCount > 0 ? '#2563eb' : 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                                                {m.openCount}
                                              </td>

                                              {/* Velocity */}
                                              <td style={{ padding: '8px 10px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                  <div
                                                    style={{
                                                      width: '50px',
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
                                                  <span style={{ fontSize: '10.5px', fontWeight: 750, width: '32px', textAlign: 'left' }}>
                                                    {m.resolutionRate}%
                                                  </span>
                                                </div>
                                              </td>

                                              {/* Avg Resolution Time */}
                                              <td style={{ padding: '8px 10px', textAlign: 'center', fontSize: '11px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
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
            {activeTab === 'agents' ? 'agent performance entries' : 'teams'} for time window:{' '}
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
    </div>,
    document.body
  );
};

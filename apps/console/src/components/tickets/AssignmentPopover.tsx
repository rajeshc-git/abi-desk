import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, Users, Check, UserMinus, Search, ChevronDown, Filter, Shield } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface StaffUser {
  id: string;
  fullName: string;
  displayName?: string;
  email: string;
  roles?: Array<{ role: { name: string; key: string; tier?: string } }>;
  teamMembers?: Array<{ team: { id: string; name: string; tier?: string } }>;
}

interface Team {
  id: string;
  name: string;
  tier?: string;
  description?: string;
}

interface AssignmentPopoverProps {
  ticketId: string;
  currentAssignee?: { id: string; fullName?: string; email?: string } | null;
  currentTeam?: { id: string; name?: string } | null;
  currentTier?: string;
  onAssigned?: (assignment: { assignee?: any; team?: any; status?: string }) => void;
  align?: 'left' | 'right' | 'auto';
}

const normalizeTier = (tier?: string): string => {
  if (!tier) return '';
  const t = tier.trim().toUpperCase();
  if (t.includes('L1')) return 'L1';
  if (t.includes('L2')) return 'L2';
  if (t.includes('L3')) return 'L3';
  if (t.includes('DEVOPS')) return 'DEVOPS';
  if (t.includes('DEV')) return 'DEV';
  if (t.includes('QA')) return 'QA';
  return t;
};

const userMatchesTier = (user: StaffUser, tier?: string): boolean => {
  const norm = normalizeTier(tier);
  if (!norm) return true;

  // Check user's assigned roles
  if (Array.isArray(user.roles)) {
    const hasMatchingRole = user.roles.some((r) => {
      const roleTier = normalizeTier(r.role?.tier || '');
      const roleKey = (r.role?.key || '').toUpperCase();
      const roleName = (r.role?.name || '').toUpperCase();

      if (roleTier === norm) return true;
      if (norm === 'L1' && (roleKey === 'L1_SUPPORT' || roleName.includes('L1'))) return true;
      if (norm === 'L2' && (roleKey === 'L2_SUPPORT' || roleName.includes('L2'))) return true;
      if (norm === 'L3' && (roleKey === 'L3_SUPPORT' || roleName.includes('L3'))) return true;
      if (norm === 'DEV' && (roleKey === 'DEV_TEAM' || roleName.includes('DEV'))) return true;
      if (norm === 'DEVOPS' && (roleKey === 'DEVOPS_TEAM' || roleName.includes('DEVOPS') || roleName.includes('INFRA'))) return true;
      if (norm === 'QA' && (roleKey === 'QA_TEAM' || roleName.includes('QA'))) return true;
      return false;
    });
    if (hasMatchingRole) return true;
  }

  // Check user's team memberships
  if (Array.isArray(user.teamMembers)) {
    const hasMatchingTeam = user.teamMembers.some((tm) => {
      const teamTier = normalizeTier(tm.team?.tier || tm.team?.name || '');
      return teamTier === norm;
    });
    if (hasMatchingTeam) return true;
  }

  return false;
};

const teamMatchesTier = (team: Team, tier?: string): boolean => {
  const norm = normalizeTier(tier);
  if (!norm) return true;
  const teamTier = normalizeTier(team.tier || team.name || '');
  return teamTier === norm;
};

const getAgentRoleLabel = (user: StaffUser): string => {
  if (Array.isArray(user.roles) && user.roles.length > 0) {
    const primary = user.roles[0].role;
    return primary?.name || primary?.key?.replace('_', ' ') || '';
  }
  return '';
};

export const AssignmentPopover: React.FC<AssignmentPopoverProps> = ({
  ticketId,
  currentAssignee,
  currentTeam,
  currentTier,
  onAssigned,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'teams'>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterByTier, setFilterByTier] = useState(true);
  const [agents, setAgents] = useState<StaffUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const normalizedCurrentTier = useMemo(() => normalizeTier(currentTier), [currentTier]);

  useEffect(() => {
    // Load agents and teams
    const loadStaffAndTeams = async () => {
      try {
        const [usersRes, teamsRes] = await Promise.all([
          ApiClient.get<any[]>('/admin/users').catch(() => []),
          ApiClient.get<any[]>('/admin/teams').catch(() => []),
        ]);

        if (Array.isArray(usersRes)) {
          setAgents(usersRes.filter((u: any) => u.kind === 'STAFF' && u.status === 'ACTIVE'));
        }
        if (Array.isArray(teamsRes)) {
          setTeams(teamsRes);
        }
      } catch {
        // Ignore background load failures
      }
    };

    loadStaffAndTeams();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const getInitials = (name: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleAssignAgent = async (agent: StaffUser) => {
    setIsLoading(true);
    try {
      const res: any = await ApiClient.post(`/tickets/${ticketId}/assign`, {
        assigneeId: agent.id,
      });
      onAssigned?.({
        assignee: { id: agent.id, fullName: agent.fullName, email: agent.email },
        status: res?.status,
      });
      toast.success(`Assigned to ${agent.fullName || agent.email}`);
      setIsOpen(false);
    } catch (err: any) {
      toast.error(`Assignment failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignTeam = async (team: Team) => {
    setIsLoading(true);
    try {
      const res: any = await ApiClient.post(`/tickets/${ticketId}/assign`, {
        teamId: team.id,
      });
      onAssigned?.({
        team: { id: team.id, name: team.name },
        status: res?.status,
      });
      toast.success(`Assigned to team ${team.name}`);
      setIsOpen(false);
    } catch (err: any) {
      toast.error(`Team assignment failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnassign = async () => {
    setIsLoading(true);
    try {
      if (activeTab === 'teams') {
        const res: any = await ApiClient.post(`/tickets/${ticketId}/assign`, {
          teamId: null,
        });
        onAssigned?.({ team: null, status: res?.status });
        toast.success('Team unassigned');
      } else {
        const res: any = await ApiClient.post(`/tickets/${ticketId}/assign`, {
          assigneeId: null,
        });
        onAssigned?.({ assignee: null, status: res?.status });
        toast.success('Agent unassigned');
      }
      setIsOpen(false);
    } catch (err: any) {
      toast.error(`Unassignment failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredAgents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return agents.filter((a) => {
      const matchesSearch =
        !q ||
        a.fullName?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.displayName?.toLowerCase().includes(q) ||
        a.roles?.some(
          (r) =>
            r.role?.name?.toLowerCase().includes(q) ||
            r.role?.key?.toLowerCase().includes(q) ||
            r.role?.tier?.toLowerCase().includes(q)
        );

      if (!matchesSearch) return false;

      if (filterByTier && normalizedCurrentTier) {
        return userMatchesTier(a, normalizedCurrentTier);
      }
      return true;
    });
  }, [agents, searchQuery, filterByTier, normalizedCurrentTier]);

  const filteredTeams = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return teams.filter((t) => {
      const matchesSearch =
        !q ||
        t.name?.toLowerCase().includes(q) ||
        t.tier?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filterByTier && normalizedCurrentTier) {
        return teamMatchesTier(t, normalizedCurrentTier);
      }
      return true;
    });
  }, [teams, searchQuery, filterByTier, normalizedCurrentTier]);

  const matchingTierAgentCount = useMemo(() => {
    if (!normalizedCurrentTier) return agents.length;
    return agents.filter((a) => userMatchesTier(a, normalizedCurrentTier)).length;
  }, [agents, normalizedCurrentTier]);

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className="assignment-popover-btn"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery('');
          setFilterByTier(true);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          padding: '0 8px',
          backgroundColor: isOpen ? 'var(--primary-surface, #eff6ff)' : 'var(--bg-surface, #ffffff)',
          border: `1px solid ${isOpen ? 'var(--primary-border, #bfdbfe)' : 'var(--border-medium, #e2e8f0)'}`,
          borderRadius: 'var(--radius-md, 6px)',
          color: isOpen ? 'var(--primary, #2563eb)' : 'var(--text-primary, #0f172a)',
          fontSize: '11.5px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease',
          outline: 'none',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        title="Assign Agent or Team"
      >
        <div
          className="assignment-avatar-disc"
          style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: currentAssignee ? 'var(--primary-subtle, #e0e7ff)' : 'var(--bg-hover)',
            color: currentAssignee ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9.5px',
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {currentAssignee ? getInitials(currentAssignee.fullName || currentAssignee.email || 'A') : <User size={11} />}
        </div>
        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentAssignee?.fullName || currentAssignee?.email || 'Unassigned'}
        </span>
        {currentTeam?.name && (
          <span
            style={{
              fontSize: '10px',
              padding: '1px 5px',
              backgroundColor: 'var(--bg-hover)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            {currentTeam.name}
          </span>
        )}
        <ChevronDown size={12} style={{ color: 'var(--text-muted)', marginLeft: '1px' }} />
      </button>

      {/* Zoho Desk Styled Popover */}
      {isOpen && (
        <div
          className="assignment-popover-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            width: '290px',
            maxWidth: 'calc(100vw - 32px)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-medium, #e2e8f0)',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Top Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
            }}
          >
            <button
              type="button"
              className="assignment-popover-tab"
              onClick={() => {
                setActiveTab('teams');
                setSearchQuery('');
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'teams' ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === 'teams' ? '#2563eb' : 'var(--text-secondary, #64748b)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              TEAMS
            </button>
            <button
              type="button"
              className="assignment-popover-tab"
              onClick={() => {
                setActiveTab('agents');
                setSearchQuery('');
              }}
              style={{
                flex: 1,
                padding: '10px 0',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === 'agents' ? '2px solid #2563eb' : '2px solid transparent',
                color: activeTab === 'agents' ? '#2563eb' : 'var(--text-secondary, #64748b)',
                fontSize: '12px',
                fontWeight: 700,
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              AGENTS
            </button>
          </div>

          {/* Search Bar with Underline Input */}
          <div style={{ padding: '12px 16px 6px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                autoFocus
                className="assignment-popover-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={activeTab === 'agents' ? 'Search Agents' : 'Search Teams'}
                style={{
                  width: '100%',
                  padding: '6px 8px 6px 24px',
                  fontSize: '13px',
                  color: 'var(--text-primary, #1e293b)',
                  backgroundColor: 'transparent',
                  border: 'none',
                  borderBottom: '2px solid #2563eb',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <Search
                size={14}
                style={{
                  position: 'absolute',
                  left: '2px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted, #94a3b8)',
                }}
              />
            </div>
          </div>

          {/* Tier Role Filter Bar */}
          {normalizedCurrentTier && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '4px 14px 6px',
                fontSize: '11px',
                borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
                backgroundColor: 'var(--bg-app, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    backgroundColor: filterByTier ? '#eff6ff' : '#f1f5f9',
                    color: filterByTier ? '#1d4ed8' : '#64748b',
                    fontWeight: 600,
                    fontSize: '10.5px',
                    border: `1px solid ${filterByTier ? '#bfdbfe' : '#e2e8f0'}`,
                  }}
                >
                  <Filter size={10} style={{ color: filterByTier ? '#2563eb' : '#94a3b8' }} />
                  {filterByTier
                    ? `Tier: ${normalizedCurrentTier} only (${activeTab === 'agents' ? matchingTierAgentCount : filteredTeams.length})`
                    : 'All Staff / Teams'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setFilterByTier(!filterByTier)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#2563eb',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  textDecoration: 'underline',
                }}
              >
                {filterByTier ? 'Show All' : `Filter ${normalizedCurrentTier}`}
              </button>
            </div>
          )}

          {/* List Content */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '4px 0',
            }}
          >
            {activeTab === 'agents' ? (
              filteredAgents.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <p style={{ margin: 0, fontWeight: 500 }}>No agents found</p>
                  {filterByTier && normalizedCurrentTier && (
                    <button
                      type="button"
                      onClick={() => setFilterByTier(false)}
                      style={{
                        marginTop: '8px',
                        background: 'none',
                        border: 'none',
                        color: '#2563eb',
                        fontSize: '12px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Show all staff members
                    </button>
                  )}
                </div>
              ) : (
                filteredAgents.map((agent) => {
                  const isSelected = currentAssignee?.id === agent.id;
                  const roleLabel = getAgentRoleLabel(agent);
                  return (
                    <div
                      key={agent.id}
                      className="assignment-popover-item"
                      onClick={() => handleAssignAgent(agent)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 14px',
                        cursor: 'pointer',
                        backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                        transition: 'background-color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <div
                          className="assignment-popover-avatar"
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '11px',
                            fontWeight: 700,
                            color: '#334155',
                            backgroundColor: '#ffffff',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(agent.fullName || agent.displayName || agent.email)}
                        </div>
                        <div style={{ minWidth: 0, flex: 1, paddingRight: '6px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '6px',
                            }}
                          >
                            <span
                              className="assignment-popover-name"
                              style={{
                                fontSize: '12.5px',
                                fontWeight: 600,
                                color: '#1e293b',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {agent.fullName || agent.displayName || 'Agent'}
                            </span>
                            {roleLabel && (
                              <span
                                style={{
                                  fontSize: '9.5px',
                                  fontWeight: 600,
                                  padding: '1px 4px',
                                  borderRadius: '3px',
                                  backgroundColor: '#eff6ff',
                                  color: '#1d4ed8',
                                  border: '1px solid #dbeafe',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                }}
                              >
                                {roleLabel}
                              </span>
                            )}
                          </div>
                          <div
                            className="assignment-popover-subtext"
                            style={{
                              fontSize: '11px',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {agent.email}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check size={16} color="#2563eb" style={{ flexShrink: 0, marginLeft: '4px' }} />}
                    </div>
                  );
                })
              )
            ) : filteredTeams.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                <p style={{ margin: 0, fontWeight: 500 }}>No teams found</p>
                {filterByTier && normalizedCurrentTier && (
                  <button
                    type="button"
                    onClick={() => setFilterByTier(false)}
                    style={{
                      marginTop: '8px',
                      background: 'none',
                      border: 'none',
                      color: '#2563eb',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textDecoration: 'underline',
                    }}
                  >
                    Show all teams
                  </button>
                )}
              </div>
            ) : (
              filteredTeams.map((team) => {
                const isSelected = currentTeam?.id === team.id;
                return (
                  <div
                    key={team.id}
                    className="assignment-popover-item"
                    onClick={() => handleAssignTeam(team)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 14px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#eff6ff' : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = '#f1f5f9';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                      <div
                        className="assignment-popover-avatar"
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          border: '1px solid #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        <Users size={15} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '6px',
                          }}
                        >
                          <span
                            className="assignment-popover-name"
                            style={{
                              fontSize: '12.5px',
                              fontWeight: 600,
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {team.name}
                          </span>
                          {team.tier && (
                            <span
                              style={{
                                fontSize: '9.5px',
                                fontWeight: 600,
                                padding: '1px 4px',
                                borderRadius: '3px',
                                backgroundColor: '#f3e8ff',
                                color: '#6b21a8',
                                border: '1px solid #e9d5ff',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              Tier: {team.tier}
                            </span>
                          )}
                        </div>
                        {team.description && (
                          <div
                            className="assignment-popover-subtext"
                            style={{
                              fontSize: '11px',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {team.description}
                          </div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={16} color="#2563eb" style={{ flexShrink: 0, marginLeft: '4px' }} />}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer: Mark as Unassigned */}
          <div
            style={{
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              padding: '10px 16px',
              backgroundColor: 'var(--bg-app, #f8fafc)',
            }}
          >
            <button
              type="button"
              onClick={handleUnassign}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '12.5px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
                width: '100%',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              <UserMinus size={15} />
              {activeTab === 'teams' ? 'Mark Team as Unassigned' : 'Mark as Unassigned'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

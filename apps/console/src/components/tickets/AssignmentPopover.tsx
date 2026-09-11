import React, { useState, useEffect, useRef } from 'react';
import { User, Users, Check, UserMinus, Search, ChevronDown } from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface StaffUser {
  id: string;
  fullName: string;
  displayName?: string;
  email: string;
  roles?: Array<{ role: { name: string; key: string } }>;
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
  onAssigned?: (assignment: { assignee?: any; team?: any; status?: string }) => void;
}

export const AssignmentPopover: React.FC<AssignmentPopoverProps> = ({
  ticketId,
  currentAssignee,
  currentTeam,
  onAssigned,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'agents' | 'teams'>('agents');
  const [searchQuery, setSearchQuery] = useState('');
  const [agents, setAgents] = useState<StaffUser[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

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

  const filteredAgents = agents.filter((a) => {
    const q = searchQuery.toLowerCase();
    return (
      a.fullName?.toLowerCase().includes(q) ||
      a.email?.toLowerCase().includes(q) ||
      a.displayName?.toLowerCase().includes(q)
    );
  });

  const filteredTeams = teams.filter((t) => {
    const q = searchQuery.toLowerCase();
    return t.name?.toLowerCase().includes(q) || t.tier?.toLowerCase().includes(q);
  });

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearchQuery('');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '12px',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
        }}
        title="Assign Agent or Team"
      >
        <div
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: currentAssignee ? 'var(--primary-subtle, #e0e7ff)' : 'var(--bg-hover)',
            color: currentAssignee ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontWeight: 700,
          }}
        >
          {currentAssignee ? getInitials(currentAssignee.fullName || currentAssignee.email || 'A') : <User size={12} />}
        </div>
        <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentAssignee?.fullName || currentAssignee?.email || 'Unassigned'}
        </span>
        {currentTeam?.name && (
          <span
            style={{
              fontSize: '10px',
              padding: '2px 6px',
              backgroundColor: 'var(--bg-hover)',
              borderRadius: '4px',
              color: 'var(--text-secondary)',
            }}
          >
            {currentTeam.name}
          </span>
        )}
        <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
      </button>

      {/* Zoho Desk Styled Popover */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            width: '280px',
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
          <div style={{ padding: '12px 16px 8px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="text"
                autoFocus
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

          {/* List Content */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '6px 0',
            }}
          >
            {activeTab === 'agents' ? (
              filteredAgents.length === 0 ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                  No agents found
                </div>
              ) : (
                filteredAgents.map((agent) => {
                  const isSelected = currentAssignee?.id === agent.id;
                  return (
                    <div
                      key={agent.id}
                      onClick={() => handleAssignAgent(agent)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 16px',
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
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            border: '1px solid #cbd5e1',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            color: '#334155',
                            backgroundColor: '#ffffff',
                            flexShrink: 0,
                          }}
                        >
                          {getInitials(agent.fullName || agent.displayName || agent.email)}
                        </div>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#1e293b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {agent.fullName || agent.displayName || 'Agent'}
                          </div>
                          <div
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
                      {isSelected && <Check size={18} color="#2563eb" style={{ flexShrink: 0 }} />}
                    </div>
                  );
                })
              )
            ) : filteredTeams.length === 0 ? (
              <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                No teams found
              </div>
            ) : (
              filteredTeams.map((team) => {
                const isSelected = currentTeam?.id === team.id;
                return (
                  <div
                    key={team.id}
                    onClick={() => handleAssignTeam(team)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
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
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          border: '1px solid #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '12px',
                          fontWeight: 700,
                          color: '#334155',
                          backgroundColor: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        <Users size={16} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: '#1e293b',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {team.name}
                        </div>
                        {team.tier && (
                          <div style={{ fontSize: '11px', color: '#64748b' }}>Tier: {team.tier}</div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check size={18} color="#2563eb" style={{ flexShrink: 0 }} />}
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
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                padding: '4px 0',
                width: '100%',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              <UserMinus size={16} />
              {activeTab === 'teams' ? 'Mark Team as Unassigned' : 'Mark as Unassigned'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

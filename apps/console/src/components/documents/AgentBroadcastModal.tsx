import React, { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Send,
  Search,
  Users,
  CheckCircle2,
  Megaphone,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
  Square,
  RotateCw,
  Eye,
  FileText,
  Check,
} from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface AgentItem {
  agentId: string;
  fullName: string;
  email: string;
  jobTitle?: string;
  roles?: string[];
  avatarUrl?: string;
}

interface AgentBroadcastModalProps {
  isOpen: boolean;
  onClose: () => void;
  agents: AgentItem[];
}

interface TemplatePreset {
  id: string;
  badge: string;
  icon: string;
  title: string;
  text: string;
  description: string;
}

const BROADCAST_TEMPLATES: TemplatePreset[] = [
  {
    id: 'refresh',
    badge: 'Update Deployment',
    icon: '🔄',
    title: '📢 Please Refresh Your Browser',
    description: 'Instructs team to reload and receive latest bundle updates.',
    text: 'Dear team, new updates and fixes have been deployed. Please refresh your browser (Cmd+R / Ctrl+F5) to ensure you have the latest version active.',
  },
  {
    id: 'shift',
    badge: 'Operations',
    icon: '📋',
    title: '📋 Shift Handover Reminder',
    description: 'Prompts agents to update ticket statuses and tags.',
    text: 'Reminder: Please ensure all in-progress tickets are updated with status notes and relevant tags before concluding your shift.',
  },
  {
    id: 'maintenance',
    badge: 'System Notice',
    icon: '⚠️',
    title: '⚠️ Scheduled System Maintenance',
    description: 'Alerts team about brief infrastructure or network work.',
    text: 'Notice: Brief scheduled maintenance will take place shortly. If you experience minor reconnection blips, please wait a minute.',
  },
  {
    id: 'surge',
    badge: 'Queue Alert',
    icon: '🚀',
    title: '🚀 Inbound Queue Surge',
    description: 'Urges team to prioritize urgent customer tickets.',
    text: 'High ticket volume currently inbound. Please focus on urgent customer queues and escalate blocking tickets promptly.',
  },
];

type WizardStep = 'recipients' | 'compose' | 'preview';

export const AgentBroadcastModal: React.FC<AgentBroadcastModalProps> = ({
  isOpen,
  onClose,
  agents,
}) => {
  const { socket } = useSocket();
  const { user } = useAuth();
  const toast = useToast();

  const [currentStep, setCurrentStep] = useState<WizardStep>('recipients');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'selected' | 'unselected'>('all');
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(
    () => new Set(agents.map((a) => a.agentId)),
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('refresh');
  const [title, setTitle] = useState(BROADCAST_TEMPLATES[0].title);
  const [message, setMessage] = useState(BROADCAST_TEMPLATES[0].text);
  const [isSending, setIsSending] = useState(false);

  // Synchronize selection and reset state whenever modal opens or agent list updates
  useEffect(() => {
    if (!isOpen) return;
    setCurrentStep('recipients');
    setSearchQuery('');
    setFilterType('all');
    setSelectedAgentIds(new Set(agents.map((a) => a.agentId)));
    setIsSending(false);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, agents, onClose]);

  // Filter agents by search query & filter tab
  const filteredAgents = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return agents.filter((a) => {
      const isSelected = selectedAgentIds.has(a.agentId);
      if (filterType === 'selected' && !isSelected) return false;
      if (filterType === 'unselected' && isSelected) return false;

      if (!q) return true;
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.jobTitle && a.jobTitle.toLowerCase().includes(q))
      );
    });
  }, [agents, searchQuery, filterType, selectedAgentIds]);

  if (!isOpen) return null;

  const isAllSelected = agents.length > 0 && selectedAgentIds.size === agents.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAgentIds(new Set());
    } else {
      setSelectedAgentIds(new Set(agents.map((a) => a.agentId)));
    }
  };

  const toggleAgent = (id: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleApplyTemplate = (tmpl: TemplatePreset) => {
    setSelectedTemplateId(tmpl.id);
    setTitle(tmpl.title);
    setMessage(tmpl.text);
  };

  const handleSendBroadcast = () => {
    if (!message.trim()) {
      toast.error('Please enter a message to broadcast.');
      return;
    }
    if (selectedAgentIds.size === 0) {
      toast.error('Please select at least one agent to receive the broadcast.');
      return;
    }

    setIsSending(true);
    try {
      const targetIds = isAllSelected ? [] : Array.from(selectedAgentIds);
      if (socket) {
        socket.emit('broadcast_announcement', {
          title: title.trim() || 'Team Announcement',
          message: message.trim(),
          adminName: user?.fullName || 'Administrator',
          targetAgentIds: targetIds,
        });
      }

      toast.success(
        `📢 Broadcast sent to ${
          isAllSelected ? 'all agents' : `${selectedAgentIds.size} agent(s)`
        }!`,
      );
      onClose();
    } catch {
      toast.error('Failed to send broadcast.');
    } finally {
      setIsSending(false);
    }
  };

  const isRefreshRecommendation =
    message.toLowerCase().includes('refresh') ||
    message.toLowerCase().includes('reload') ||
    message.toLowerCase().includes('update');

  const steps: { id: WizardStep; label: string; number: number; icon: React.ReactNode }[] = [
    { id: 'recipients', label: '1. Recipients', number: 1, icon: <Users size={14} /> },
    { id: 'compose', label: '2. Message', number: 2, icon: <FileText size={14} /> },
    { id: 'preview', label: '3. Broadcasting', number: 3, icon: <Eye size={14} /> },
  ];

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
        padding: '20px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '840px',
          height: '620px',
          maxHeight: '90vh',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.2s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Wizard Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-surface, #eff6ff)',
                color: 'var(--primary, #2563eb)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Megaphone size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                Broadcast Wizard
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)' }}>
                Real-time team announcement & instant notification dispatch
              </div>
            </div>
          </div>

          {/* Stepper Navigation */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'var(--bg-app, #f1f5f9)',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            {steps.map((s, idx) => {
              const isActive = currentStep === s.id;
              const isPast =
                (currentStep === 'compose' && s.id === 'recipients') ||
                (currentStep === 'preview' && (s.id === 'recipients' || s.id === 'compose'));

              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setCurrentStep(s.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    borderRadius: '7px',
                    fontSize: '11.5px',
                    fontWeight: isActive ? 750 : 600,
                    backgroundColor: isActive ? 'var(--bg-surface, #ffffff)' : 'transparent',
                    color: isActive ? 'var(--primary, #2563eb)' : isPast ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: isActive ? '1px solid var(--border-subtle, #e2e8f0)' : '1px solid transparent',
                    boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: '16px',
                      height: '16px',
                      borderRadius: '50%',
                      backgroundColor: isActive
                        ? 'var(--primary, #2563eb)'
                        : isPast
                        ? '#16a34a'
                        : 'var(--border-strong, #94a3b8)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      fontWeight: 800,
                    }}
                  >
                    {isPast ? <Check size={10} strokeWidth={3} /> : s.number}
                  </span>
                  {s.label.split('. ')[1]}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              borderRadius: '8px',
              padding: '6px',
              display: 'flex',
              alignItems: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover, #f1f5f9)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <X size={18} />
          </button>
        </div>

        {/* Wizard Step Content Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column' }}>
          {/* STEP 1: RECIPIENTS */}
          {currentStep === 'recipients' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '14px' }}>
              {/* Search and Filter Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: '240px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-medium, #cbd5e1)',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                  }}
                >
                  <Search size={15} style={{ color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    placeholder="Search agents by name, email, or role..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      outline: 'none',
                      backgroundColor: 'transparent',
                      fontSize: '12.5px',
                      color: 'var(--text-primary)',
                      width: '100%',
                    }}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-app, #f1f5f9)', padding: '3px', borderRadius: '8px' }}>
                  {(['all', 'selected', 'unselected'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFilterType(t)}
                      style={{
                        border: 'none',
                        background: filterType === t ? 'var(--bg-surface, #ffffff)' : 'transparent',
                        color: filterType === t ? 'var(--primary, #2563eb)' : 'var(--text-secondary)',
                        boxShadow: filterType === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: filterType === t ? 700 : 550,
                        cursor: 'pointer',
                        textTransform: 'capitalize',
                      }}
                    >
                      {t} ({t === 'all' ? agents.length : t === 'selected' ? selectedAgentIds.size : agents.length - selectedAgentIds.size})
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={toggleSelectAll}
                  style={{
                    backgroundColor: 'var(--primary-surface, #eff6ff)',
                    border: '1px solid var(--primary-border, #bfdbfe)',
                    color: 'var(--primary, #2563eb)',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 12px',
                    borderRadius: '8px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isAllSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                  {isAllSelected ? 'Deselect All' : `Select All (${agents.length})`}
                </button>
              </div>

              {/* 2-Column Responsive Card Grid */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle, #e2e8f0)',
                  borderRadius: '10px',
                  padding: '10px',
                  backgroundColor: 'var(--bg-app, #f8fafc)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
                  gap: '8px',
                  alignContent: 'start',
                }}
              >
                {filteredAgents.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Users size={32} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>No agents match your filter</div>
                    <div style={{ fontSize: '11.5px', marginTop: '2px' }}>Try searching another keyword or reset the filter.</div>
                  </div>
                ) : (
                  filteredAgents.map((agent) => {
                    const isChecked = selectedAgentIds.has(agent.agentId);
                    return (
                      <div
                        key={agent.agentId}
                        onClick={() => toggleAgent(agent.agentId)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          backgroundColor: isChecked ? 'var(--bg-surface, #ffffff)' : 'var(--bg-surface, #ffffff)',
                          border: isChecked ? '1.5px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #e2e8f0)',
                          boxShadow: isChecked ? '0 2px 6px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.03)',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                          <div
                            style={{
                              position: 'relative',
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              background: isChecked
                                ? 'linear-gradient(135deg, var(--primary, #2563eb), var(--primary-hover, #1d4ed8))'
                                : 'var(--bg-app, #e2e8f0)',
                              color: isChecked ? '#ffffff' : 'var(--text-secondary, #475569)',
                              fontSize: '11px',
                              fontWeight: 750,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              overflow: 'hidden',
                            }}
                          >
                            <span style={{ userSelect: 'none' }}>
                              {agent.fullName.substring(0, 2).toUpperCase()}
                            </span>
                            {agent.avatarUrl && (
                              <img
                                src={agent.avatarUrl}
                                alt={agent.fullName}
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  left: 0,
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'cover',
                                }}
                                onError={(e) => {
                                  (e.currentTarget as HTMLImageElement).style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {agent.fullName}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {agent.email}
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            width: '18px',
                            height: '18px',
                            borderRadius: '5px',
                            border: isChecked ? 'none' : '1.5px solid var(--border-strong, #94a3b8)',
                            backgroundColor: isChecked ? 'var(--primary, #2563eb)' : 'transparent',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginLeft: '8px',
                          }}
                        >
                          {isChecked && <Check size={12} strokeWidth={3} />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Status bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  <strong style={{ color: 'var(--primary, #2563eb)' }}>{selectedAgentIds.size}</strong> of {agents.length} agents selected
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Selected agents will receive an instant pop-up & notification.
                </span>
              </div>
            </div>
          )}

          {/* STEP 2: COMPOSE */}
          {currentStep === 'compose' && (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
              {/* Quick Template Cards */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} style={{ color: '#f59e0b' }} /> Quick Announcement Templates
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                  {BROADCAST_TEMPLATES.map((tmpl) => {
                    const isSelected = selectedTemplateId === tmpl.id;
                    return (
                      <div
                        key={tmpl.id}
                        onClick={() => handleApplyTemplate(tmpl)}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          border: isSelected ? '1.5px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #e2e8f0)',
                          backgroundColor: isSelected ? 'var(--primary-surface, #eff6ff)' : 'var(--bg-surface, #ffffff)',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          boxShadow: isSelected ? '0 2px 6px rgba(37, 99, 235, 0.1)' : '0 1px 2px rgba(0,0,0,0.02)',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '15px' }}>{tmpl.icon}</span>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 750,
                              textTransform: 'uppercase',
                              letterSpacing: '0.03em',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: isSelected ? 'var(--primary, #2563eb)' : '#f1f5f9',
                              color: isSelected ? '#ffffff' : 'var(--text-muted)',
                            }}
                          >
                            {tmpl.badge}
                          </span>
                        </div>
                        <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                          {tmpl.title.replace(/^[^a-zA-Z0-9]+/, '')}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                          {tmpl.description}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Title & Message Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '4px' }}>
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Please Refresh Your Browser"
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium, #cbd5e1)',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      fontWeight: 650,
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Announcement Details
                    </label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      {message.length} characters
                    </span>
                  </div>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Type announcement details here..."
                    style={{
                      flex: 1,
                      minHeight: '110px',
                      width: '100%',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-medium, #cbd5e1)',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      color: 'var(--text-primary)',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      outline: 'none',
                      resize: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: BROADCASTING PREVIEW */}
          {currentStep === 'preview' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                padding: '4px 0',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Announcement Preview
                </div>
                <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Targeting <strong style={{ color: 'var(--primary, #2563eb)' }}>{selectedAgentIds.size}</strong> {selectedAgentIds.size === 1 ? 'agent' : 'agents'}. This modal will pop up immediately on their screen.
                </div>
              </div>

              {/* Centered Modal Mockup */}
              <div
                style={{
                  width: '100%',
                  maxWidth: '480px',
                  border: '1px solid var(--border-medium, #cbd5e1)',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Mock Banner */}
                <div
                  style={{
                    background: 'linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-hover, #1d4ed8) 100%)',
                    padding: '20px 22px 16px',
                    color: '#ffffff',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: '42px',
                      height: '42px',
                      margin: '0 auto 8px',
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #fef08a, #eab308)',
                      color: '#713f12',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 12px rgba(234, 179, 8, 0.4)',
                    }}
                  >
                    <Megaphone size={20} />
                  </div>
                  <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 800, opacity: 0.9 }}>
                    Team Announcement
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, marginTop: '2px' }}>
                    {title || 'Announcement'}
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.85, marginTop: '2px' }}>
                    Broadcast by {user?.fullName || 'Administrator'} • Just now
                  </div>
                </div>

                {/* Mock Message Content */}
                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div
                    style={{
                      fontSize: '12.5px',
                      lineHeight: 1.55,
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-app, #f8fafc)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '8px',
                      padding: '12px',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '180px',
                      overflowY: 'auto',
                    }}
                  >
                    {message || 'No message entered.'}
                  </div>

                  {/* Mock Action Buttons */}
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {isRefreshRecommendation && (
                      <div
                        style={{
                          flex: 1,
                          padding: '8px 12px',
                          borderRadius: '7px',
                          fontSize: '11.5px',
                          fontWeight: 700,
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          border: '1px solid #fde68a',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '5px',
                        }}
                      >
                        <RotateCw size={13} /> Refresh Browser Now
                      </div>
                    )}
                    <div
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        borderRadius: '7px',
                        fontSize: '11.5px',
                        fontWeight: 700,
                        backgroundColor: 'var(--primary, #2563eb)',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '5px',
                      }}
                    >
                      <CheckCircle2 size={13} /> Acknowledge & Close
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer Controls */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
            flexShrink: 0,
          }}
        >
          {/* Left Action: Back or Cancel */}
          {currentStep === 'recipients' ? (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 650,
                backgroundColor: 'transparent',
                color: 'var(--text-secondary, #475569)',
                border: '1px solid var(--border-medium, #cbd5e1)',
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCurrentStep(currentStep === 'preview' ? 'compose' : 'recipients')}
              style={{
                padding: '8px 16px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 650,
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium, #cbd5e1)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <ArrowLeft size={14} /> Back
            </button>
          )}

          {/* Right Action: Next or Send */}
          {currentStep === 'recipients' && (
            <button
              type="button"
              disabled={selectedAgentIds.size === 0}
              onClick={() => setCurrentStep('compose')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: selectedAgentIds.size === 0 ? 'not-allowed' : 'pointer',
                opacity: selectedAgentIds.size === 0 ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              }}
            >
              Continue to Message ({selectedAgentIds.size} selected) <ArrowRight size={14} />
            </button>
          )}

          {currentStep === 'compose' && (
            <button
              type="button"
              disabled={!message.trim()}
              onClick={() => setCurrentStep('preview')}
              style={{
                padding: '8px 18px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: !message.trim() ? 'not-allowed' : 'pointer',
                opacity: !message.trim() ? 0.5 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                boxShadow: '0 1px 3px rgba(37, 99, 235, 0.25)',
              }}
            >
              Preview Announcement <ArrowRight size={14} />
            </button>
          )}

          {currentStep === 'preview' && (
            <button
              type="button"
              disabled={isSending || selectedAgentIds.size === 0 || !message.trim()}
              onClick={handleSendBroadcast}
              style={{
                padding: '9px 22px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 750,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: isSending || selectedAgentIds.size === 0 || !message.trim() ? 'not-allowed' : 'pointer',
                opacity: isSending || selectedAgentIds.size === 0 || !message.trim() ? 0.6 : 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.35)',
              }}
            >
              <Send size={14} />
              {isSending
                ? 'Broadcasting...'
                : `Launch Broadcast (${selectedAgentIds.size} ${selectedAgentIds.size === 1 ? 'agent' : 'agents'})`}
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

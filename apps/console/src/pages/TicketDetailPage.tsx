import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  History,
  Monitor,
  Video,
  UserCheck,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { StatusBadge, PriorityPill, TierBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { DiagnosticsView, DiagnosticsData } from '../components/tickets/DiagnosticsView';
import { MediaPlayer, MediaAssetItem } from '../components/media/MediaPlayer';
import { ReplyComposer } from '../components/tickets/ReplyComposer';
import { SlaCountdown } from '../components/tickets/SlaCountdown';
import { TimelineView, CommentItem } from '../components/tickets/TimelineView';
import { HistoryView } from '../components/tickets/HistoryView';
import { TicketTagManager } from '../components/tickets/TicketTagManager';
import { TicketCategoryManager } from '../components/tickets/TicketCategoryManager';
import { OrganizationProductManager } from '../components/tickets/OrganizationProductManager';
import { AssignmentPopover } from '../components/tickets/AssignmentPopover';
import { StatusPopover } from '../components/tickets/StatusPopover';
import { TransferTierModal } from '../components/tickets/TransferTierModal';
import { StatusTransitionModal } from '../components/tickets/StatusTransitionModal';
import { FormattedEmailContent } from '../components/common/FormattedEmailContent';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSocket } from '../context/SocketContext';

export const TicketDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const { socket } = useSocket();

  const canWriteInternal =
    !!user && !user.roles.includes('TENANT_ADMIN') && !user.roles.includes('GUEST_CUSTOMER');

  const [ticket, setTicket] = useState<any | null>(null);
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAssetItem[]>([]);
  const [historyCount, setHistoryCount] = useState<number | null>(null);
  const [availableTransitions, setAvailableTransitions] = useState<any[]>([]);
  const [staffUsers, setStaffUsers] = useState<any[]>([]);
  const [pendingTier, setPendingTier] = useState<string | null>(null);
  const [pendingStatusTransition, setPendingStatusTransition] = useState<{
    toStatus: string;
    requiresComment?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [maximizedSection, setMaximizedSection] = useState<
    'none' | 'description' | 'workspace'
  >('none');
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'history' | 'diagnostics' | 'media' | 'approvals'
  >('timeline');
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const canChangePriority =
    !!user &&
    Boolean(
      user.roles?.some((r: string) => ['L2_SUPPORT', 'L3_SUPPORT', 'PLATFORM_ADMIN'].includes(r)),
    );

  useEffect(() => {
    if (id) loadTicketDetails(id);
    ApiClient.get<any[]>('/admin/users')
      .then((users) => {
        if (Array.isArray(users)) {
          setStaffUsers(users.filter((u: any) => u.kind === 'STAFF' && u.status === 'ACTIVE'));
        }
      })
      .catch(() => {});
  }, [id]);

  // Real-time live comment and ticket update synchronization
  const mapComments = (list: any[]): CommentItem[] =>
    (list || []).map((c: any) => ({
      ...c,
      isInternal: c.isInternal ?? (c.visibility === 'INTERNAL'),
      attachments: c.mediaAssets
        ? c.mediaAssets.map((att: any) => ({
            id: att.id,
            originalFilename: att.originalFilename,
            mimeType: att.mimeType,
          }))
        : c.attachments || [],
    }));

  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_ticket', { ticketId: id });

    const handleCommented = (data: any) => {
      if (data.ticketId === id) {
        ApiClient.get<any>(`/tickets/${id}/comments?pageSize=100`)
          .then((res) => {
            const list = res.comments || res.items || (Array.isArray(res) ? res : []);
            setComments(mapComments(list));
          })
          .catch(() => {});

        ApiClient.get<MediaAssetItem[]>(`/tickets/${id}/media`)
          .then((media) => setMediaAssets(media))
          .catch(() => {});
      }
    };

    const handleUpdated = (data: any) => {
      if (data.ticketId === id && data.ticket) {
        setTicket((prev: any) => (prev ? { ...prev, ...data.ticket } : null));
      }
    };

    socket.on('ticket.commented', handleCommented);
    socket.on('ticket.updated', handleUpdated);

    return () => {
      socket.emit('leave_ticket', { ticketId: id });
      socket.off('ticket.commented', handleCommented);
      socket.off('ticket.updated', handleUpdated);
    };
  }, [socket, id]);

  const loadTicketDetails = async (ticketId: string) => {
    setIsLoading(true);
    try {
      const [data, commentsRes, transitionsRes] = await Promise.all([
        ApiClient.get(`/tickets/${ticketId}`),
        ApiClient.get<any>(`/tickets/${ticketId}/comments?pageSize=100`),
        ApiClient.get<any>(`/tickets/${ticketId}/transitions`).catch(() => null),
      ]);
      setTicket(data);
      setAvailableTransitions(transitionsRes?.transitions || []);
      const mappedComments = mapComments(commentsRes.comments || []);
      setComments(mappedComments);
      // Smart Adaptive Default: Auto-expand if fresh ticket (0 replies), auto-collapse if ongoing conversation thread
      setIsDescriptionExpanded(mappedComments.length === 0);
      setDiagnostics(data.diagnostics || data.diagnosticBundle?.payload || null);
      try {
        setMediaAssets(await ApiClient.get<MediaAssetItem[]>(`/tickets/${ticketId}/media`));
      } catch {
        setMediaAssets([]);
      }
    } catch {
      // Ignore
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendComment = async (
    body: string,
    isInternal: boolean,
    attachments?: string[],
    cc?: string[],
  ) => {
    if (!id) return;
    setIsSending(true);
    try {
      const newComment = await ApiClient.post(`/tickets/${id}/comments`, {
        body,
        visibility: isInternal ? 'INTERNAL' : 'PUBLIC',
        attachments,
        ...(cc && cc.length > 0 ? { cc } : {}),
      });
      const mapped = {
        ...newComment,
        isInternal: newComment.visibility === 'INTERNAL',
        attachments: newComment.mediaAssets
          ? newComment.mediaAssets.map((att: any) => ({
              id: att.id,
              originalFilename: att.originalFilename,
              mimeType: att.mimeType,
            }))
          : [],
      };
      setComments((prev) => [...prev, mapped]);
      toast.success(isInternal ? 'Internal note added!' : 'Reply sent successfully!');
      try {
        setMediaAssets(await ApiClient.get<MediaAssetItem[]>(`/tickets/${id}/media`));
      } catch {
        // Ignore
      }
    } catch (err: any) {
      toast.error(`Failed to post message: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id || newStatus === ticket?.status) return;
    const transition = availableTransitions.find((t: any) => t.toStatus === newStatus);
    const requiresComment =
      Boolean(transition?.requiresComment) ||
      ['PENDING_CUSTOMER', 'ON_HOLD', 'CANCELLED'].includes(newStatus);

    if (requiresComment) {
      setPendingStatusTransition({ toStatus: newStatus, requiresComment });
      return;
    }

    await executeStatusTransition(newStatus);
  };

  const executeStatusTransition = async (newStatus: string, comment?: string) => {
    if (!id) return;
    try {
      const res: any = await ApiClient.post(`/tickets/${id}/transitions`, { toStatus: newStatus, comment });
      if (res?.kind === 'pending_approval') {
        toast.info(`Transition to ${newStatus} requires sign-off. Approval request #${res.approvalRequestId || ''} submitted.`);
      } else {
        setTicket((prev: any) => ({ ...prev, status: newStatus }));
        toast.success(`Ticket status updated to ${newStatus}!`);
      }
      loadTicketDetails(id);
    } catch (err: any) {
      toast.error(`Status transition failed: ${err.message}`);
      throw err;
    }
  };

  const handleTierEscalate = (newTier: string) => {
    if (!id || newTier === ticket?.tier) return;
    setPendingTier(newTier);
  };

  const handleConfirmTierTransfer = async (reason: string) => {
    if (!id || !pendingTier) return;
    try {
      await ApiClient.post(`/tickets/${id}/escalate`, { toTier: pendingTier, reason });
      loadTicketDetails(id);
      toast.success(`Ticket successfully moved to tier ${pendingTier}!`);
      setPendingTier(null);
    } catch (err: any) {
      toast.error(`Tier transfer failed: ${err.message}`);
      throw err;
    }
  };

  const handlePriorityChange = async (newPriority: string) => {
    if (!id) return;
    try {
      await ApiClient.patch(`/tickets/${id}`, { priority: newPriority });
      setTicket((prev: any) => ({ ...prev, priority: newPriority }));
      toast.success(`Ticket priority updated to ${newPriority}!`);
    } catch (err: any) {
      toast.error(`Priority update failed: ${err.message}`);
    }
  };

  const handleAssignUser = async (assigneeId: string) => {
    if (!id) return;
    try {
      const selectedUser = staffUsers.find((u) => u.id === assigneeId);
      const isUnassigning = assigneeId === 'unassigned';
      const res: any = await ApiClient.post(`/tickets/${id}/assign`, {
        assigneeId: isUnassigning ? null : assigneeId,
      });
      setTicket((prev: any) => ({
        ...prev,
        status: res?.status || (!isUnassigning && prev?.status === 'NEW' ? 'OPEN' : prev?.status),
        assignee: selectedUser ? { id: selectedUser.id, fullName: selectedUser.fullName } : null,
      }));
      loadTicketDetails(id);
      toast.success(
        isUnassigning
          ? 'Ticket unassigned'
          : `Ticket assigned to ${selectedUser?.fullName || selectedUser?.email || 'agent'}!`,
      );
    } catch (err: any) {
      toast.error(`Assignment failed: ${err.message}`);
    }
  };

  const handleAssignToMe = async () => {
    if (!id || !user) return;
    try {
      const res: any = await ApiClient.post(`/tickets/${id}/assign`, { assigneeId: user.id });
      setTicket((prev: any) => ({
        ...prev,
        status: res?.status || (prev?.status === 'NEW' ? 'OPEN' : prev?.status),
        assignee: { id: user.id, fullName: user.fullName },
      }));
      loadTicketDetails(id);
      toast.success('Ticket successfully assigned to you!');
    } catch (err: any) {
      toast.error(`Assignment failed: ${err.message}`);
    }
  };

  if (isLoading || !ticket) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingSpinner size={32} text="Loading ticket workspace..." />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header & Actions Bar */}
      <div
        style={{
          flexShrink: 0,
          padding: '12px 20px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button
            onClick={() => navigate('/inbox')}
            className="btn btn-secondary btn-sm"
            title="Back to Inbox"
          >
            <ArrowLeft size={16} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: 'var(--primary)',
                }}
              >
                #{ticket.number}
              </span>
              <TierBadge tier={ticket.tier} />
              {canChangePriority ? (
                <select
                  value={ticket.priority}
                  onChange={(e) => handlePriorityChange(e.target.value)}
                  style={{
                    padding: '3px 8px',
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    fontWeight: 700,
                    color:
                      ticket.priority === 'CRITICAL' || ticket.priority === 'URGENT'
                        ? 'var(--color-critical)'
                        : ticket.priority === 'HIGH'
                        ? '#f59e0b'
                        : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                  title="Change Priority (L1 / L2 / Staff)"
                >
                  <option value="LOW">Priority: LOW</option>
                  <option value="NORMAL">Priority: NORMAL</option>
                  <option value="HIGH">Priority: HIGH</option>
                  <option value="URGENT">Priority: URGENT</option>
                  <option value="CRITICAL">Priority: CRITICAL</option>
                </select>
              ) : (
                <PriorityPill priority={ticket.priority} />
              )}
              <TicketCategoryManager
                ticketId={ticket.id}
                category={ticket.category}
                onCategoryChange={(newCategory) => setTicket((prev: any) => ({ ...prev, category: newCategory }))}
              />
              <TicketTagManager
                ticketId={ticket.id}
                tags={ticket.tags}
                onTagsChange={(newTags) => setTicket((prev: any) => ({ ...prev, tags: newTags }))}
              />
              {(ticket.customFields?.organization || ticket.organization) && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(56, 189, 248, 0.12)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.25)',
                  }}
                  title="Client Organization / Account"
                >
                  🏢 {ticket.customFields?.organization || ticket.organization}
                </span>
              )}
              {(ticket.customFields?.product || ticket.product) && (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    backgroundColor: 'rgba(168, 85, 247, 0.12)',
                    color: '#c084fc',
                    border: '1px solid rgba(168, 85, 247, 0.25)',
                  }}
                  title="Product"
                >
                  📦 {ticket.customFields?.product || ticket.product}
                </span>
              )}
            </div>
            <h2
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {ticket.subject}
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {/* Zoho Desk Styled Status Dropdown */}
          <StatusPopover
            status={ticket.status}
            onStatusChange={handleStatusChange}
          />

          {/* Tier Escalation / Transfer */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <select
              value={ticket.tier}
              onChange={(e) => handleTierEscalate(e.target.value)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-md, 6px)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                outline: 'none',
              }}
              title="Transfer / Escalate Tier"
            >
              <option value={ticket.tier} disabled>
                Tier: {ticket.tier}
              </option>
              {['L1', 'L2', 'L3', 'DEV', 'QA'].map((tierOption) => {
                if (tierOption === ticket.tier) return null;
                return (
                  <option key={tierOption} value={tierOption}>
                    Move to {tierOption}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Zoho Desk Styled Assignment Popover (Teams & Agents) */}
          <AssignmentPopover
            ticketId={ticket.id}
            currentAssignee={ticket.assignee}
            currentTeam={ticket.team}
            onAssigned={(res) => {
              if (res.assignee !== undefined) {
                setTicket((prev: any) => ({
                  ...prev,
                  status: res.status || (res.assignee && prev?.status === 'NEW' ? 'OPEN' : prev?.status),
                  assignee: res.assignee,
                }));
              }
              if (res.team !== undefined) {
                setTicket((prev: any) => ({
                  ...prev,
                  status: res.status || prev?.status,
                  team: res.team,
                }));
              }
              loadTicketDetails(ticket.id);
            }}
          />

          {(!ticket.assignee || ticket.assignee.id !== user?.id) && (
            <button
              onClick={handleAssignToMe}
              className="btn btn-secondary btn-sm"
              title="Assign to Myself"
            >
              <UserCheck size={14} /> Assign to Me
            </button>
          )}
        </div>
      </div>

      {/* Main Split Body */}
      <div
        style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}
      >
        {/* Left Column: Context, Tabs, Conversation */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-app)',
          }}
        >
          {/* Top Section: Collapsible & Maximizable Description & SLA */}
          {maximizedSection !== 'workspace' && (
            <div
              style={{
                flexShrink: 0,
                ...(maximizedSection === 'description'
                  ? { flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }
                  : {}),
                padding: '12px 20px',
                backgroundColor: '#ffffff',
                borderBottom: '1px solid var(--border-subtle)',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '8px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: 'var(--text-muted)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Initial Description
                  </span>
                  {maximizedSection === 'none' && (
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--primary, #2563eb)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {isDescriptionExpanded ? (
                        <>
                          <span>Collapse</span>
                          <ChevronUp size={12} />
                        </>
                      ) : (
                        <>
                          <span>Expand</span>
                          <ChevronDown size={12} />
                        </>
                      )}
                    </button>
                  )}
                </div>

                {/* Right controls: SLA Badges + Maximize/Restore Toggle Button */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <SlaCountdown clocks={ticket.slaClocks} ticketStatus={ticket.status} />

                  <div style={{ width: '1px', height: '16px', backgroundColor: 'var(--border-subtle)' }} />

                  <button
                    type="button"
                    onClick={() =>
                      setMaximizedSection(maximizedSection === 'description' ? 'none' : 'description')
                    }
                    title={
                      maximizedSection === 'description'
                        ? 'Restore Split View'
                        : 'Maximize Description Section'
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color:
                        maximizedSection === 'description'
                          ? 'var(--primary, #2563eb)'
                          : 'var(--text-secondary, #64748b)',
                      backgroundColor:
                        maximizedSection === 'description'
                          ? 'rgba(37, 99, 235, 0.08)'
                          : 'var(--bg-hover, #f1f5f9)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {maximizedSection === 'description' ? (
                      <>
                        <Minimize2 size={12} />
                        <span>Restore</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={12} />
                        <span>Maximize</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div
                style={{
                  margin: 0,
                  lineHeight: 1.45,
                  fontSize: '13px',
                  color: 'var(--text-primary)',
                  ...(maximizedSection === 'description'
                    ? { flex: 1, maxHeight: 'none', height: '100%' }
                    : { maxHeight: isDescriptionExpanded ? '320px' : '75px' }),
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                  transition: 'max-height 0.2s ease',
                }}
              >
                <FormattedEmailContent text={ticket.description} />
              </div>
            </div>
          )}

          {/* Bottom Section: Workspace Tabs & Dynamic Responsive Content */}
          {maximizedSection !== 'description' && (
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              {/* Workspace Tabs Header */}
              <div
                style={{
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-surface)',
                  padding: '0 20px',
                }}
              >
                <button
                  onClick={() => setActiveTab('timeline')}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'timeline' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom:
                      activeTab === 'timeline' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <MessageSquare size={14} /> Conversation ({comments.length})
                </button>

                <button
                  onClick={() => setActiveTab('history')}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom:
                      activeTab === 'history' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <History size={14} /> History {historyCount !== null ? `(${historyCount})` : ''}
                </button>

                <button
                  onClick={() => setActiveTab('diagnostics')}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'diagnostics' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom:
                      activeTab === 'diagnostics'
                        ? '2px solid var(--primary)'
                        : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Monitor size={14} /> Telemetry & Diagnostics
                </button>

                <button
                  onClick={() => setActiveTab('media')}
                  style={{
                    padding: '10px 14px',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: activeTab === 'media' ? 'var(--primary)' : 'var(--text-secondary)',
                    borderBottom:
                      activeTab === 'media' ? '2px solid var(--primary)' : '2px solid transparent',
                    background: 'transparent',
                    borderTop: 'none',
                    borderLeft: 'none',
                    borderRight: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Video size={14} /> Screen Recordings & Media ({mediaAssets.length})
                </button>

                {/* Symmetrical Right Control: Maximize/Restore Workspace Section */}
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() =>
                      setMaximizedSection(maximizedSection === 'workspace' ? 'none' : 'workspace')
                    }
                    title={
                      maximizedSection === 'workspace'
                        ? 'Restore Split View'
                        : 'Maximize Activity Workspace'
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '11px',
                      fontWeight: 600,
                      color:
                        maximizedSection === 'workspace'
                          ? 'var(--primary, #2563eb)'
                          : 'var(--text-secondary, #64748b)',
                      backgroundColor:
                        maximizedSection === 'workspace'
                          ? 'rgba(37, 99, 235, 0.08)'
                          : 'var(--bg-hover, #f1f5f9)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '5px',
                      padding: '3px 8px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {maximizedSection === 'workspace' ? (
                      <>
                        <Minimize2 size={12} />
                        <span>Restore</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={12} />
                        <span>Maximize</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Active Tab Content: Dynamic Responsive View */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                {activeTab === 'timeline' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    {/* Scrollable Conversation Stream */}
                    <div
                      ref={timelineScrollRef}
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '8px 0',
                      }}
                    >
                      <TimelineView comments={comments} />
                    </div>

                    {/* Docked Reply Composer at the bottom — Always visible without scrolling */}
                    <div style={{ flexShrink: 0, padding: '0 16px 14px', backgroundColor: 'var(--bg-app)' }}>
                      <ReplyComposer
                        onSend={handleSendComment}
                        isSending={isSending}
                        canWriteInternal={canWriteInternal}
                      />
                    </div>
                  </div>
                )}

                {activeTab === 'history' && (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                    <HistoryView
                      ticketId={ticket.id}
                      ticket={ticket}
                      onCountChange={(cnt) => setHistoryCount(cnt)}
                    />
                  </div>
                )}

                {activeTab === 'diagnostics' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <DiagnosticsView diagnostics={diagnostics} />
                  </div>
                )}

                {activeTab === 'media' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                    <MediaPlayer media={mediaAssets} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Customer & Ticket Sidebar Info */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          {/* Zoho Desk 3-Tier Architecture: Organization & Product */}
          <OrganizationProductManager
            ticketId={ticket.id}
            organization={ticket.customFields?.organization || ticket.organization || null}
            product={ticket.customFields?.product || ticket.product || null}
            onOrganizationChange={(newOrg) => {
              setTicket((prev: any) => ({
                ...prev,
                organization: newOrg,
                customFields: {
                  ...(prev?.customFields || {}),
                  organization: newOrg,
                },
              }));
            }}
            onProductChange={(newProd) => {
              setTicket((prev: any) => ({
                ...prev,
                product: newProd,
                customFields: {
                  ...(prev?.customFields || {}),
                  product: newProd,
                },
              }));
            }}
          />

          <div className="card" style={{ padding: '14px' }}>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              Customer Details
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <div>
                <strong>Name:</strong> {ticket.requester?.fullName || 'Customer'}
              </div>
              <div style={{ wordBreak: 'break-all' }}>
                <strong>Email:</strong> {ticket.requester?.email || 'N/A'}
              </div>
              <div>
                <strong>Channel:</strong> {ticket.channel}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '14px' }}>
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '10px',
              }}
            >
              Assignment & Queue
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
              <div>
                <strong>Assignee:</strong> {ticket.assignee?.fullName || 'Unassigned'}
              </div>
              <div>
                <strong>Queue:</strong> {ticket.queue?.name || 'General Queue'}
              </div>
              <div>
                <strong>Brand:</strong> {ticket.brand?.name || 'Default Brand'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transfer Tier Modal */}
      <TransferTierModal
        isOpen={!!pendingTier}
        ticketNumber={ticket.number}
        fromTier={ticket.tier}
        toTier={pendingTier || ''}
        onClose={() => setPendingTier(null)}
        onConfirm={handleConfirmTierTransfer}
      />

      {/* Status Transition Note Modal */}
      <StatusTransitionModal
        isOpen={!!pendingStatusTransition}
        ticketNumber={ticket.number}
        fromStatus={ticket.status}
        toStatus={pendingStatusTransition?.toStatus || ''}
        requiresComment={pendingStatusTransition?.requiresComment}
        onClose={() => setPendingStatusTransition(null)}
        onConfirm={(comment) => executeStatusTransition(pendingStatusTransition!.toStatus, comment)}
      />
    </div>
  );
};

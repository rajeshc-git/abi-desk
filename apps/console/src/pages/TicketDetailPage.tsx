import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
  Zap,
  Grid,
  X,
  GitMerge,
  Globe,
  Lock,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { TicketsApi } from '../api/tickets';
import { StatusBadge, PriorityPill, TierBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { DiagnosticsView, DiagnosticsData } from '../components/tickets/DiagnosticsView';
import { MediaPlayer, MediaAssetItem } from '../components/media/MediaPlayer';
import { MergedTicketsView } from '../components/tickets/MergedTicketsView';
import { ReplyComposer } from '../components/tickets/ReplyComposer';
import { SlaCountdown } from '../components/tickets/SlaCountdown';
import { TimelineView, CommentItem } from '../components/tickets/TimelineView';
import { HistoryView } from '../components/tickets/HistoryView';
import { TicketTagManager } from '../components/tickets/TicketTagManager';
import { TicketCategoryManager } from '../components/tickets/TicketCategoryManager';
import { OrganizationProductManager } from '../components/tickets/OrganizationProductManager';
import { TicketRcaCapaManager } from '../components/tickets/TicketRcaCapaManager';
import { AssignmentPopover } from '../components/tickets/AssignmentPopover';
import { StatusPopover } from '../components/tickets/StatusPopover';
import { PriorityPopover } from '../components/tickets/PriorityPopover';
import { TierPopover } from '../components/tickets/TierPopover';
import { TransferTierModal } from '../components/tickets/TransferTierModal';
import { StatusTransitionModal } from '../components/tickets/StatusTransitionModal';
import { SplitTicketModal } from '../components/tickets/SplitTicketModal';
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
  const [splitComment, setSplitComment] = useState<CommentItem | null>(null);
  const [pendingStatusTransition, setPendingStatusTransition] = useState<{
    toStatus: string;
    requiresComment?: boolean;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isActionSheetOpen, setIsActionSheetOpen] = useState(false);
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const validTabs = ['timeline', 'properties', 'history', 'diagnostics', 'media', 'approvals', 'merged'];
  const [activeTab, setActiveTab] = useState<
    'timeline' | 'properties' | 'history' | 'diagnostics' | 'media' | 'approvals' | 'merged'
  >(tabParam && validTabs.includes(tabParam) ? (tabParam as any) : 'timeline');

  const [isReplyOpen, setIsReplyOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<'public' | 'internal'>('public');

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    if (currentTab && validTabs.includes(currentTab)) {
      setActiveTab(currentTab as any);
    }
  }, [searchParams]);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  useEffect(() => {
    if (activeTab === 'merged' && ticket) {
      const hasMerged =
        (ticket.linksTo || []).some((l: any) => l.type === 'MERGED_INTO') ||
        (ticket.linksFrom || []).some((l: any) => l.type === 'MERGED_INTO');
      if (!hasMerged) {
        setActiveTab('timeline');
      }
    }
  }, [ticket, activeTab]);

  const canChangePriority =
    !!user &&
    Boolean(
      user.roles?.some((r: string) =>
        ['L2_SUPPORT', 'L3_SUPPORT', 'DEV_TEAM', 'DEVOPS_TEAM', 'TENANT_ADMIN', 'PLATFORM_ADMIN'].includes(r),
      ),
    );

  useEffect(() => {
    if (id) loadTicketDetails(id);
    ApiClient.get<any[]>('/admin/users')
      .then((users) => {
        if (Array.isArray(users)) {
          setStaffUsers(users.filter((u: any) => u.kind === 'STAFF' && u.status === 'ACTIVE'));
        }
      })
      .catch(() => { });
  }, [id]);

  // Real-time live comment and ticket update synchronization
  const mapComments = (list: any[]): CommentItem[] =>
    (list || [])
      .filter(
        (c: any) =>
          c.systemLabel !== 'Merge Automation' &&
          c.systemLabel !== 'Unmerge Action' &&
          !c.body?.startsWith('Merged ') &&
          !c.body?.startsWith('Merged into ') &&
          !c.body?.startsWith('Unmerged ') &&
          !c.body?.includes('into this ticket:') &&
          !c.body?.includes('has been unmerged from this ticket.'),
      )
      .map((c: any) => ({
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
          .catch(() => { });

        ApiClient.get<MediaAssetItem[]>(`/tickets/${id}/media`)
          .then((media) => setMediaAssets(media))
          .catch(() => { });
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

  const handleUnmergeTicket = async (primaryTicketId: string, secondaryTicketId: string) => {
    try {
      const updatedMaster: any = await TicketsApi.unmerge(primaryTicketId, secondaryTicketId);
      toast.success('Ticket unmerged and restored to Open status.');
      setTicket(updatedMaster);
      if (id) loadTicketDetails(id);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to unmerge ticket');
      throw err;
    }
  };

  const handleConfirmSplit = async (data: {
    commentId: string;
    subject: string;
    description?: string;
    priority?: string;
    category?: string;
    tier?: string;
    organization?: string;
    product?: string;
  }) => {
    if (!ticket?.id) return;
    try {
      const newTicket: any = await TicketsApi.split(ticket.id, data);
      toast.success(`Split ticket #${newTicket.number || ''} created successfully!`);
      loadTicketDetails(ticket.id);
      if (newTicket?.id) {
        navigate(`/tickets/${newTicket.id}`);
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to split ticket');
      throw err;
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

  const renderSidebarDetails = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
            <strong>Assignee:</strong> {ticket.assignee?.fullName || ticket.assignee?.name || 'Unassigned'}
          </div>
          <div>
            <strong>Team:</strong> {ticket.team?.name || (typeof ticket.team === 'string' ? ticket.team : undefined) || 'Unassigned'}
          </div>
          <div>
            <strong>Queue:</strong> {ticket.queue?.name || 'General Queue'}
          </div>
          <div>
            <strong>Brand:</strong> {ticket.brand?.name || 'Default Brand'}
          </div>
        </div>
      </div>

      {/* SLA Targets & Clocks Card */}
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
          SLA Targets & Clocks
        </h4>
        <SlaCountdown clocks={ticket.slaClocks} ticketStatus={ticket.status} />
      </div>

      {/* Staff-Only Root Cause Analysis (RCA) & CAPA Action Sections */}
      <TicketRcaCapaManager
        ticketId={ticket.id}
        rootCause={ticket.rootCause}
        capaNotes={ticket.capaNotes}
        rcaUpdatedAt={ticket.rcaUpdatedAt}
        capaUpdatedAt={ticket.capaUpdatedAt}
        rcaUpdatedBy={ticket.rcaUpdatedBy}
        capaUpdatedBy={ticket.capaUpdatedBy}
        onUpdate={(updated) => {
          setTicket((prev: any) => ({
            ...prev,
            ...updated,
          }));
        }}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top Header & Actions Bar */}
      <div className="ticket-header-bar">
        <div className="ticket-header-left">
          <button
            onClick={() => {
              if (id || ticket?.id) {
                try {
                  sessionStorage.setItem('last_selected_ticket_id', id || ticket.id);
                } catch {}
              }
              navigate(`/inbox?ticketId=${id || ticket?.id}`);
            }}
            className="ticket-header-back-btn"
            title="Back to Inbox"
          >
            <ArrowLeft size={16} />
          </button>
          <span className="ticket-id-badge">
            #{ticket.number}
          </span>
          <TierBadge tier={ticket.tier} />

          <div className="desktop-only-pill" style={{ gap: '6px' }}>
            <PriorityPopover
              priority={ticket.priority}
              onPriorityChange={handlePriorityChange}
              disabled={!canChangePriority}
              align="left"
            />
            <TicketCategoryManager
              ticketId={ticket.id}
              category={ticket.category}
              onCategoryChange={(newCategory) => setTicket((prev: any) => ({ ...prev, category: newCategory }))}
            />
            <TicketTagManager
              ticketId={ticket.id}
              tags={ticket.tags}
              maxVisible={3}
              onTagsChange={(newTags) => setTicket((prev: any) => ({ ...prev, tags: newTags }))}
            />
            {(ticket.customFields?.organization || ticket.organization) && (
              <span
                className="pill-badge"
                style={{
                  backgroundColor: 'rgba(56, 189, 248, 0.12)',
                  color: '#0284c7',
                  border: '1px solid rgba(56, 189, 248, 0.25)',
                }}
                title="Client Organization / Account"
              >
                🏢 {ticket.customFields?.organization || ticket.organization}
              </span>
            )}
            {(ticket.customFields?.product || ticket.product) && (
              <span
                className="pill-badge"
                style={{
                  backgroundColor: 'rgba(168, 85, 247, 0.12)',
                  color: '#9333ea',
                  border: '1px solid rgba(168, 85, 247, 0.25)',
                }}
                title="Product"
              >
                📦 {ticket.customFields?.product || ticket.product}
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="ticket-header-actions">
          {/* Zoho Desk Styled Status Dropdown */}
          <StatusPopover
            status={ticket.status}
            onStatusChange={handleStatusChange}
          />

          {/* 9-Dots Grid Quick Actions Button (Mobile & Tablet) */}
          <button
            type="button"
            className="mobile-quick-actions-btn"
            onClick={() => setIsActionSheetOpen(true)}
            title="Ticket Quick Actions"
          >
            <Grid size={16} />
          </button>

          <div className="desktop-only-pill" style={{ gap: '6px' }}>
            {/* Tier Escalation / Transfer Popover */}
            <TierPopover
              tier={ticket.tier}
              onTierSelect={handleTierEscalate}
              align="right"
            />

            {/* Zoho Desk Styled Assignment Popover (Teams & Agents) */}
            <AssignmentPopover
              ticketId={ticket.id}
              currentAssignee={ticket.assignee}
              currentTeam={ticket.team}
              align="right"
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
                className="ticket-action-pill"
                title="Assign to Myself"
              >
                <UserCheck size={14} /> Assign to Me
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Split Body */}
      <div className="ticket-workspace-body">
        {/* Left Column: Context, Tabs, Conversation */}
        <div
          className={`ticket-workspace-main ${isFullscreen ? 'is-maximized' : ''}`}
        >
          {/* Ticket Subject Header Banner */}
          <div className="ticket-subject-banner">
            <h1 className="ticket-subject-title" title={ticket.subject}>
              {ticket.subject}
            </h1>
            <div className="ticket-subject-meta">
              <span>
                From <strong style={{ color: 'var(--text-primary)' }}>{ticket.requester?.fullName || ticket.requester?.email || ticket.customer?.fullName || 'Customer'}</strong>
                {ticket.requester?.email ? ` (${ticket.requester.email})` : ''}
              </span>
              {ticket.createdAt && (
                <>
                  <span className="meta-dot">•</span>
                  <span>{new Date(ticket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </>
              )}
              {ticket.channel && (
                <>
                  <span className="meta-dot">•</span>
                  <span style={{ textTransform: 'capitalize' }}>via {ticket.channel.toLowerCase()}</span>
                </>
              )}
            </div>
          </div>

          {/* Merged Secondary Tickets Banner (When viewing a Master Ticket) */}
          {((ticket.linksTo?.filter((l: any) => l.type === 'MERGED_INTO')) || []).length > 0 && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: 'rgba(37, 99, 235, 0.05)',
                borderBottom: '1px solid rgba(37, 99, 235, 0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--primary)',
                flexShrink: 0,
              }}
            >
              <GitMerge size={15} />
              <span>
                <strong>{ticket.linksTo.filter((l: any) => l.type === 'MERGED_INTO').length} Ticket(s) Merged</strong> into this ticket
              </span>
            </div>
          )}

          {/* Merged Into Master Ticket Banner (When viewing a Closed Secondary Ticket) */}
          {ticket.linksFrom?.find((l: any) => l.type === 'MERGED_INTO') && (
            <div
              style={{
                padding: '10px 16px',
                backgroundColor: '#fffbeb',
                borderBottom: '1px solid #fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                color: '#92400e',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <GitMerge size={14} />
                <span>
                  This ticket was merged into Master Ticket{' '}
                  <strong style={{ color: '#78350f' }}>
                    #{ticket.linksFrom.find((l: any) => l.type === 'MERGED_INTO')?.target?.number}
                  </strong>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = ticket.linksFrom.find((l: any) => l.type === 'MERGED_INTO')?.target?.id;
                    if (targetId) navigate(`/tickets/${targetId}`);
                  }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  View Master Ticket
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const targetId = ticket.linksFrom.find((l: any) => l.type === 'MERGED_INTO')?.target?.id;
                    if (targetId) handleUnmergeTicket(targetId, ticket.id);
                  }}
                  className="btn btn-danger btn-sm"
                  style={{ fontSize: '11px', padding: '2px 8px' }}
                >
                  Unmerge
                </button>
              </div>
            </div>
          )}

          {/* Workspace Tabs & Dynamic Responsive Content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            {/* Single Unified Workspace Tabs Header */}
            <div className="workspace-tabs-bar">
              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`workspace-tab-item ${activeTab === 'timeline' ? 'active' : ''}`}
              >
                <MessageSquare size={14} /> Conversation ({comments.length > 0 ? `${comments.length}` : '1'})
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('properties')}
                className={`workspace-tab-item mobile-only-tab ${activeTab === 'properties' ? 'active' : ''}`}
              >
                <UserCheck size={14} /> Details & Client
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('history')}
                className={`workspace-tab-item ${activeTab === 'history' ? 'active' : ''}`}
              >
                <History size={14} /> History {historyCount !== null ? `(${historyCount})` : ''}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('diagnostics')}
                className={`workspace-tab-item ${activeTab === 'diagnostics' ? 'active' : ''}`}
              >
                <Monitor size={14} /> Diagnostics
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('media')}
                className={`workspace-tab-item ${activeTab === 'media' ? 'active' : ''}`}
              >
                <Video size={14} /> Media ({mediaAssets.length})
              </button>

              {(((ticket?.linksTo || []).some((l: any) => l.type === 'MERGED_INTO')) ||
                ((ticket?.linksFrom || []).some((l: any) => l.type === 'MERGED_INTO'))) && (
                <button
                  type="button"
                  onClick={() => setActiveTab('merged')}
                  className={`workspace-tab-item ${activeTab === 'merged' ? 'active' : ''}`}
                >
                  <GitMerge size={14} /> Merged ({((ticket.linksTo || []).filter((l: any) => l.type === 'MERGED_INTO')).length || 1})
                </button>
              )}

              {/* Symmetrical Right Control: Browser Fullscreen Toggle (Desktop only) */}
              <div className="desktop-only-tab-action" style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: isFullscreen ? 'var(--primary, #2563eb)' : 'var(--text-secondary, #64748b)',
                    backgroundColor: isFullscreen ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-hover, #f1f5f9)',
                    border: '1px solid var(--border-subtle, #e2e8f0)',
                    borderRadius: '5px',
                    padding: '4px 9px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isFullscreen ? (
                    <>
                      <Minimize2 size={12} />
                      <span>Exit Full Screen</span>
                    </>
                  ) : (
                    <>
                      <Maximize2 size={12} />
                      <span>Full Screen</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Active Tab Content: Dynamic Responsive View */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
              {activeTab === 'timeline' && (
                <div className="ticket-conversation-split-layout">
                  {/* Left Pane: Scrollable Conversation Stream (100% full width when reading, 50% split when composing) */}
                  <div
                    ref={timelineScrollRef}
                    className={`ticket-conversation-stream-pane ${isReplyOpen ? 'is-split' : 'is-full'}`}
                    style={{ display: 'flex', flexDirection: 'column', height: '100%' }}
                  >
                    <div style={{ flex: 1, overflowY: 'auto' }}>
                      <TimelineView
                        comments={comments}
                        onSplitComment={(c) => setSplitComment(c)}
                        initialTicket={{
                          description: ticket.description,
                          requester: ticket.requester,
                          createdAt: ticket.createdAt,
                          channel: ticket.channel,
                          mediaAssets: ticket.mediaAssets || [],
                        }}
                      />
                    </div>

                    {/* Bottom Action Bar when Reply is Closed (100% reading mode) */}
                    {!isReplyOpen && (
                      <div
                        style={{
                          padding: '12px 20px',
                          backgroundColor: 'var(--bg-surface, #ffffff)',
                          borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={() => {
                              setReplyMode('public');
                              setIsReplyOpen(true);
                            }}
                            className="btn btn-primary"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '8px 18px',
                              fontSize: '13px',
                              fontWeight: 600,
                              borderRadius: '6px',
                              cursor: 'pointer',
                            }}
                          >
                            <Globe size={14} />
                            <span>Reply to Customer</span>
                          </button>

                          {canWriteInternal && (
                            <button
                              type="button"
                              onClick={() => {
                                setReplyMode('internal');
                                setIsReplyOpen(true);
                              }}
                              className="btn btn-secondary"
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '8px 16px',
                                fontSize: '13px',
                                fontWeight: 600,
                                borderRadius: '6px',
                                cursor: 'pointer',
                                backgroundColor: 'rgba(245, 158, 11, 0.12)',
                                color: '#b45309',
                                border: '1px solid rgba(245, 158, 11, 0.3)',
                              }}
                            >
                              <Lock size={14} />
                              <span>Add Internal Note</span>
                            </button>
                          )}
                        </div>

                        <span style={{ fontSize: '12px', color: 'var(--text-muted, #64748b)' }}>
                          Click Reply to open side-by-side composer
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Right 50% Pane: Dedicated Spacious Reply Composer (Only when open) */}
                  {isReplyOpen && (
                    <div className="ticket-conversation-composer-pane">
                      <ReplyComposer
                        onSend={async (b, i, a, c) => {
                          await handleSendComment(b, i, a, c);
                          setIsReplyOpen(false);
                        }}
                        isSending={isSending}
                        canWriteInternal={canWriteInternal}
                        ticket={ticket}
                        initialIsInternal={replyMode === 'internal'}
                        onClose={() => setIsReplyOpen(false)}
                      />
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'properties' && (
                <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
                  {renderSidebarDetails()}
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

              {activeTab === 'merged' && (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                  <MergedTicketsView
                    ticket={ticket}
                    onUnmerge={handleUnmergeTicket}
                    onRefresh={() => {
                      if (id) loadTicketDetails(id);
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Customer & Ticket Sidebar Info (Desktop Split) */}
        <div className="ticket-workspace-sidebar desktop-only-sidebar">
          {renderSidebarDetails()}
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

      {/* Mobile Quick Action Bottom Sheet */}
      <div className={`mobile-action-sheet ${isActionSheetOpen ? 'open' : ''}`}>
        <div className="mobile-action-backdrop" onClick={() => setIsActionSheetOpen(false)} />
        <div className="mobile-action-drawer">
          <div className="mobile-action-drawer-header">
            <div className="mobile-action-drawer-title">
              <Zap size={18} color="var(--primary, #2563eb)" />
              <span>Ticket Quick Actions</span>
            </div>
            <button
              type="button"
              className="mobile-action-drawer-close"
              onClick={() => setIsActionSheetOpen(false)}
            >
              <X size={16} />
            </button>
          </div>

          {/* Priority & Tier Section */}
          <div className="mobile-action-section">
            <span className="mobile-action-section-title">Priority & Tier</span>
            <div className="mobile-action-pills-row">
              <PriorityPopover
                priority={ticket.priority}
                onPriorityChange={handlePriorityChange}
                disabled={!canChangePriority}
                align="left"
              />
              <TierPopover
                tier={ticket.tier}
                onTierSelect={handleTierEscalate}
                align="left"
              />
            </div>
          </div>

          {/* Assignment Section */}
          <div className="mobile-action-section">
            <span className="mobile-action-section-title">Assignment</span>
            <div className="mobile-action-pills-row">
              <AssignmentPopover
                ticketId={ticket.id}
                currentAssignee={ticket.assignee}
                currentTeam={ticket.team}
                align="left"
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
                  className="ticket-action-pill"
                  title="Assign to Myself"
                >
                  <UserCheck size={14} /> Assign to Me
                </button>
              )}
            </div>
          </div>

          {/* Category & Tags Section */}
          <div className="mobile-action-section">
            <span className="mobile-action-section-title">Category & Tags</span>
            <div className="mobile-action-pills-row">
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
            </div>
          </div>

          {/* Organization & Product Section */}
          {((ticket.customFields?.organization || ticket.organization) || (ticket.customFields?.product || ticket.product)) && (
            <div className="mobile-action-section">
              <span className="mobile-action-section-title">Client & Product</span>
              <div className="mobile-action-pills-row">
                {(ticket.customFields?.organization || ticket.organization) && (
                  <span
                    className="pill-badge"
                    style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      color: '#0284c7',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                  >
                    🏢 {ticket.customFields?.organization || ticket.organization}
                  </span>
                )}
                {(ticket.customFields?.product || ticket.product) && (
                  <span
                    className="pill-badge"
                    style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.12)',
                      color: '#9333ea',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                    }}
                  >
                    📦 {ticket.customFields?.product || ticket.product}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split as New Ticket Modal */}
      {splitComment && ticket && (
        <SplitTicketModal
          isOpen={Boolean(splitComment)}
          onClose={() => setSplitComment(null)}
          parentTicket={ticket}
          commentToSplit={splitComment}
          onConfirmSplit={handleConfirmSplit}
        />
      )}
    </div>
  );
};

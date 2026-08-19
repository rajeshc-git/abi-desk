import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  MessageSquare,
  Monitor,
  Video,
  ShieldCheck,
  UserCheck,
  ArrowUpRight,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { StatusBadge, PriorityPill, TierBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { DiagnosticsView, DiagnosticsData } from '../components/tickets/DiagnosticsView';
import { MediaPlayer, MediaAssetItem } from '../components/media/MediaPlayer';
import { ReplyComposer } from '../components/tickets/ReplyComposer';
import { SlaCountdown } from '../components/tickets/SlaCountdown';
import { TimelineView, CommentItem } from '../components/tickets/TimelineView';
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
  const [availableTransitions, setAvailableTransitions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [activeTab, setActiveTab] = useState<'timeline' | 'diagnostics' | 'media' | 'approvals'>(
    'timeline',
  );

  useEffect(() => {
    if (id) loadTicketDetails(id);
  }, [id]);

  // Real-time live comment and ticket update synchronization
  useEffect(() => {
    if (!socket || !id) return;

    socket.emit('join_ticket', { ticketId: id });

    const handleCommented = (data: any) => {
      if (data.ticketId === id) {
        ApiClient.get<any>(`/tickets/${id}/comments?pageSize=100`)
          .then((res) => {
            const list = res.comments || res.items || (Array.isArray(res) ? res : []);
            setComments(list);
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
      const mappedComments = (commentsRes.comments || []).map((c: any) => ({
        ...c,
        isInternal: c.visibility === 'INTERNAL',
        attachments: c.mediaAssets
          ? c.mediaAssets.map((att: any) => ({
              id: att.id,
              originalFilename: att.originalFilename,
              mimeType: att.mimeType,
            }))
          : [],
      }));
      setComments(mappedComments);
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

  const handleSendComment = async (body: string, isInternal: boolean, attachments?: string[]) => {
    if (!id) return;
    setIsSending(true);
    try {
      const newComment = await ApiClient.post(`/tickets/${id}/comments`, {
        body,
        visibility: isInternal ? 'INTERNAL' : 'PUBLIC',
        attachments,
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
    if (!id) return;
    const transition = availableTransitions.find((t: any) => t.toStatus === newStatus);
    let comment: string | undefined = undefined;

    if (transition?.requiresComment) {
      const userInput = window.prompt(`A comment is required to transition to ${newStatus}:`);
      if (userInput === null) return; // User cancelled
      const trimmedComment = userInput.trim();
      if (!trimmedComment) {
        toast.error('A comment is required for this transition.');
        return;
      }
      comment = trimmedComment;
    }

    try {
      await ApiClient.post(`/tickets/${id}/transitions`, { toStatus: newStatus, comment });
      setTicket((prev: any) => ({ ...prev, status: newStatus }));
      loadTicketDetails(id);
      toast.success(`Ticket state transitioned to ${newStatus}!`);
    } catch (err: any) {
      toast.error(`Status transition failed: ${err.message}`);
    }
  };

  const handleTierEscalate = async (newTier: string) => {
    if (!id) return;
    const userInput = window.prompt(`Please enter a reason for escalating to tier ${newTier}:`);
    if (userInput === null) return; // User cancelled
    const trimmedReason = userInput.trim();
    if (!trimmedReason) {
      toast.error('Escalation reason is required.');
      return;
    }

    try {
      await ApiClient.post(`/tickets/${id}/escalate`, { toTier: newTier, reason: trimmedReason });
      setTicket((prev: any) => ({ ...prev, tier: newTier, status: 'ESCALATED' }));
      loadTicketDetails(id);
      toast.success(`Ticket escalated to support tier ${newTier}!`);
    } catch (err: any) {
      toast.error(`Tier escalation failed: ${err.message}`);
    }
  };

  const handleAssignToMe = async () => {
    if (!id || !user) return;
    try {
      await ApiClient.post(`/tickets/${id}/assign`, { assigneeId: user.id });
      setTicket((prev: any) => ({ ...prev, assignee: { id: user.id, fullName: user.fullName } }));
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
          padding: '16px 24px',
          backgroundColor: 'var(--bg-sidebar)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => navigate('/inbox')}
            className="btn btn-secondary btn-sm"
            title="Back to Inbox"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
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
              <PriorityPill priority={ticket.priority} />
            </div>
            <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
              {ticket.subject}
            </h2>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Status Dropdown */}
          <select
            value={ticket.status}
            onChange={(e) => handleStatusChange(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value={ticket.status} disabled>
              Status: {ticket.status}
            </option>
            {availableTransitions.map((t: any) => (
              <option key={t.toStatus} value={t.toStatus}>
                {t.label || t.toStatus}
              </option>
            ))}
          </select>

          {/* Tier Escalation */}
          <select
            value={ticket.tier}
            onChange={(e) => handleTierEscalate(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <option value={ticket.tier} disabled>
              Tier: {ticket.tier}
            </option>
            {['L1', 'L2', 'L3', 'DEV', 'QA'].map((tierOption) => {
              if (tierOption === ticket.tier) return null;
              const isAllowed = availableTransitions.some((t: any) => t.targetTier === tierOption);
              return (
                <option key={tierOption} value={tierOption} disabled={!isAllowed}>
                  Escalate to {tierOption} {!isAllowed ? '(N/A)' : ''}
                </option>
              );
            })}
          </select>

          <button onClick={handleAssignToMe} className="btn btn-secondary btn-sm">
            <UserCheck size={14} /> Assign to Me
          </button>
        </div>
      </div>

      {/* Main Split Body */}
      <div
        style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', overflow: 'hidden' }}
      >
        {/* Left Column: SLA, Tabs, Conversation */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRight: '1px solid var(--border-subtle)',
          }}
        >
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <h3
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '8px',
              }}
            >
              Description
            </h3>
            <div
              style={{
                margin: 0,
                whiteSpace: 'pre-wrap',
                lineHeight: 1.6,
                fontSize: '14px',
                color: 'var(--text-primary)',
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                padding: '12px',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
              }}
            >
              <FormattedEmailContent text={ticket.description} />
            </div>
          </div>

          {/* Live SLA Countdown Widget */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)' }}>
            <SlaCountdown clocks={ticket.slaClocks} ticketStatus={ticket.status} />
          </div>

          {/* Workspace Tabs */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              padding: '0 24px',
            }}
          >
            <button
              onClick={() => setActiveTab('timeline')}
              style={{
                padding: '12px 16px',
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
              <MessageSquare size={15} /> Conversation ({comments.length})
            </button>

            <button
              onClick={() => setActiveTab('diagnostics')}
              style={{
                padding: '12px 16px',
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
              <Monitor size={15} /> Telemetry & Diagnostics
            </button>

            <button
              onClick={() => setActiveTab('media')}
              style={{
                padding: '12px 16px',
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
              <Video size={15} /> Screen Recordings & Media ({mediaAssets.length})
            </button>
          </div>

          {/* Active Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {activeTab === 'timeline' && (
              <>
                <TimelineView comments={comments} />
                <ReplyComposer
                  onSend={handleSendComment}
                  isSending={isSending}
                  canWriteInternal={canWriteInternal}
                />
              </>
            )}

            {activeTab === 'diagnostics' && (
              <div style={{ padding: '24px' }}>
                <DiagnosticsView diagnostics={diagnostics} />
              </div>
            )}

            {activeTab === 'media' && (
              <div style={{ padding: '24px' }}>
                <MediaPlayer media={mediaAssets} />
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Customer & Ticket Sidebar Info */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-sidebar)',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <div className="card">
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              Customer Details
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
              <div>
                <strong>Name:</strong> {ticket.requester?.fullName || 'Customer'}
              </div>
              <div>
                <strong>Email:</strong> {ticket.requester?.email || 'N/A'}
              </div>
              <div>
                <strong>Channel:</strong> {ticket.channel}
              </div>
            </div>
          </div>

          <div className="card">
            <h4
              style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                marginBottom: '12px',
              }}
            >
              Assignment & Queue
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
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
    </div>
  );
};

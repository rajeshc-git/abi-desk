import React, { useState, useEffect, useCallback } from 'react';
import { GitMerge, ChevronDown, ChevronUp, MessageSquare, AlertCircle, Undo2, Lock } from 'lucide-react';
import { StatusBadge, PriorityPill, TierBadge } from '../common/Badge';
import { ApiClient } from '../../api/client';
import { TicketsApi } from '../../api/tickets';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { FormattedEmailContent } from '../common/FormattedEmailContent';

interface MergedTicketsViewProps {
  ticket: any;
  onUnmerge: (primaryTicketId: string, secondaryTicketId: string) => Promise<void>;
  onRefresh?: () => void;
}

export const MergedTicketsView: React.FC<MergedTicketsViewProps> = ({
  ticket,
  onUnmerge,
  onRefresh,
}) => {
  // Collapsed IDs set: empty by default so ALL merged tickets are EXPANDED by default
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [ticketDetails, setTicketDetails] = useState<Record<string, { ticket: any; comments: any[]; isLoading: boolean }>>({});
  const [unmergingId, setUnmergingId] = useState<string | null>(null);

  const mergedLinks = (ticket.linksTo || []).filter((l: any) => l.type === 'MERGED_INTO');
  const parentMergeLink = (ticket.linksFrom || []).find((l: any) => l.type === 'MERGED_INTO');

  const loadSecondaryDetails = useCallback(async (secondaryTicketId: string) => {
    setTicketDetails((prev) => {
      if (prev[secondaryTicketId]?.isLoading || prev[secondaryTicketId]?.ticket) return prev;
      return {
        ...prev,
        [secondaryTicketId]: { ticket: null, comments: [], isLoading: true },
      };
    });

    try {
      const [fullSecTicket, commentsRes] = await Promise.all([
        TicketsApi.getById(secondaryTicketId),
        ApiClient.get<any>(`/tickets/${secondaryTicketId}/comments?pageSize=100`),
      ]);

      const rawComments = Array.isArray(commentsRes) ? commentsRes : commentsRes?.comments || [];
      const cleanComments = rawComments.filter(
        (c: any) =>
          c.systemLabel !== 'Merge Automation' &&
          c.systemLabel !== 'Unmerge Action' &&
          !c.body?.startsWith('Merged ') &&
          !c.body?.startsWith('Merged into ') &&
          !c.body?.startsWith('Unmerged ') &&
          !c.body?.includes('into this ticket:') &&
          !c.body?.includes('has been unmerged from this ticket.')
      );

      setTicketDetails((prev) => ({
        ...prev,
        [secondaryTicketId]: {
          ticket: fullSecTicket,
          comments: cleanComments,
          isLoading: false,
        },
      }));
    } catch {
      setTicketDetails((prev) => ({
        ...prev,
        [secondaryTicketId]: { ticket: null, comments: [], isLoading: false },
      }));
    }
  }, []);

  // Auto-fetch conversation and details for all merged tickets so they display expanded immediately
  useEffect(() => {
    mergedLinks.forEach((link: any) => {
      const secId = link.source?.id || link.fromTicketId;
      if (secId && !ticketDetails[secId]) {
        loadSecondaryDetails(secId);
      }
    });
  }, [mergedLinks, ticketDetails, loadSecondaryDetails]);

  const handleToggleCollapse = (secondaryTicketId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(secondaryTicketId)) {
        next.delete(secondaryTicketId); // Expand
        if (!ticketDetails[secondaryTicketId]) {
          loadSecondaryDetails(secondaryTicketId);
        }
      } else {
        next.add(secondaryTicketId); // Collapse / Hide
      }
      return next;
    });
  };

  const handleUnmergeAction = async (secondaryId: string) => {
    setUnmergingId(secondaryId);
    try {
      await onUnmerge(ticket.id, secondaryId);
      if (onRefresh) onRefresh();
    } finally {
      setUnmergingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '20px', height: '100%', overflowY: 'auto' }}>

      {/* If this ticket is a Secondary ticket merged into a Master ticket */}
      {parentMergeLink && (
        <div
          style={{
            padding: '14px 18px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#d97706" />
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#92400e' }}>
                This Ticket Was Merged
              </div>
              <div style={{ fontSize: '12px', color: '#b45309' }}>
                Consolidated into Master Ticket <strong>#{parentMergeLink.target?.number}</strong> ({parentMergeLink.target?.subject})
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onUnmerge(parentMergeLink.target?.id, ticket.id)}
            disabled={unmergingId === ticket.id}
            className="btn btn-danger btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Undo2 size={13} />
            {unmergingId === ticket.id ? 'Unmerging...' : 'Unmerge This Ticket'}
          </button>
        </div>
      )}

      {/* Merged Tickets Table / Cards */}
      {mergedLinks.length === 0 ? (
        <div
          style={{
            padding: '48px 20px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <GitMerge size={32} style={{ opacity: 0.3 }} />
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
            No tickets merged into #{ticket.number}
          </div>
          <div style={{ fontSize: '12px', maxWidth: '400px' }}>
            When multiple related tickets are merged from the Ticket Inbox, they will appear here with their full conversation history and unmerge options.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {mergedLinks.map((link: any) => {
            const sec = link.source;
            const isExpanded = !collapsedIds.has(sec.id);
            const details = ticketDetails[sec.id];
            const requesterName = sec.requester?.fullName || sec.requester?.email || 'Customer';

            return (
              <div
                key={link.id}
                className="card"
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '10px',
                  border: isExpanded ? '1px solid var(--primary-border, #bfdbfe)' : '1px solid var(--border-subtle)',
                  overflow: 'hidden',
                  boxShadow: isExpanded ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Card Header Row */}
                <div
                  style={{
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    backgroundColor: isExpanded ? 'var(--primary-surface, #eff6ff)' : '#ffffff',
                    borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        padding: '2px 8px',
                        backgroundColor: '#ffffff',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle)',
                        flexShrink: 0,
                      }}
                    >
                      #{sec.number}
                    </span>

                    <StatusBadge status={sec.status} />
                    {sec.priority && <PriorityPill priority={sec.priority} />}
                    {sec.tier && <TierBadge tier={sec.tier} />}

                    <div style={{ minWidth: 0, flex: 1, overflow: 'hidden' }}>
                      <div
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={sec.subject}
                      >
                        {sec.subject}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', marginTop: '2px' }}>
                        <span>From: <strong>{requesterName}</strong></span>
                        {link.createdAt && (
                          <span>• Merged: {new Date(link.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => handleToggleCollapse(sec.id)}
                      className={`btn ${isExpanded ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                    >
                      <MessageSquare size={13} />
                      <span>{isExpanded ? 'Hide Content & Conversation' : 'View Content & Conversation'}</span>
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleUnmergeAction(sec.id)}
                      disabled={unmergingId === sec.id}
                      className="btn btn-danger btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}
                      title="Unmerge this ticket and restore back to Open"
                    >
                      <Undo2 size={13} />
                      {unmergingId === sec.id ? 'Unmerging...' : 'Unmerge'}
                    </button>
                  </div>
                </div>

                {/* Expanded Conversation & Details Content (Exact Timeline Layout & Style) */}
                {isExpanded && (
                  <div style={{ padding: '18px 20px', backgroundColor: '#fafbfc', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {details?.isLoading ? (
                      <LoadingSpinner size={20} text="Loading merged ticket conversation..." />
                    ) : (
                      <div className="ticket-timeline" style={{ padding: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Initial Request Timeline Item */}
                        <div className="timeline-item">
                          <div
                            className="user-avatar"
                            style={{
                              width: '32px',
                              height: '32px',
                              fontSize: '11px',
                              backgroundColor: 'var(--primary, #2563eb)',
                              color: '#ffffff',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 700,
                              flexShrink: 0,
                            }}
                          >
                            {requesterName.slice(0, 2).toUpperCase()}
                          </div>

                          <div className="timeline-card" style={{ flex: 1, borderLeft: '3px solid var(--primary, #2563eb)' }}>
                            <div className="timeline-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span className="author-name" style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)' }}>
                                  {requesterName}
                                </span>
                                <span style={{ fontSize: '10px', backgroundColor: 'var(--bg-app)', padding: '1px 6px', borderRadius: '4px', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontWeight: 600 }}>
                                  Initial Request (#{sec.number})
                                </span>
                              </div>
                              <span className="timestamp" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {sec.createdAt ? new Date(sec.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                              </span>
                            </div>

                            <div className="timeline-body" style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              <FormattedEmailContent
                                text={details?.ticket?.description || sec.description || 'No description provided.'}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Merged Comments / Replies Timeline Stream */}
                        {details?.comments && details.comments.length > 0 && (
                          details.comments.map((comment: any) => {
                            const isInternal = comment.visibility === 'INTERNAL' || comment.isInternal;
                            const isStaff = comment.author?.kind === 'STAFF';
                            const commentAuthorName = comment.author?.fullName || comment.author?.email || (isStaff ? 'Staff Agent' : 'Customer');

                            return (
                              <div key={comment.id} className="timeline-item">
                                <div
                                  className="user-avatar"
                                  style={{
                                    width: '32px',
                                    height: '32px',
                                    fontSize: '11px',
                                    backgroundColor: isInternal ? '#fde68a' : isStaff ? '#d1fae5' : '#e0f2fe',
                                    color: isInternal ? '#92400e' : isStaff ? '#065f46' : '#0369a1',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 700,
                                    flexShrink: 0,
                                  }}
                                >
                                  {commentAuthorName.slice(0, 2).toUpperCase()}
                                </div>

                                <div
                                  className={`timeline-card ${isInternal ? 'internal-note' : ''}`}
                                  style={{
                                    flex: 1,
                                    borderLeft: isInternal
                                      ? '3px solid #f59e0b'
                                      : isStaff
                                      ? '3px solid #10b981'
                                      : '3px solid var(--primary, #2563eb)',
                                  }}
                                >
                                  {isInternal && (
                                    <div className="internal-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: 'var(--internal-text, #92400e)', marginBottom: '6px' }}>
                                      <Lock size={12} /> PRIVATE INTERNAL NOTE
                                    </div>
                                  )}

                                  <div className="timeline-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <span className="author-name" style={{ fontWeight: 700, fontSize: '13px', color: isInternal ? 'var(--internal-text, #92400e)' : 'var(--text-primary)' }}>
                                        {commentAuthorName}
                                      </span>
                                    </div>
                                    <span className="timestamp" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      {new Date(comment.createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>

                                  <div className="timeline-body" style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                    <FormattedEmailContent text={comment.body} />
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

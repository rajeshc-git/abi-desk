import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  RefreshCw,
  Plus,
  UserCheck,
  ArrowUpRight,
  ExternalLink,
  CheckSquare,
  Square,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { TicketsApi } from '../api/tickets';
import { StatusBadge, PriorityPill, TierBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TicketCard, TicketSummary } from '../components/tickets/TicketCard';
import { CreateTicketModal } from '../components/tickets/CreateTicketModal';
import { MediaPlayer, MediaAssetItem } from '../components/media/MediaPlayer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSearch } from '../context/SearchContext';
import { FormattedEmailContent } from '../components/common/FormattedEmailContent';
import { useSocket } from '../context/SocketContext';

export const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeBrandId } = useAuth();
  const toast = useToast();

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaAssetItem[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [unreadTicketIds, setUnreadTicketIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem('unread_ticket_ids') || '[]'));
    } catch {
      return new Set();
    }
  });

  const { socket } = useSocket();

  useEffect(() => {
    try {
      localStorage.setItem('unread_ticket_ids', JSON.stringify(Array.from(unreadTicketIds)));
    } catch {}
  }, [unreadTicketIds]);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('ALL_OPEN');
  const [priorityFilter, setPriorityFilter] = useState<string>('');
  const [tierFilter, setTierFilter] = useState<string>('');
  const { debouncedSearchQuery } = useSearch();

  useEffect(() => {
    loadTickets();
  }, [activeBrandId, statusFilter, priorityFilter, tierFilter, debouncedSearchQuery]);

  useEffect(() => {
    let cancelled = false;

    const loadSelectedMedia = async () => {
      if (!selectedTicket) {
        setSelectedMedia([]);
        return;
      }

      setIsMediaLoading(true);
      try {
        const media = await ApiClient.get<MediaAssetItem[]>(`/tickets/${selectedTicket.id}/media`);
        if (!cancelled) setSelectedMedia(media);
      } catch {
        if (!cancelled) setSelectedMedia([]);
      } finally {
        if (!cancelled) setIsMediaLoading(false);
      }
    };

    loadSelectedMedia();
    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.id]);

  // Automatically load complete ticket details and description when a ticket is selected
  useEffect(() => {
    if (!selectedTicket?.id) return;
    let cancelled = false;

    TicketsApi.getById(selectedTicket.id)
      .then((fullTicket: any) => {
        if (!cancelled && fullTicket && fullTicket.id === selectedTicket.id) {
          setSelectedTicket((prev) => {
            if (!prev || prev.id !== fullTicket.id) return prev;
            return {
              ...prev,
              ...fullTicket,
              description: fullTicket.description || fullTicket.comments?.[0]?.body || prev.description,
              requester: fullTicket.requester || prev.requester,
            };
          });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.id]);

  // Real-time WebSocket ticket updates (push live events)
  useEffect(() => {
    if (!socket) return;

    const handleTicketCreated = (data: any) => {
      const incoming = data.ticket;
      if (!incoming) return;

      setTickets((prev) => {
        const exists = prev.some((t) => t.id === incoming.id);
        if (exists) return prev;
        return [incoming, ...prev];
      });

      setUnreadTicketIds((prev) => {
        const next = new Set(prev);
        next.add(incoming.id);
        return next;
      });
    };

    const handleTicketUpdated = (data: any) => {
      if (!data.ticketId) return;
      setTickets((prev) =>
        prev.map((t) => (t.id === data.ticketId ? { ...t, ...data.ticket } : t))
      );
      if (selectedTicket?.id === data.ticketId && data.ticket) {
        setSelectedTicket((prev) => (prev ? { ...prev, ...data.ticket } : null));
      }
    };

    const handleTicketCommented = (data: any) => {
      if (!data.ticketId) return;

      // Bump ticket to top of list
      setTickets((prev) => {
        const index = prev.findIndex((t) => t.id === data.ticketId);
        if (index === -1) return prev;
        const target = { ...prev[index], lastActivityAt: new Date().toISOString() };
        const others = prev.filter((t) => t.id !== data.ticketId);
        return [target, ...others];
      });

      // Mark unread if not currently viewing
      if (selectedTicket?.id !== data.ticketId) {
        setUnreadTicketIds((prev) => {
          const next = new Set(prev);
          next.add(data.ticketId);
          return next;
        });
      }
    };

    socket.on('ticket.created', handleTicketCreated);
    socket.on('ticket.updated', handleTicketUpdated);
    socket.on('ticket.commented', handleTicketCommented);

    return () => {
      socket.off('ticket.created', handleTicketCreated);
      socket.off('ticket.updated', handleTicketUpdated);
      socket.off('ticket.commented', handleTicketCommented);
    };
  }, [socket, selectedTicket?.id]);

  const loadTickets = async (reset = true) => {
    if (reset) {
      setIsLoading(true);
      setPage(1);
    }
    try {
      const params: Record<string, any> = {
        page: 1,
        pageSize: 50,
        brandId: activeBrandId || undefined,
        priority: priorityFilter || undefined,
        tier: tierFilter || undefined,
        q:
          debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2
            ? debouncedSearchQuery.trim()
            : undefined,
      };

      if (statusFilter === 'ALL_OPEN') {
        params.openOnly = 'true';
      } else if (statusFilter === 'MY_TICKETS') {
        params.assignee = 'me';
        params.openOnly = 'true';
        if (user?.id) params.assigneeId = user.id;
      } else if (statusFilter === 'ESCALATED') {
        params.tier = 'L2,L3,DEV,QA';
        params.openOnly = 'true';
      } else if (statusFilter === 'RESOLVED') {
        params.status = 'RESOLVED,CLOSED,CANCELLED';
      } else if (statusFilter) {
        params.status = statusFilter;
      }

      const res = await TicketsApi.list(params);
      const list = res.tickets || res.items || (Array.isArray(res) ? res : []);
      const total = typeof res.total === 'number' ? res.total : list.length;
      const pages = res.pages || Math.ceil(total / 50) || 1;

      setTickets(list);
      setTotalCount(total);
      setPage(1);
      setHasMore(1 < pages);

      if (list.length > 0 && (!selectedTicket || reset)) {
        setSelectedTicket(list[0]);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    const nextPage = page + 1;

    try {
      const params: Record<string, any> = {
        page: nextPage,
        pageSize: 50,
        brandId: activeBrandId || undefined,
        priority: priorityFilter || undefined,
        tier: tierFilter || undefined,
        q:
          debouncedSearchQuery && debouncedSearchQuery.trim().length >= 2
            ? debouncedSearchQuery.trim()
            : undefined,
      };

      if (statusFilter === 'ALL_OPEN') {
        params.openOnly = 'true';
      } else if (statusFilter === 'MY_TICKETS') {
        params.assignee = 'me';
        params.openOnly = 'true';
        if (user?.id) params.assigneeId = user.id;
      } else if (statusFilter === 'ESCALATED') {
        params.tier = 'L2,L3,DEV,QA';
        params.openOnly = 'true';
      } else if (statusFilter === 'RESOLVED') {
        params.status = 'RESOLVED,CLOSED,CANCELLED';
      } else if (statusFilter) {
        params.status = statusFilter;
      }

      const res = await TicketsApi.list(params);
      const list = res.tickets || res.items || (Array.isArray(res) ? res : []);
      const total = typeof res.total === 'number' ? res.total : totalCount;
      const pages = res.pages || Math.ceil(total / 50) || 1;

      setTickets((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const newItems = list.filter((t: TicketSummary) => !existingIds.has(t.id));
        return [...prev, ...newItems];
      });

      setPage(nextPage);
      setTotalCount(total);
      setHasMore(nextPage < pages);
    } catch (err: any) {
      toast.error(`Failed to load more tickets: ${err.message}`);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleTicketCreated = (newTicket: TicketSummary) => {
    setTickets((prev) => [newTicket, ...prev]);
    handleSelectTicket(newTicket);
  };

  const handleSelectTicket = (t: TicketSummary) => {
    setSelectedTicket(t);
    setUnreadTicketIds((prev) => {
      if (!prev.has(t.id)) return prev;
      const next = new Set(prev);
      next.delete(t.id);
      return next;
    });
  };

  const toggleSelectTicket = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkAssign = async () => {
    if (!user || selectedIds.size === 0) return;
    try {
      await TicketsApi.bulkUpdate(Array.from(selectedIds), { assigneeId: user.id });
      toast.success(`Assigned ${selectedIds.size} tickets to you!`);
      setSelectedIds(new Set());
      loadTickets();
    } catch (err: any) {
      toast.error(`Bulk update failed: ${err.message}`);
    }
  };

  const handleBulkClose = async () => {
    if (selectedIds.size === 0) return;
    try {
      await TicketsApi.bulkUpdate(Array.from(selectedIds), { toStatus: 'CLOSED', status: 'CLOSED' });
      toast.success(`Closed ${selectedIds.size} tickets!`);
      setSelectedIds(new Set());
      loadTickets();
    } catch (err: any) {
      toast.error(`Bulk close failed: ${err.message}`);
    }
  };

  return (
    <div className="split-pane-layout">
      {/* Left Pane: Ticket Stream & Filters */}
      <div className="split-left-pane" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Filters Bar */}
        <div
          style={{
            padding: '16px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Ticket Inbox
              </h2>
              {totalCount > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {tickets.length} of {totalCount}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setIsCreateOpen(true)} className="btn btn-primary btn-sm">
                <Plus size={14} /> New Ticket
              </button>
              <button
                onClick={() => loadTickets(true)}
                className="btn btn-secondary btn-sm"
                title="Refresh Tickets"
                disabled={isLoading}
              >
                <RefreshCw size={13} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'ALL_OPEN', label: 'All Open' },
              { id: 'MY_TICKETS', label: 'My Tickets' },
              { id: 'ESCALATED', label: 'Escalated' },
              { id: 'RESOLVED', label: 'Resolved' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setStatusFilter(tab.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-full)',
                  border: 'none',
                  backgroundColor: statusFilter === tab.id ? 'var(--primary)' : 'var(--bg-surface)',
                  color: statusFilter === tab.id ? '#ffffff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--primary-surface)',
              borderBottom: '1px solid var(--primary-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span>{selectedIds.size} selected</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleBulkAssign}
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px' }}
              >
                <UserCheck size={12} /> Assign to Me
              </button>
              <button
                onClick={handleBulkClose}
                className="btn btn-danger btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px' }}
              >
                <Trash2 size={12} /> Close Selected
              </button>
            </div>
          </div>
        )}

        {/* Ticket List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {isLoading ? (
            <LoadingSpinner size={24} text="Fetching tickets..." />
          ) : tickets.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
              No tickets found in this queue.
            </div>
          ) : (
            <>
              {tickets.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    minWidth: 0,
                    width: '100%',
                  }}
                >
                  <button
                    onClick={(e) => toggleSelectTicket(t.id, e)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      padding: '0 8px 0 12px',
                      color: selectedIds.has(t.id) ? 'var(--primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    {selectedIds.has(t.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                  <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                    <TicketCard
                      ticket={t}
                      isSelected={selectedTicket?.id === t.id}
                      isUnread={unreadTicketIds.has(t.id)}
                      onClick={() => handleSelectTicket(t)}
                    />
                  </div>
                </div>
              ))}

              {/* Gmail-Style Load More Footer */}
              {hasMore && (
                <div
                  style={{
                    padding: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderTop: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  <button
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      padding: '8px 20px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      borderRadius: '9999px',
                      boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
                      cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isLoadingMore) {
                        e.currentTarget.style.backgroundColor = 'var(--primary-surface, #eff6ff)';
                        e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
                        e.currentTarget.style.color = 'var(--primary, #2563eb)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isLoadingMore) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-surface-elevated, #f8fafc)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                        e.currentTarget.style.color = 'var(--text-primary)';
                      }
                    }}
                  >
                    {isLoadingMore ? (
                      <>
                        <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
                        <span>Loading more conversations...</span>
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} style={{ opacity: 0.8 }} />
                        <span>Load more conversations</span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '1px 6px',
                            borderRadius: '10px',
                            backgroundColor: 'rgba(0, 0, 0, 0.06)',
                          }}
                        >
                          {tickets.length} of {totalCount}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {!hasMore && tickets.length > 0 && (
                <div
                  style={{
                    padding: '14px 16px',
                    textAlign: 'center',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    borderTop: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-surface)',
                  }}
                >
                  Showing all {tickets.length} conversations
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right Pane: Quick Detail Workspace */}
      <div className="split-right-pane">
        {selectedTicket ? (
          <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '14px',
                      fontWeight: 700,
                      color: 'var(--primary)',
                    }}
                  >
                    #{selectedTicket.number}
                  </span>
                  <TierBadge tier={selectedTicket.tier} />
                  <StatusBadge status={selectedTicket.status} />
                  <PriorityPill priority={selectedTicket.priority} />
                </div>
                <h1 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {selectedTicket.subject}
                </h1>
              </div>

              <button
                onClick={() => navigate(`/tickets/${selectedTicket.id}`)}
                className="btn btn-primary"
              >
                <ExternalLink size={14} /> Open Full Workspace
              </button>
            </div>

            {/* Description Preview */}
            <div className="card">
              <h4
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                }}
              >
                Initial Description
              </h4>
              <div
                style={{
                  fontSize: '14px',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.6,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '6px',
                  padding: '12px',
                  backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                }}
              >
                <FormattedEmailContent text={selectedTicket.description} />
              </div>
            </div>

            {/* Mail-style attachment area: preview captures without leaving the inbox. */}
            <div className="card">
              <h4
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  marginBottom: '10px',
                }}
              >
                Attachments & Captures ({selectedMedia.length})
              </h4>
              {isMediaLoading ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '8px 0' }}>
                  Loading attachments…
                </div>
              ) : (
                <MediaPlayer media={selectedMedia} />
              )}
            </div>

            {/* Metadata Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
              <div className="card" style={{ padding: '16px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Requester
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                  {selectedTicket.requester?.fullName || 'Customer'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {selectedTicket.requester?.email}
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Assignee
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                  {selectedTicket.assignee?.fullName || 'Unassigned (Queue)'}
                </div>
              </div>

              <div className="card" style={{ padding: '16px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  Channel
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, marginTop: '4px' }}>
                  {selectedTicket.channel}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
            }}
          >
            Select a ticket from the inbox to view details.
          </div>
        )}
      </div>

      {/* Create Ticket Modal */}
      <CreateTicketModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onCreated={handleTicketCreated}
      />
    </div>
  );
};

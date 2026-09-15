import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Filter,
  RefreshCw,
  Plus,
  UserCheck,
  ArrowUpRight,
  ArrowLeft,
  ExternalLink,
  CheckSquare,
  Square,
  Trash2,
  ChevronDown,
  ChevronUp,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Video as VideoIcon,
  Music,
  Eye,
  Download,
  User,
  X,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { TicketsApi } from '../api/tickets';
import { StatusBadge, PriorityPill, TierBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { TicketCard, TicketSummary } from '../components/tickets/TicketCard';
import { CreateTicketModal } from '../components/tickets/CreateTicketModal';
import { StatusPopover } from '../components/tickets/StatusPopover';
import { StatusTransitionModal } from '../components/tickets/StatusTransitionModal';
import { TicketTagManager } from '../components/tickets/TicketTagManager';
import { TicketCategoryManager } from '../components/tickets/TicketCategoryManager';
import { MediaPlayer, MediaAssetItem, getMediaType } from '../components/media/MediaPlayer';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useSearch } from '../context/SearchContext';
import { FormattedEmailContent } from '../components/common/FormattedEmailContent';
import { useSocket } from '../context/SocketContext';

// Gmail-style visual attachment preview card
const InboxAttachmentCard: React.FC<{
  media: any;
  onPreview: (media: any, url: string) => void;
}> = ({ media, onPreview }) => {
  const [inlineUrl, setInlineUrl] = useState<string | null>(media.downloadUrl || null);
  const [loading, setLoading] = useState(false);

  const typeInfo = getMediaType(media);
  const sizeStr = media.sizeBytes ? `${Math.round(media.sizeBytes / 1024)} KB` : '';
  const displayName = media.originalFilename || media.filename || 'Attachment';

  const loadInlineUrl = async (): Promise<string | null> => {
    if (inlineUrl) return inlineUrl;
    setLoading(true);
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${media.id}/download`, {
        disposition: 'inline',
      });
      setInlineUrl(res.url);
      return res.url;
    } catch {
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeInfo.isImage && !inlineUrl) {
      loadInlineUrl();
    }
  }, [media.id, typeInfo.isImage]);

  const handleOpenPreview = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = await loadInlineUrl();
    if (url) {
      onPreview(media, url);
    }
  };

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${media.id}/download`, {
        disposition: 'attachment',
      });
      const a = document.createElement('a');
      a.href = res.url;
      a.download = displayName;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  return (
    <div
      onClick={handleOpenPreview}
      style={{
        width: '180px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-medium, #e2e8f0)',
        borderRadius: '8px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
        e.currentTarget.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-medium, #e2e8f0)';
        e.currentTarget.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.05)';
      }}
      title={`Click to preview ${displayName}`}
    >
      {/* Top Preview Area (Gmail Style) */}
      <div
        style={{
          height: '95px',
          backgroundColor: 'var(--bg-app, #f8fafc)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        {typeInfo.isImage ? (
          inlineUrl ? (
            <img
              src={inlineUrl}
              alt={displayName}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: '11px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <ImageIcon size={22} color="#0284c7" />
              <span>{loading ? 'Loading...' : 'Photo'}</span>
            </div>
          )
        ) : typeInfo.isPdf ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={18} color="#dc2626" />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>PDF Document</span>
          </div>
        ) : typeInfo.isVideo ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: '#f3e8ff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <VideoIcon size={18} color="#9333ea" />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Video</span>
          </div>
        ) : typeInfo.isAudio ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: '#fef3c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Music size={18} color="#d97706" />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Audio</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '6px',
                backgroundColor: '#e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Paperclip size={18} color="#475569" />
            </div>
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-secondary)' }}>Attachment</span>
          </div>
        )}
      </div>

      {/* Bottom Footer Info + Action Buttons */}
      <div
        style={{
          padding: '6px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'var(--bg-surface)',
          gap: '4px',
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={displayName}
          >
            {displayName}
          </div>
          {sizeStr && (
            <div style={{ fontSize: '9.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
              {sizeStr}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleOpenPreview}
            style={{
              padding: '3px 5px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Preview"
          >
            <Eye size={11} />
          </button>
          <button
            type="button"
            onClick={handleDownload}
            style={{
              padding: '3px 5px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '4px',
              backgroundColor: 'var(--bg-hover)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Download"
          >
            <Download size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

export const InboxPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, activeBrandId } = useAuth();
  const toast = useToast();

  const handleDownloadMedia = async (mediaId: string, filename: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    try {
      const res = await ApiClient.post<{ url: string }>(`/media/${mediaId}/download`, {
        disposition: 'attachment',
      });
      const a = document.createElement('a');
      a.href = res.url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download failed:', err);
      toast.error('Failed to download file');
    }
  };

  const [tickets, setTickets] = useState<TicketSummary[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<TicketSummary | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<MediaAssetItem[]>([]);
  const [selectedComments, setSelectedComments] = useState<any[]>([]);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState<number>(1);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedCommentIds, setExpandedCommentIds] = useState<Set<string>>(new Set());
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState<boolean>(true);
  const [previewLightbox, setPreviewLightbox] = useState<{ media: any; url: string } | null>(null);
  const [pendingStatusTransition, setPendingStatusTransition] = useState<{
    toStatus: string;
    requiresComment?: boolean;
  } | null>(null);
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
  const {
    debouncedSearchQuery,
    selectedTag,
    setSelectedTag,
    selectedCategory,
    setSelectedCategory,
    selectedOrganization,
    setSelectedOrganization,
    selectedProduct,
    setSelectedProduct,
  } = useSearch();

  useEffect(() => {
    loadTickets();
  }, [
    activeBrandId,
    statusFilter,
    priorityFilter,
    tierFilter,
    debouncedSearchQuery,
    selectedTag,
    selectedCategory,
    selectedOrganization,
    selectedProduct,
  ]);

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

  // Automatically load complete ticket details, description, and comments when a ticket is selected
  useEffect(() => {
    if (!selectedTicket?.id) {
      setSelectedComments([]);
      return;
    }
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

    setIsCommentsLoading(true);
    ApiClient.get<any>(`/tickets/${selectedTicket.id}/comments?pageSize=100`)
      .then((res: any) => {
        if (!cancelled) {
          const list = res?.comments || res?.items || (Array.isArray(res) ? res : []);
          setSelectedComments(list);
        }
      })
      .catch(() => {
        if (!cancelled) setSelectedComments([]);
      })
      .finally(() => {
        if (!cancelled) setIsCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTicket?.id]);

  // Synchronize initial expanded states: when replies exist, collapse description and expand latest reply
  useEffect(() => {
    if (selectedComments.length > 0) {
      setIsDescriptionExpanded(false);
      const latestId = selectedComments[selectedComments.length - 1]?.id;
      setExpandedCommentIds(new Set(latestId ? [latestId] : []));
    } else {
      setIsDescriptionExpanded(true);
      setExpandedCommentIds(new Set());
    }
  }, [selectedComments]);

  const toggleComment = (id: string) => {
    setExpandedCommentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const isAllExpanded =
    isDescriptionExpanded &&
    (selectedComments.length === 0 || selectedComments.every((c: any) => expandedCommentIds.has(c.id)));

  const toggleExpandAll = () => {
    if (isAllExpanded) {
      setIsDescriptionExpanded(false);
      const latestId = selectedComments[selectedComments.length - 1]?.id;
      setExpandedCommentIds(new Set(latestId ? [latestId] : []));
    } else {
      setIsDescriptionExpanded(true);
      setExpandedCommentIds(new Set(selectedComments.map((c: any) => c.id)));
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const getCleanSnippet = (text?: string) => {
    if (!text) return '';
    // 1. Strip HTML tags
    let cleaned = text.replace(/<[^>]+>/g, ' ');
    // 2. Decode HTML entities
    cleaned = cleaned
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    // 3. Cut off email reply headers (e.g. "On Tue, 15 Sept ... wrote:", "From: ...", "-----Original Message-----")
    const replyHeaderMatch = cleaned.match(/\b(On\s+[A-Za-z]+,\s+[0-9]+.+?wrote:|-{2,}\s*Original Message\s*-{2,}|From:\s*|Sent:\s*|To:\s*)/i);
    if (replyHeaderMatch && replyHeaderMatch.index !== undefined && replyHeaderMatch.index > 0) {
      cleaned = cleaned.substring(0, replyHeaderMatch.index);
    }
    // 4. Collapse whitespace
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
  };

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

      // Bump ticket to top of list and update comment count
      setTickets((prev) => {
        const index = prev.findIndex((t) => t.id === data.ticketId);
        if (index === -1) return prev;
        const target = {
          ...prev[index],
          lastActivityAt: new Date().toISOString(),
          publicCommentCount: (prev[index].publicCommentCount || 0) + 1,
        };
        const others = prev.filter((t) => t.id !== data.ticketId);
        return [target, ...others];
      });

      // If viewing the ticket, refresh comments live
      if (selectedTicket?.id === data.ticketId) {
        ApiClient.get<any>(`/tickets/${data.ticketId}/comments?pageSize=100`)
          .then((res: any) => {
            const list = res?.comments || res?.items || (Array.isArray(res) ? res : []);
            setSelectedComments(list);
          })
          .catch(() => {});
      } else {
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
        tag: selectedTag?.slug || undefined,
        category: selectedCategory?.name || undefined,
        organization: selectedOrganization || undefined,
        product: selectedProduct || undefined,
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
        tag: selectedTag?.slug || undefined,
        category: selectedCategory?.name || undefined,
        organization: selectedOrganization || undefined,
        product: selectedProduct || undefined,
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

  const handleQuickStatusChange = async (newStatus: string) => {
    if (!selectedTicket || newStatus === selectedTicket.status) return;
    const requiresComment = ['PENDING_CUSTOMER', 'ON_HOLD', 'CANCELLED'].includes(newStatus);
    if (requiresComment) {
      setPendingStatusTransition({ toStatus: newStatus, requiresComment });
      return;
    }
    await executeStatusTransition(newStatus);
  };

  const executeStatusTransition = async (newStatus: string, comment?: string) => {
    if (!selectedTicket) return;
    try {
      const res: any = await ApiClient.post(`/tickets/${selectedTicket.id}/transitions`, { toStatus: newStatus, comment });
      if (res?.kind === 'pending_approval') {
        toast.info(`Transition to ${newStatus} requires sign-off. Approval request submitted.`);
      } else {
        setSelectedTicket((prev: any) => ({ ...prev, status: newStatus }));
        setTickets((prev) =>
          prev.map((t) => (t.id === selectedTicket.id ? { ...t, status: newStatus } : t))
        );
        toast.success(`Ticket #${selectedTicket.number} status updated to ${newStatus}`);
      }
      loadTickets();
    } catch (err: any) {
      toast.error(`Failed to update status: ${err.message}`);
      throw err;
    }
  };
  const canChangePriority =
    !!user &&
    Boolean(
      user.roles?.some((r: string) => ['L2_SUPPORT', 'L3_SUPPORT', 'PLATFORM_ADMIN'].includes(r)),
    );

  const handlePriorityChange = async (newPriority: string) => {
    if (!selectedTicket) return;
    try {
      await ApiClient.patch(`/tickets/${selectedTicket.id}`, { priority: newPriority });
      setSelectedTicket((prev: any) => ({ ...prev, priority: newPriority }));
      setTickets((prev) =>
        prev.map((t) => (t.id === selectedTicket.id ? { ...t, priority: newPriority } : t)),
      );
      toast.success(`Ticket priority updated to ${newPriority}!`);
    } catch (err: any) {
      toast.error(`Failed to update priority: ${err.message}`);
    }
  };

  return (
    <div className={`split-pane-layout ${selectedTicket ? 'has-selected' : ''}`}>
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
      <div className="split-right-pane" style={{ height: '100%', overflow: 'hidden' }}>
        {selectedTicket ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 20px',
              gap: '12px',
              boxSizing: 'border-box',
              height: '100%',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            {/* Top Toolbar (Single Sleek Row) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                gap: '8px',
                flexWrap: 'wrap',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedTicket(null)}
                  className="ticket-header-back-btn mobile-only-back-btn"
                  title="Back to Ticket List"
                >
                  <ArrowLeft size={16} />
                </button>
                <span className="ticket-id-badge">
                  #{selectedTicket.number}
                </span>
                <TierBadge tier={selectedTicket.tier} />
                <StatusPopover
                  status={selectedTicket.status}
                  onStatusChange={handleQuickStatusChange}
                />
                {canChangePriority ? (
                  <select
                    value={selectedTicket.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    className="pill-select"
                    style={{
                      color:
                        selectedTicket.priority === 'CRITICAL' || selectedTicket.priority === 'URGENT'
                          ? 'var(--color-critical, #ef4444)'
                          : selectedTicket.priority === 'HIGH'
                          ? '#f59e0b'
                          : 'var(--text-primary)',
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
                  <PriorityPill priority={selectedTicket.priority} />
                )}
                <TicketCategoryManager
                  ticketId={selectedTicket.id}
                  category={selectedTicket.category}
                  onCategoryChange={(newCategory) => {
                    setSelectedTicket((prev: any) => ({ ...prev, category: newCategory }));
                    setTickets((prev) =>
                      prev.map((t) => (t.id === selectedTicket.id ? { ...t, category: newCategory } : t)),
                    );
                  }}
                />
                <TicketTagManager
                  ticketId={selectedTicket.id}
                  tags={selectedTicket.tags}
                  onTagsChange={(newTags) => {
                    setSelectedTicket((prev: any) => ({ ...prev, tags: newTags }));
                    setTickets((prev) =>
                      prev.map((t) => (t.id === selectedTicket.id ? { ...t, tags: newTags } : t)),
                    );
                  }}
                />
                {((selectedTicket as any).customFields?.organization || (selectedTicket as any).organization) && (
                  <span
                    className="pill-badge"
                    style={{
                      backgroundColor: 'rgba(56, 189, 248, 0.12)',
                      color: '#0284c7',
                      border: '1px solid rgba(56, 189, 248, 0.25)',
                    }}
                    title="Organization"
                  >
                    🏢 {(selectedTicket as any).customFields?.organization || (selectedTicket as any).organization}
                  </span>
                )}
                {((selectedTicket as any).customFields?.product || (selectedTicket as any).product) && (
                  <span
                    className="pill-badge"
                    style={{
                      backgroundColor: 'rgba(168, 85, 247, 0.12)',
                      color: '#9333ea',
                      border: '1px solid rgba(168, 85, 247, 0.25)',
                    }}
                    title="Product"
                  >
                    📦 {(selectedTicket as any).customFields?.product || (selectedTicket as any).product}
                  </span>
                )}
              </div>

              <button
                onClick={() => navigate(`/tickets/${selectedTicket.id}`)}
                className="btn btn-primary"
                style={{ height: '32px', flexShrink: 0, gap: '6px' }}
              >
                <ExternalLink size={14} /> Open Full Workspace
              </button>
            </div>

            {/* Ticket Subject Title Banner */}
            <div
              style={{
                padding: '12px 16px 10px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
                flexShrink: 0,
              }}
            >
              <h1
                style={{
                  fontSize: '16px',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  margin: 0,
                  lineHeight: 1.35,
                  wordBreak: 'break-word',
                }}
              >
                {selectedTicket.subject}
              </h1>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  flexWrap: 'wrap',
                }}
              >
                <span>
                  From <strong style={{ color: 'var(--text-primary)' }}>{selectedTicket.requester?.fullName || selectedTicket.requester?.email || 'Customer'}</strong>
                  {selectedTicket.requester?.email ? ` (${selectedTicket.requester.email})` : ''}
                </span>
                {selectedTicket.createdAt && (
                  <>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span>{new Date(selectedTicket.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  </>
                )}
                {selectedTicket.channel && (
                  <>
                    <span style={{ opacity: 0.5 }}>•</span>
                    <span style={{ textTransform: 'capitalize' }}>via {selectedTicket.channel.toLowerCase()}</span>
                  </>
                )}
              </div>
            </div>

            {/* Middle Content Area: Conversation Thread with Thread Accordion */}
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div
                className="card"
                style={{
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  padding: '14px 16px',
                  margin: 0,
                  borderRadius: 0,
                  border: 'none',
                  backgroundColor: 'transparent',
                }}
              >
                {/* Thread Header Bar & Expand/Collapse Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '12px',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h4
                      style={{
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: 'var(--text-muted)',
                        margin: 0,
                        letterSpacing: '0.04em',
                      }}
                    >
                      Conversation Thread
                    </h4>
                    {selectedComments.length > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--primary, #2563eb)',
                          padding: '1px 8px',
                          borderRadius: '12px',
                        }}
                      >
                        {selectedComments.length} {selectedComments.length === 1 ? 'reply' : 'replies'}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={toggleExpandAll}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary, #2563eb)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '3px 8px',
                      borderRadius: '4px',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    {isAllExpanded ? (
                      <>
                        <ChevronUp size={14} /> Collapse Previous
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} /> Expand All
                      </>
                    )}
                  </button>
                </div>

                {/* Scrollable Accordion Stream */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    paddingRight: '6px',
                  }}
                >
                  {/* Initial Description Accordion Item */}
                  {(() => {
                    const rootMedia = selectedMedia.filter((m: any) => !m.commentId);
                    const authorName = selectedTicket.requester?.fullName || selectedTicket.requester?.email || 'Customer';
                    const rawText = selectedTicket.description || '';
                    const plainSnippet = getCleanSnippet(rawText);

                    return (
                      <div
                        style={{
                          border: '1px solid var(--border-subtle)',
                          borderRadius: '8px',
                          backgroundColor: 'var(--bg-surface)',
                          transition: 'all 0.15s ease',
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {/* Accordion Item Header / Collapsed Strip */}
                        <div
                          onClick={() => setIsDescriptionExpanded((prev) => !prev)}
                          style={{
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            cursor: 'pointer',
                            backgroundColor: isDescriptionExpanded
                              ? 'var(--bg-surface-elevated, #f8fafc)'
                              : 'var(--bg-surface)',
                            borderBottom: isDescriptionExpanded ? '1px solid var(--border-subtle)' : 'none',
                          }}
                          onMouseEnter={(e) => {
                            if (!isDescriptionExpanded) e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isDescriptionExpanded) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                backgroundColor: '#e2e8f0',
                                color: '#334155',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '11px',
                                fontWeight: 700,
                                flexShrink: 0,
                              }}
                            >
                              {getInitials(authorName)}
                            </div>

                            <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)', flexShrink: 0 }}>
                              {authorName}
                            </span>

                            <span
                              style={{
                                fontSize: '10px',
                                color: 'var(--text-muted)',
                                backgroundColor: 'var(--bg-app, #f1f5f9)',
                                border: '1px solid var(--border-subtle)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                                flexShrink: 0,
                              }}
                            >
                              Initial Request
                            </span>

                            {!isDescriptionExpanded && (
                              <span
                                style={{
                                  fontSize: '12px',
                                  color: 'var(--text-secondary)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginLeft: '4px',
                                }}
                              >
                                {plainSnippet || 'View message content...'}
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                            {rootMedia.length > 0 && (
                              <span
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 600,
                                  color: 'var(--text-muted)',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '3px',
                                  backgroundColor: 'var(--bg-hover)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                }}
                              >
                                <Paperclip size={11} /> {rootMedia.length}
                              </span>
                            )}
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {selectedTicket.createdAt
                                ? new Date(selectedTicket.createdAt).toLocaleDateString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            {isDescriptionExpanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                          </div>
                        </div>

                        {/* Expanded Message Content */}
                        {isDescriptionExpanded && (
                          <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                              <FormattedEmailContent text={selectedTicket.description} />
                            </div>

                            {/* In-Message Contextual Attachments (Gmail-Style Visual Cards) */}
                            {rootMedia.length > 0 && (
                              <div
                                style={{
                                  display: 'flex',
                                  flexWrap: 'wrap',
                                  gap: '10px',
                                  marginTop: '8px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid var(--border-subtle)',
                                }}
                              >
                                {rootMedia.map((m: any) => (
                                  <InboxAttachmentCard
                                    key={m.id}
                                    media={m}
                                    onPreview={(media, url) => setPreviewLightbox({ media, url })}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* Subsequent Replies Accordion Items */}
                  {isCommentsLoading ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center', padding: '16px 0' }}>
                      Loading replies…
                    </div>
                  ) : (
                    selectedComments.map((comment: any) => {
                      const isExpanded = expandedCommentIds.has(comment.id);
                      const commentMedia = selectedMedia.filter((m: any) => m.commentId === comment.id);
                      const isInternal = comment.visibility === 'INTERNAL';
                      const isStaff = comment.author?.kind === 'STAFF';
                      const authorName = comment.author?.fullName || comment.author?.email || (isStaff ? 'Staff Agent' : 'Customer');
                      const rawText = comment.body || '';
                      const plainSnippet = getCleanSnippet(rawText);

                      return (
                        <div
                          key={comment.id}
                          style={{
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '8px',
                            backgroundColor: isInternal ? '#fffbeb' : 'var(--bg-surface)',
                            borderLeft: isInternal
                              ? '3px solid #f59e0b'
                              : isStaff
                              ? '3px solid #10b981'
                              : '3px solid var(--primary, #2563eb)',
                            transition: 'all 0.15s ease',
                            overflow: 'hidden',
                            flexShrink: 0,
                          }}
                        >
                          {/* Accordion Item Header / Collapsed Strip */}
                          <div
                            onClick={() => toggleComment(comment.id)}
                            style={{
                              padding: '10px 14px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                              backgroundColor: isExpanded
                                ? isInternal
                                  ? '#fef3c7'
                                  : 'var(--bg-surface-elevated, #f8fafc)'
                                : 'transparent',
                              borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
                            }}
                            onMouseEnter={(e) => {
                              if (!isExpanded) e.currentTarget.style.backgroundColor = isInternal ? '#fef3c7' : 'var(--bg-hover, #f1f5f9)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isExpanded) e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                              <div
                                style={{
                                  width: '26px',
                                  height: '26px',
                                  borderRadius: '50%',
                                  backgroundColor: isInternal ? '#fde68a' : isStaff ? '#d1fae5' : '#e0f2fe',
                                  color: isInternal ? '#92400e' : isStaff ? '#065f46' : '#0369a1',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: '11px',
                                  fontWeight: 700,
                                  flexShrink: 0,
                                }}
                              >
                                {getInitials(authorName)}
                              </div>

                              <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--text-primary)', flexShrink: 0 }}>
                                {authorName}
                              </span>

                              {isInternal ? (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#b45309',
                                    backgroundColor: '#fef3c7',
                                    border: '1px solid #fde68a',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  Internal Note
                                </span>
                              ) : isStaff ? (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#15803d',
                                    backgroundColor: '#dcfce7',
                                    border: '1px solid #bbf7d0',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  Staff Reply
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#0369a1',
                                    backgroundColor: '#e0f2fe',
                                    border: '1px solid #bae6fd',
                                    padding: '1px 6px',
                                    borderRadius: '4px',
                                    fontWeight: 600,
                                    flexShrink: 0,
                                  }}
                                >
                                  Customer Reply
                                </span>
                              )}

                              {!isExpanded && (
                                <span
                                  style={{
                                    fontSize: '12px',
                                    color: 'var(--text-secondary)',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    marginLeft: '4px',
                                  }}
                                >
                                  {plainSnippet || 'View message content...'}
                                </span>
                              )}
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: '12px' }}>
                              {commentMedia.length > 0 && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    color: 'var(--text-muted)',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    backgroundColor: 'var(--bg-hover)',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                  }}
                                >
                                  <Paperclip size={11} /> {commentMedia.length}
                                </span>
                              )}
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                {comment.createdAt
                                  ? new Date(comment.createdAt).toLocaleDateString(undefined, {
                                      month: 'short',
                                      day: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </span>
                              {isExpanded ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
                            </div>
                          </div>

                          {/* Expanded Message Content */}
                          {isExpanded && (
                            <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <div style={{ fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
                                <FormattedEmailContent text={comment.body} />
                              </div>

                              {/* In-Message Contextual Attachments (Gmail-Style Visual Cards) */}
                              {commentMedia.length > 0 && (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexWrap: 'wrap',
                                    gap: '10px',
                                    marginTop: '8px',
                                    paddingTop: '10px',
                                    borderTop: '1px solid var(--border-subtle)',
                                  }}
                                >
                                  {commentMedia.map((m: any) => (
                                    <InboxAttachmentCard
                                      key={m.id}
                                      media={m}
                                      onPreview={(media, url) => setPreviewLightbox({ media, url })}
                                    />
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Bottom Compact Metadata Status Bar */}
            <div
              className="card"
              style={{
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 16px',
                margin: 0,
                fontSize: '12px',
                backgroundColor: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                flexWrap: 'wrap',
                gap: '8px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Requester:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedTicket.requester?.fullName || 'Customer'}</strong>
                {selectedTicket.requester?.email && (
                  <span style={{ color: 'var(--text-secondary)' }}>({selectedTicket.requester.email})</span>
                )}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Assignee:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedTicket.assignee?.fullName || 'Unassigned (Queue)'}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Channel:</span>
                <span style={{ textTransform: 'uppercase', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedTicket.channel}</span>
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

      {/* Status Transition Note Modal */}
      {selectedTicket && (
        <StatusTransitionModal
          isOpen={!!pendingStatusTransition}
          ticketNumber={String(selectedTicket.number)}
          fromStatus={selectedTicket.status}
          toStatus={pendingStatusTransition?.toStatus || ''}
          requiresComment={pendingStatusTransition?.requiresComment}
          onClose={() => setPendingStatusTransition(null)}
          onConfirm={(comment) => executeStatusTransition(pendingStatusTransition!.toStatus, comment)}
        />
      )}

      {/* Lightbox / Fullscreen Attachment Preview Modal */}
      {previewLightbox && (() => {
        const typeInfo = getMediaType(previewLightbox.media);
        const displayName = previewLightbox.media.originalFilename || previewLightbox.media.filename || 'Attachment';

        return (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              zIndex: 3000,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '24px',
              backdropFilter: 'blur(4px)',
            }}
            onClick={() => setPreviewLightbox(null)}
          >
            <div
              style={{
                width: typeInfo.isPdf ? '1000px' : typeInfo.isAudio ? '520px' : undefined,
                maxWidth: '92vw',
                maxHeight: '88vh',
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
                border: '1px solid var(--border-medium, rgba(255,255,255,0.1))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: 'var(--bg-surface)',
                  gap: '16px',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  {typeInfo.isImage ? (
                    <ImageIcon size={18} color="#0284c7" />
                  ) : typeInfo.isPdf ? (
                    <FileText size={18} color="#ef4444" />
                  ) : typeInfo.isVideo ? (
                    <VideoIcon size={18} color="#9333ea" />
                  ) : typeInfo.isAudio ? (
                    <Music size={18} color="#d97706" />
                  ) : (
                    <Paperclip size={18} color="#64748b" />
                  )}
                  <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {displayName}
                  </span>
                  {previewLightbox.media.sizeBytes ? (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ({Math.round(previewLightbox.media.sizeBytes / 1024)} KB)
                    </span>
                  ) : null}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={previewLightbox.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px', fontSize: '12px' }}
                  >
                    <ExternalLink size={13} /> Open Tab
                  </a>
                  <button
                    type="button"
                    onClick={(e) => handleDownloadMedia(previewLightbox.media.id, displayName, e)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', height: '30px', fontSize: '12px' }}
                  >
                    <Download size={13} /> Download
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLightbox(null)}
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '6px 8px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Content Body */}
              <div
                style={{
                  flex: 1,
                  overflow: 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: typeInfo.isPdf ? 0 : '16px',
                  backgroundColor: typeInfo.isImage || typeInfo.isVideo ? '#0b0f19' : '#f8fafc',
                }}
              >
                {typeInfo.isImage ? (
                  <img
                    src={previewLightbox.url}
                    alt={displayName}
                    style={{ maxWidth: '100%', maxHeight: '76vh', objectFit: 'contain', borderRadius: '4px' }}
                  />
                ) : typeInfo.isPdf ? (
                  <object
                    data={`${previewLightbox.url}#toolbar=1`}
                    type="application/pdf"
                    style={{
                      width: '100%',
                      height: '75vh',
                      border: 'none',
                      backgroundColor: '#ffffff',
                    }}
                  >
                    {/* Fallback if browser blocks inline object */}
                    <div
                      style={{
                        height: '100%',
                        minHeight: '340px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '40px 24px',
                        textAlign: 'center',
                        backgroundColor: '#ffffff',
                      }}
                    >
                      <div
                        style={{
                          width: '64px',
                          height: '64px',
                          borderRadius: '16px',
                          backgroundColor: '#fef2f2',
                          border: '1px solid #fecaca',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginBottom: '16px',
                        }}
                      >
                        <FileText size={32} color="#ef4444" />
                      </div>
                      <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                        {displayName}
                      </h3>
                      <p style={{ fontSize: '13px', color: '#64748b', maxWidth: '420px', marginBottom: '20px', lineHeight: 1.5 }}>
                        Your browser's PDF viewer is ready. Click below to view the document in a clean tab or download it directly.
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <a
                          href={previewLightbox.url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-primary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                        >
                          <ExternalLink size={14} /> Open in New Tab
                        </a>
                        <button
                          type="button"
                          onClick={(e) => handleDownloadMedia(previewLightbox.media.id, displayName, e)}
                          className="btn btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                        >
                          <Download size={14} /> Download PDF
                        </button>
                      </div>
                    </div>
                  </object>
                ) : typeInfo.isVideo ? (
                  <video
                    src={previewLightbox.url}
                    controls
                    autoPlay
                    style={{ maxWidth: '100%', maxHeight: '76vh', borderRadius: '4px' }}
                  />
                ) : typeInfo.isAudio ? (
                  <div style={{ padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', backgroundColor: '#ffffff', borderRadius: '8px' }}>
                    <div
                      style={{
                        width: '54px',
                        height: '54px',
                        borderRadius: '14px',
                        backgroundColor: '#fef3c7',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Music size={26} color="#d97706" />
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{displayName}</span>
                    <audio controls autoPlay src={previewLightbox.url} style={{ width: '380px' }} />
                  </div>
                ) : (
                  <div
                    style={{
                      width: '480px',
                      maxWidth: '90vw',
                      padding: '40px 24px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#ffffff',
                      borderRadius: '8px',
                      textAlign: 'center',
                    }}
                  >
                    <div
                      style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '14px',
                        backgroundColor: '#f1f5f9',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '14px',
                      }}
                    >
                      <FileText size={28} color="#64748b" />
                    </div>
                    <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '6px' }}>
                      {displayName}
                    </h3>
                    <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                      {previewLightbox.media.sizeBytes ? `${Math.round(previewLightbox.media.sizeBytes / 1024)} KB` : ''}
                    </p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <a
                        href={previewLightbox.url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                      >
                        <ExternalLink size={14} /> Open in New Tab
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleDownloadMedia(previewLightbox.media.id, displayName, e)}
                        className="btn btn-secondary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                      >
                        <Download size={14} /> Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

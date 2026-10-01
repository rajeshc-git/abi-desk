import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  CheckCircle2,
  UserPlus,
  ArrowUpRight,
  User,
  Globe,
  ArrowLeft,
  Trash2,
  Lock,
  Search,
  CheckSquare,
  Square,
  AlertTriangle,
  X,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { Modal } from '../components/common/Modal';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useToast } from '../context/ToastContext';
import { useSearch } from '../context/SearchContext';

interface ChatConversation {
  id: string;
  subject?: string;
  status: string;
  pageUrl?: string;
  lastMessagePreview?: string;
  lastMessageAt?: string;
  messageCount: number;
  participants: Array<{
    user: { id: string; fullName: string; avatarUrl?: string };
    role: string;
    userId: string;
    lastReadAt?: string;
  }>;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  body: string;
  kind: string;
  sender?: { id: string; fullName: string; avatarUrl?: string; kind?: string };
  createdAt: string;
}

const getAvatarColor = (name?: string, isAgent?: boolean) => {
  if (isAgent) {
    return 'linear-gradient(135deg, var(--primary), var(--primary-hover))';
  }
  return 'var(--primary-surface)';
};

const getInitials = (name?: string) => {
  if (!name) return 'U';
  let cleanName = name.trim();
  if (cleanName.includes('@')) {
    cleanName = cleanName.split('@')[0];
    cleanName = cleanName.replace(/[._-]/g, ' ');
  }
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  if (parts.length === 1 && parts[0]) {
    return parts[0].slice(0, Math.min(2, parts[0].length)).toUpperCase();
  }
  return 'U';
};

const renderAvatarContent = (name?: string, size: number = 16, avatarUrl?: string) => {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={name || 'User'}
        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%', display: 'block' }}
        onError={(e) => {
          (e.target as HTMLElement).style.display = 'none';
        }}
      />
    );
  }
  if (!name) return <User size={size} />;
  const cleanName = name.toLowerCase();
  const isGeneric =
    cleanName.includes('visitor') ||
    cleanName.includes('guest') ||
    cleanName.includes('customer') ||
    cleanName.includes('anonymous') ||
    cleanName === 'you';

  if (isGeneric) {
    return <User style={{ width: size, height: size }} />;
  }
  return getInitials(name);
};

const formatTime = (dateStr: string) => {
  try {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

export const LiveChatPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const toast = useToast();

  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConv, setActiveConv] = useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMsg, setInputMsg] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const { debouncedSearchQuery } = useSearch();

  // Status Filter Tabs (Ticket Desk Design Language)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'QUEUED' | 'CLOSED'>('ALL');

  // Bulk Selection & Delete States
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  const canDeleteChats =
    user?.roles?.some((r: string) => ['TENANT_ADMIN', 'ADMIN', 'PLATFORM_ADMIN', 'SUPER_ADMIN'].includes(r)) ||
    user?.permissions?.includes('ticket:delete') ||
    user?.kind === 'STAFF';

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'OPEN') {
        list = list.filter((c) => c.status === 'OPEN' || c.status === 'WAITING');
      } else {
        list = list.filter((c) => c.status === statusFilter);
      }
    }
    if (debouncedSearchQuery.trim()) {
      const query = debouncedSearchQuery.toLowerCase();
      list = list.filter((c) => {
        const customerName =
          c.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
          c.subject ||
          'Customer Visitor';
        const lastMessage = c.lastMessagePreview || '';
        return (
          customerName.toLowerCase().includes(query) ||
          lastMessage.toLowerCase().includes(query) ||
          (c.subject && c.subject.toLowerCase().includes(query))
        );
      });
    }
    return list;
  }, [conversations, statusFilter, debouncedSearchQuery]);

  useEffect(() => {
    loadConversations();
  }, []);

  const getChatViewedKey = (convId: string) =>
    user?.id ? `chat:last_viewed:${user.id}:${convId}` : `chat:last_viewed:${convId}`;

  useEffect(() => {
    if (!socket || !activeConv) return;

    socket.emit('join_conversation', { conversationId: activeConv.id });

    const handleNewMessage = (data: { conversationId: string; message: ChatMessage }) => {
      if (data.conversationId === activeConv.id) {
        setMessages((prev) => [...prev, data.message]);
        localStorage.setItem(getChatViewedKey(activeConv.id), new Date().toISOString());
        window.dispatchEvent(new Event('unread_chats_updated'));
      }
    };

    socket.on('chat.message', handleNewMessage);

    return () => {
      socket.emit('leave_conversation', { conversationId: activeConv.id });
      socket.off('chat.message', handleNewMessage);
    };
  }, [socket, activeConv?.id, user?.id]);

  useEffect(() => {
    if (!socket) return;

    const handleInboxUpdated = (data: { conversationId: string; lastMessage: string }) => {
      setConversations((prev) => {
        const index = prev.findIndex((c) => c.id === data.conversationId);
        if (index === -1) {
          loadConversations();
          return prev;
        }

        const list = [...prev];
        const conv = { ...list[index] };
        conv.lastMessagePreview = data.lastMessage;
        conv.lastMessageAt = new Date().toISOString();
        list.splice(index, 1);
        list.unshift(conv);
        return list;
      });

      if (!activeConv || activeConv.id !== data.conversationId) {
        setUnreadCounts((prev) => ({
          ...prev,
          [data.conversationId]: (prev[data.conversationId] || 0) + 1,
        }));
      }
    };

    socket.on('chat.inbox_updated', handleInboxUpdated);

    return () => {
      socket.off('chat.inbox_updated', handleInboxUpdated);
    };
  }, [socket, activeConv?.id]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      const res = await ApiClient.get<{ conversations: ChatConversation[] }>('/chat/conversations');
      const list = res.conversations || [];
      setConversations(list);

      const counts: Record<string, number> = {};
      list.forEach((c) => {
        if (c.id === activeConv?.id) {
          counts[c.id] = 0;
          return;
        }

        const localViewed = localStorage.getItem(getChatViewedKey(c.id));
        if (localViewed && c.lastMessageAt) {
          const hasNew = new Date(c.lastMessageAt).getTime() > new Date(localViewed).getTime();
          counts[c.id] = hasNew ? 1 : 0;
          return;
        }

        const me = c.participants.find((p) => p.userId === user?.id);
        if (c.status === 'QUEUED') {
          counts[c.id] = 1;
        } else if (c.lastMessageAt && me?.lastReadAt) {
          const hasNew = new Date(c.lastMessageAt).getTime() > new Date(me.lastReadAt).getTime();
          counts[c.id] = hasNew ? 1 : 0;
        } else {
          counts[c.id] = 0;
        }
      });
      setUnreadCounts((prev) => ({ ...prev, ...counts }));

      if (list.length > 0 && !activeConv) {
        selectConversation(list[0]);
      }
    } catch {
      // Fallback
    } finally {
      setIsLoading(false);
    }
  };

  const selectConversation = async (conv: ChatConversation) => {
    setActiveConv(conv);
    setUnreadCounts((prev) => ({ ...prev, [conv.id]: 0 }));
    localStorage.setItem(getChatViewedKey(conv.id), new Date().toISOString());
    window.dispatchEvent(new Event('unread_chats_updated'));
    try {
      const res = await ApiClient.get<{ messages: ChatMessage[] }>(
        `/chat/conversations/${conv.id}/messages`,
      );
      setMessages(res.messages || []);
    } catch {
      // Fallback
    }
  };

  const handleToggleSelect = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(convId)) {
        next.delete(convId);
      } else {
        next.add(convId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredConversations.length && filteredConversations.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredConversations.map((c) => c.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      await ApiClient.post('/chat/conversations/bulk-delete', { conversationIds: ids });
      toast.success(`${ids.length} chat conversation${ids.length > 1 ? 's' : ''} deleted.`);
      setConversations((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      if (activeConv && selectedIds.has(activeConv.id)) {
        setActiveConv(null);
        setMessages([]);
      }
      setSelectedIds(new Set());
      setIsBulkDeleteOpen(false);
    } catch (err: any) {
      toast.error(`Failed to delete chats: ${err.message || 'Unknown error'}`);
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkClose = async () => {
    if (selectedIds.size === 0) return;
    try {
      const ids = Array.from(selectedIds);
      await ApiClient.post('/chat/conversations/bulk-close', { conversationIds: ids });
      toast.success(`${ids.length} chat conversation${ids.length > 1 ? 's' : ''} closed.`);
      setConversations((prev) =>
        prev.map((c) => (selectedIds.has(c.id) ? { ...c, status: 'CLOSED' } : c)),
      );
      if (activeConv && selectedIds.has(activeConv.id)) {
        setActiveConv((prev) => (prev ? { ...prev, status: 'CLOSED' } : null));
      }
      setSelectedIds(new Set());
    } catch (err: any) {
      toast.error(`Failed to close chats: ${err.message || 'Unknown error'}`);
    }
  };

  const handleCloseActiveChat = async () => {
    if (!activeConv) return;
    try {
      await ApiClient.post(`/chat/conversations/${activeConv.id}/close`);
      toast.success('Conversation marked as closed.');
      setActiveConv((prev) => (prev ? { ...prev, status: 'CLOSED' } : null));
      setConversations((prev) =>
        prev.map((c) => (c.id === activeConv.id ? { ...c, status: 'CLOSED' } : c)),
      );
    } catch (err: any) {
      toast.error(`Failed to close chat: ${err.message || 'Unknown error'}`);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeConv) return;

    localStorage.setItem(getChatViewedKey(activeConv.id), new Date().toISOString());
    window.dispatchEvent(new Event('unread_chats_updated'));

    if (socket && isConnected) {
      socket.emit('send_message', {
        conversationId: activeConv.id,
        message: { body: inputMsg },
      });
    } else {
      const newMsg = await ApiClient.post(`/chat/conversations/${activeConv.id}/messages`, {
        body: inputMsg,
      });
      setMessages((prev) => [...prev, newMsg]);
    }
    setInputMsg('');
  };

  const handleAcceptChat = async () => {
    if (!activeConv) return;
    try {
      await ApiClient.post(`/chat/conversations/${activeConv.id}/accept`);
      setActiveConv((prev) => (prev ? { ...prev, status: 'OPEN' } : null));
      loadConversations();
      toast.success('Chat accepted! You can now reply.');
    } catch (err: any) {
      toast.error(`Failed to accept chat: ${err.message}`);
    }
  };

  const handlePromoteToTicket = async () => {
    if (!activeConv) return;
    try {
      const res = await ApiClient.post(`/chat/conversations/${activeConv.id}/promote`, {
        subject: activeConv.subject || 'Live Chat Inquiry',
        priority: 'NORMAL',
      });
      toast.success(`Chat successfully promoted to Ticket #${res.ticket.number}!`);
      navigate(`/tickets/${res.ticket.id}`);
    } catch (err: any) {
      toast.error(`Failed to promote chat: ${err.message}`);
    }
  };

  return (
    <div
      className={`split-pane-layout livechat-split-layout ${activeConv ? 'has-selected' : ''}`}
      style={{ height: '100%', flex: 1, overflow: 'hidden' }}
    >
      {/* Left Pane: Active Chat Conversations Queue */}
      <div className="split-left-pane livechat-left-pane" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Live Chat Desk
              </h2>
              {conversations.length > 0 && (
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  {filteredConversations.length} of {conversations.length}
                </span>
              )}
            </div>
          </div>

          {/* Status Tabs Segmented Control (matches Ticket Desk) */}
          <div className="inbox-status-tabs-container">
            {[
              { id: 'ALL', label: 'All' },
              { id: 'OPEN', label: 'Active' },
              { id: 'QUEUED', label: 'Queued' },
              { id: 'CLOSED', label: 'Closed' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setStatusFilter(tab.id as any);
                  setSelectedIds(new Set());
                }}
                className={`inbox-status-tab-btn ${statusFilter === tab.id ? 'active' : ''}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk Action Toolbar (matches Ticket Desk) */}
        {selectedIds.size > 0 && (
          <div
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--primary-surface, #eff6ff)',
              borderBottom: '1px solid var(--primary-border, #bfdbfe)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            <span style={{ color: 'var(--primary, #2563eb)' }}>{selectedIds.size} selected</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={handleBulkClose}
                className="btn btn-secondary btn-sm"
                style={{ padding: '3px 8px', fontSize: '11px', height: '26px' }}
                title="Mark selected as closed"
              >
                <Lock size={12} /> Close
              </button>
              {canDeleteChats && (
                <button
                  type="button"
                  onClick={() => setIsBulkDeleteOpen(true)}
                  className="btn btn-danger btn-sm"
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    height: '26px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontWeight: 600,
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                  title="Permanently delete selected chats"
                >
                  <Trash2 size={12} /> Delete ({selectedIds.size})
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', fontSize: '11px', color: 'var(--text-muted)' }}
              >
                Clear
              </button>
            </div>
          </div>
        )}

        <div className="livechat-queue-list">
          {isLoading ? (
            <LoadingSpinner size={24} text="Loading chats..." />
          ) : filteredConversations.length === 0 ? (
            <div className="livechat-queue-empty">
              {statusFilter !== 'ALL'
                ? `No ${statusFilter.toLowerCase()} chat conversations found.`
                : 'No active chat visitors right now.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {filteredConversations.map((c) => {
                const isActive = activeConv?.id === c.id;
                const isSelected = selectedIds.has(c.id);
                const senderName =
                  c.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                  c.subject ||
                  'Customer Visitor';
                const avatarBg = getAvatarColor(senderName, false);
                const unreadCount = unreadCounts[c.id] || 0;

                return (
                  <div
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      minWidth: 0,
                      width: '100%',
                    }}
                  >
                    {/* Item Checkbox matching Ticket Desk */}
                    <button
                      type="button"
                      onClick={(e) => handleToggleSelect(c.id, e)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        padding: '0 8px 0 12px',
                        color: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      title="Select chat"
                    >
                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>

                    {/* Chat Item Row matching Ticket Desk Card UI */}
                    <div
                      onClick={() => selectConversation(c)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        padding: '12px 16px',
                        borderBottom: '1px solid var(--border-subtle)',
                        backgroundColor: isActive
                          ? 'var(--primary-surface)'
                          : unreadCount > 0
                          ? 'var(--bg-surface-elevated, #f0f9ff)'
                          : 'transparent',
                        borderLeft: isActive
                          ? '3px solid var(--primary)'
                          : unreadCount > 0
                          ? '3px solid #2563eb'
                          : '3px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        boxSizing: 'border-box',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-surface, #f8fafc)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive)
                          e.currentTarget.style.backgroundColor = unreadCount > 0 ? 'var(--bg-surface-elevated, #f0f9ff)' : 'transparent';
                      }}
                    >
                      <div
                        className="livechat-conv-avatar"
                        style={{
                          background: avatarBg,
                          overflow: 'hidden',
                          flexShrink: 0,
                        }}
                      >
                        {renderAvatarContent(senderName, 16, c.participants.find((p) => p.role === 'CUSTOMER')?.user?.avatarUrl)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '2px',
                          }}
                        >
                          <span className="livechat-conv-name">
                            {senderName}
                          </span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                            {c.lastMessageAt ? formatTime(c.lastMessageAt) : ''}
                          </span>
                        </div>
                        <div className="livechat-conv-preview">
                          {c.lastMessagePreview || 'New chat session started'}
                        </div>
                      </div>
                      {unreadCount > 0 && (
                        <div className="livechat-unread-badge">
                          {unreadCount}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Fixed Bottom Status Bar matching Sidebar Baseline */}
        {!isLoading && filteredConversations.length > 0 && (
          <div
            style={{
              padding: '0 16px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: '#ffffff',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '58px',
              boxSizing: 'border-box',
              fontSize: '11.5px',
              color: 'var(--text-muted)',
            }}
          >
            Showing {filteredConversations.length} {statusFilter !== 'ALL' ? statusFilter.toLowerCase() : ''} conversation{filteredConversations.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Right Pane: Live Chat Stream Workspace */}
      <div className="split-right-pane livechat-right-pane">
        {activeConv ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div className="livechat-header">
              <div className="livechat-header-user">
                <button
                  type="button"
                  onClick={() => setActiveConv(null)}
                  className="ticket-header-back-btn mobile-only-back-btn"
                  title="Back to Chat Queue"
                >
                  <ArrowLeft size={16} />
                </button>
                <div
                  className="livechat-avatar"
                  style={{
                    background: getAvatarColor(
                      activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                        activeConv.subject,
                      false,
                    ),
                    overflow: 'hidden',
                  }}
                >
                  {renderAvatarContent(
                    activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                      activeConv.subject,
                    18,
                    activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.avatarUrl,
                  )}
                </div>
                <div className="livechat-header-info">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 className="livechat-header-name">
                      {activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                        activeConv.subject ||
                        'Live Chat Visitor'}
                    </h3>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: activeConv.status === 'CLOSED' ? '#6b7280' : '#10b981',
                        backgroundColor: activeConv.status === 'CLOSED' ? 'rgba(107, 114, 128, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        padding: '2px 8px',
                        borderRadius: '9999px',
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: activeConv.status === 'CLOSED' ? '#6b7280' : '#10b981',
                        }}
                      />
                      {activeConv.status === 'CLOSED' ? 'Closed' : 'Active'}
                    </span>
                  </div>
                  {activeConv.pageUrl && (
                    <div className="livechat-origin-badge">
                      <Globe size={11} />
                      <span className="livechat-origin-label">Origin:</span>{' '}
                      <a
                        href={activeConv.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {activeConv.pageUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="livechat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeConv.status === 'QUEUED' && (
                  <button
                    type="button"
                    onClick={handleAcceptChat}
                    className="btn btn-secondary livechat-action-btn"
                    title="Accept Chat"
                  >
                    <UserPlus size={14} />
                    <span className="livechat-action-btn-text">Accept Chat</span>
                  </button>
                )}
                {activeConv.status !== 'CLOSED' && (
                  <>
                    <button
                      type="button"
                      onClick={handleCloseActiveChat}
                      className="btn btn-secondary livechat-action-btn"
                      title="Close Conversation"
                    >
                      <Lock size={14} />
                      <span className="livechat-action-btn-text">Close Chat</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePromoteToTicket}
                      className="btn btn-primary livechat-action-btn"
                      title="Promote to Ticket"
                    >
                      <ArrowUpRight size={14} />
                      <span className="livechat-action-btn-text">Promote to Ticket</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Chat Stream */}
            <div className="livechat-stream-container">
              <div className="livechat-stream-inner">
                {messages.map((m) => {
                  const isAgent = m.sender?.kind === 'STAFF';
                  const isSystem = m.kind === 'SYSTEM' || m.kind === 'TICKET_LINK';

                  if (isSystem) {
                    return (
                      <div
                        key={m.id}
                        style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}
                      >
                        <span className="livechat-system-badge">
                          {m.body}
                        </span>
                      </div>
                    );
                  }

                  const senderName = m.sender?.fullName || (isAgent ? 'Support Agent' : 'Customer');
                  const avatarBg = getAvatarColor(senderName, isAgent);

                  return (
                    <div
                      key={m.id}
                      className={`livechat-bubble-row ${isAgent ? 'is-agent' : 'is-customer'}`}
                    >
                      <div
                        className="livechat-bubble-avatar"
                        style={{
                          background: avatarBg,
                          color: isAgent ? 'var(--text-inverse)' : 'var(--primary)',
                          border: isAgent ? 'none' : '1px solid var(--primary-border)',
                          overflow: 'hidden',
                        }}
                      >
                        {renderAvatarContent(senderName, 14, m.sender?.avatarUrl)}
                      </div>

                      <div className="livechat-bubble-content">
                        <div className="livechat-bubble-body">
                          {m.body}
                        </div>
                        <span className="livechat-bubble-meta">
                          {senderName} · {formatTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input Bar */}
            <div className="livechat-composer-container">
              <form onSubmit={handleSendMessage} className="livechat-composer-form">
                <input
                  type="text"
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  placeholder={
                    activeConv.status === 'CLOSED'
                      ? 'This conversation is closed.'
                      : activeConv.status === 'QUEUED'
                        ? 'Accept the chat to start replying...'
                        : 'Type a message to the customer...'
                  }
                  disabled={activeConv.status === 'CLOSED' || activeConv.status === 'QUEUED'}
                  className="livechat-composer-input"
                />
                <button
                  type="submit"
                  disabled={
                    !inputMsg.trim() ||
                    activeConv.status === 'CLOSED' ||
                    activeConv.status === 'QUEUED'
                  }
                  className="livechat-composer-send"
                  style={{
                    backgroundColor:
                      inputMsg.trim() && activeConv.status !== 'QUEUED'
                        ? 'var(--primary)'
                        : 'var(--border-subtle)',
                    color: 'var(--text-inverse)',
                    cursor:
                      inputMsg.trim() && activeConv.status !== 'QUEUED' ? 'pointer' : 'not-allowed',
                  }}
                  title="Send Message"
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="livechat-empty-workspace" style={{ flex: 1 }}>
              <MessageSquare size={32} style={{ opacity: 0.5 }} />
              <span style={{ fontSize: '14px', fontWeight: 500 }}>
                Select a live chat visitor from the left queue to begin.
              </span>
            </div>
            <div
              style={{
                height: '58px',
                boxSizing: 'border-box',
                borderTop: '1px solid var(--border-subtle)',
                backgroundColor: '#ffffff',
                flexShrink: 0,
              }}
            />
          </div>
        )}
      </div>

      {/* Bulk Delete Chats Confirmation Modal */}
      <Modal
        isOpen={isBulkDeleteOpen}
        onClose={() => !isBulkDeleting && setIsBulkDeleteOpen(false)}
        title={`Delete ${selectedIds.size} Chat Conversation${selectedIds.size > 1 ? 's' : ''}?`}
        maxWidth="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '10px',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Trash2 size={22} color="#dc2626" />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Permanent Database Deletion
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {selectedIds.size} chat conversation{selectedIds.size > 1 ? 's' : ''} selected
              </div>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            Are you sure you want to permanently delete <strong>{selectedIds.size} selected chat conversation{selectedIds.size > 1 ? 's' : ''}</strong> from the database? All associated message transcripts and visitor data will be completely removed. <strong>This action cannot be undone.</strong>
          </p>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '8px' }}>
            <button
              type="button"
              onClick={() => setIsBulkDeleteOpen(false)}
              disabled={isBulkDeleting}
              className="btn btn-secondary btn-sm"
              style={{ padding: '7px 16px' }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="btn btn-danger btn-sm"
              style={{
                padding: '7px 18px',
                backgroundColor: '#dc2626',
                color: '#ffffff',
                border: 'none',
                fontWeight: 600,
              }}
            >
              {isBulkDeleting ? 'Deleting...' : `Permanently Delete (${selectedIds.size})`}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};


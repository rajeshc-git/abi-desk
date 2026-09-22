import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { StatusBadge } from '../components/common/Badge';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
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

  const filteredConversations = React.useMemo(() => {
    if (!debouncedSearchQuery.trim()) return conversations;
    const query = debouncedSearchQuery.toLowerCase();
    return conversations.filter((c) => {
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
  }, [conversations, debouncedSearchQuery]);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (!socket || !activeConv) return;

    socket.emit('join_conversation', { conversationId: activeConv.id });

    const handleNewMessage = (data: { conversationId: string; message: ChatMessage }) => {
      if (data.conversationId === activeConv.id) {
        setMessages((prev) => [...prev, data.message]);
        localStorage.setItem(`chat:last_viewed:${activeConv.id}`, new Date().toISOString());
      }
    };

    socket.on('chat.message', handleNewMessage);

    return () => {
      socket.emit('leave_conversation', { conversationId: activeConv.id });
      socket.off('chat.message', handleNewMessage);
    };
  }, [socket, activeConv?.id]);

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

        const localViewed = localStorage.getItem(`chat:last_viewed:${c.id}`);
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
    localStorage.setItem(`chat:last_viewed:${conv.id}`, new Date().toISOString());
    try {
      const res = await ApiClient.get<{ messages: ChatMessage[] }>(
        `/chat/conversations/${conv.id}/messages`,
      );
      setMessages(res.messages || []);
    } catch {
      // Fallback
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim() || !activeConv) return;

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
      style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}
    >
      {/* Left Pane: Active Chat Conversations Queue */}
      <div className="split-left-pane livechat-left-pane">
        <div className="livechat-queue-header">
          <div>
            <h2 className="livechat-queue-title">Live Chat Desk</h2>
            <div
              className="livechat-gateway-status"
              style={{
                color: isConnected ? '#10b981' : '#f59e0b',
              }}
            >
              <span
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: isConnected ? '#10b981' : '#f59e0b',
                  display: 'inline-block',
                }}
              ></span>
              {isConnected ? 'Real-time Gateway Online' : 'Connecting...'}
            </div>
          </div>
        </div>

        <div className="livechat-queue-list">
          {isLoading ? (
            <LoadingSpinner size={24} text="Loading chats..." />
          ) : filteredConversations.length === 0 ? (
            <div className="livechat-queue-empty">
              No active chat visitors right now.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredConversations.map((c) => {
                const isActive = activeConv?.id === c.id;
                const senderName =
                  c.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                  c.subject ||
                  'Customer Visitor';
                const avatarBg = getAvatarColor(senderName, false);
                const unreadCount = unreadCounts[c.id] || 0;

                return (
                  <div
                    key={c.id}
                    onClick={() => selectConversation(c)}
                    className={`livechat-conv-item ${isActive ? 'active' : ''}`}
                  >
                    <div
                      className="livechat-conv-avatar"
                      style={{
                        background: avatarBg,
                        overflow: 'hidden',
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
                );
              })}
            </div>
          )}
        </div>
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
                  <h3 className="livechat-header-name">
                    {activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                      activeConv.subject ||
                      'Live Chat Visitor'}
                  </h3>
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

              <div className="livechat-header-actions">
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
                  <button
                    type="button"
                    onClick={handlePromoteToTicket}
                    className="btn btn-primary livechat-action-btn"
                    title="Promote to Ticket"
                  >
                    <ArrowUpRight size={14} />
                    <span className="livechat-action-btn-text">Promote to Ticket</span>
                  </button>
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
          <div className="livechat-empty-workspace">
            <MessageSquare size={32} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              Select a live chat visitor from the left queue to begin.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

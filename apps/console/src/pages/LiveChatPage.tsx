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
    user: { id: string; fullName: string };
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
  sender?: { id: string; fullName: string; kind?: string };
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

const renderAvatarContent = (name?: string, size: number = 16) => {
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
    <div className="split-pane-layout" style={{ height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
      {/* Left Pane: Active Chat Conversations Queue */}
      <div
        className="split-left-pane"
        style={{
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-app)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <h2
              style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
            >
              Live Chat Desk
            </h2>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11px',
                color: isConnected ? '#10b981' : '#f59e0b',
                marginTop: '4px',
                fontWeight: 600,
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

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
          {isLoading ? (
            <LoadingSpinner size={24} text="Loading chats..." />
          ) : filteredConversations.length === 0 ? (
            <div
              style={{
                padding: '40px 20px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}
            >
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
                    style={{
                      padding: '12px 14px',
                      borderRadius: '12px',
                      backgroundColor: isActive ? 'var(--bg-surface)' : 'transparent',
                      boxShadow: isActive ? 'var(--shadow-md)' : 'none',
                      border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        background: avatarBg,
                        color: 'var(--primary)',
                        border: '1px solid var(--primary-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '13px',
                        flexShrink: 0,
                      }}
                    >
                      {renderAvatarContent(senderName, 16)}
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
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {senderName}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-muted)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {c.lastMessagePreview || 'New chat session started'}
                      </div>
                    </div>
                    {unreadCount > 0 && (
                      <div
                        style={{
                          minWidth: '20px',
                          height: '20px',
                          borderRadius: '10px',
                          backgroundColor: 'var(--primary)',
                          color: 'var(--text-inverse)',
                          fontSize: '10px',
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 6px',
                          flexShrink: 0,
                          animation:
                            'console-badge-pop 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards',
                        }}
                      >
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
      <div
        className="split-right-pane"
        style={{ backgroundColor: 'var(--bg-surface)', display: 'flex', flexDirection: 'column' }}
      >
        {activeConv ? (
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Header */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                zIndex: 10,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  onClick={() => setActiveConv(null)}
                  className="mobile-back-btn"
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '8px',
                    marginRight: '4px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'none',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <ArrowLeft size={20} />
                </button>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    background: getAvatarColor(
                      activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                        activeConv.subject,
                      false,
                    ),
                    color: 'var(--primary)',
                    border: '1px solid var(--primary-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: '14px',
                  }}
                >
                  {renderAvatarContent(
                    activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                      activeConv.subject,
                    18,
                  )}
                </div>
                <div>
                  <h3
                    style={{
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      margin: 0,
                    }}
                  >
                    {activeConv.participants.find((p) => p.role === 'CUSTOMER')?.user?.fullName ||
                      activeConv.subject ||
                      'Live Chat Visitor'}
                  </h3>
                  {activeConv.pageUrl && (
                    <div
                      style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        marginTop: '2px',
                      }}
                    >
                      <Globe size={11} /> Origin:{' '}
                      <a
                        href={activeConv.pageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--primary)', textDecoration: 'none' }}
                      >
                        {activeConv.pageUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {activeConv.status === 'QUEUED' && (
                  <button
                    onClick={handleAcceptChat}
                    className="btn btn-secondary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                  >
                    <UserPlus size={14} /> Accept Chat
                  </button>
                )}
                {activeConv.status !== 'CLOSED' && (
                  <button
                    onClick={handlePromoteToTicket}
                    className="btn btn-primary btn-sm"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      padding: '6px 12px',
                    }}
                  >
                    <ArrowUpRight size={14} /> Promote to Ticket
                  </button>
                )}
              </div>
            </div>

            {/* Chat Stream */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
                backgroundColor: 'var(--bg-app)',
              }}
            >
              <div
                style={{
                  maxWidth: '800px',
                  margin: '0 auto',
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                }}
              >
                {messages.map((m) => {
                  const isAgent = m.sender?.kind === 'STAFF';
                  const isSystem = m.kind === 'SYSTEM' || m.kind === 'TICKET_LINK';

                  if (isSystem) {
                    return (
                      <div
                        key={m.id}
                        style={{ display: 'flex', justifyContent: 'center', margin: '12px 0' }}
                      >
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            backgroundColor: 'var(--bg-surface-hover)',
                            padding: '4px 12px',
                            borderRadius: '12px',
                            fontWeight: 500,
                            border: '1px solid var(--border-subtle)',
                          }}
                        >
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
                      style={{
                        display: 'flex',
                        gap: '12px',
                        flexDirection: isAgent ? 'row-reverse' : 'row',
                        alignItems: 'flex-start',
                        animation: 'console-fade-up 0.25s ease-out forwards',
                      }}
                    >
                      <div
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: avatarBg,
                          color: isAgent ? 'var(--text-inverse)' : 'var(--primary)',
                          border: isAgent ? 'none' : '1px solid var(--primary-border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 700,
                          fontSize: '11px',
                          flexShrink: 0,
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        {renderAvatarContent(senderName, 14)}
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isAgent ? 'flex-end' : 'flex-start',
                          maxWidth: '70%',
                        }}
                      >
                        <div
                          style={{
                            padding: '12px 16px',
                            borderRadius: isAgent ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                            backgroundColor: isAgent ? 'var(--primary)' : 'var(--bg-surface)',
                            color: isAgent ? 'var(--text-inverse)' : 'var(--text-primary)',
                            border: isAgent ? 'none' : '1px solid var(--border-subtle)',
                            fontSize: '13px',
                            lineHeight: 1.5,
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                          }}
                        >
                          {m.body}
                        </div>
                        <span
                          style={{
                            fontSize: '10px',
                            color: 'var(--text-muted)',
                            marginTop: '4px',
                            marginLeft: '4px',
                            marginRight: '4px',
                          }}
                        >
                          {senderName} · {formatTime(m.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: '20px 24px',
                backgroundColor: 'var(--bg-surface)',
                borderTop: '1px solid var(--border-subtle)',
              }}
            >
              <form
                onSubmit={handleSendMessage}
                style={{
                  maxWidth: '800px',
                  margin: '0 auto',
                  width: '100%',
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
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
                  style={{
                    width: '100%',
                    padding: '12px 48px 12px 16px',
                    backgroundColor:
                      activeConv.status === 'CLOSED' || activeConv.status === 'QUEUED'
                        ? 'var(--bg-surface-hover)'
                        : 'var(--bg-app)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '24px',
                    color: 'var(--text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    transition: 'all 0.2s',
                    boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)',
                  }}
                />
                <button
                  type="submit"
                  disabled={
                    !inputMsg.trim() ||
                    activeConv.status === 'CLOSED' ||
                    activeConv.status === 'QUEUED'
                  }
                  style={{
                    position: 'absolute',
                    right: '6px',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    backgroundColor:
                      inputMsg.trim() && activeConv.status !== 'QUEUED'
                        ? 'var(--primary)'
                        : 'var(--border-subtle)',
                    color: 'var(--text-inverse)',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor:
                      inputMsg.trim() && activeConv.status !== 'QUEUED' ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  <Send size={14} />
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              gap: '12px',
            }}
          >
            <MessageSquare size={32} style={{ opacity: 0.5 }} />
            <span style={{ fontSize: '14px', fontWeight: 500 }}>
              Select a live chat visitor from the left queue to begin.
            </span>
          </div>
        )}
      </div>
      <style>{`
        @keyframes console-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes console-badge-pop {
          from { opacity: 0; transform: scale(0.6); }
          to { opacity: 1; transform: scale(1); }
        }
        @media (max-width: 768px) {
          .split-pane-layout {
            grid-template-columns: 1fr !important;
          }
          .split-left-pane {
            display: ${activeConv ? 'none !important' : 'flex !important'};
            width: 100% !important;
          }
          .split-right-pane {
            display: ${activeConv ? 'flex !important' : 'none !important'};
            width: 100% !important;
          }
          .mobile-back-btn {
            display: flex !important;
          }
        }
      `}</style>
    </div>
  );
};

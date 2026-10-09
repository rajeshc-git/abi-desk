import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Check,
  Trash2,
  AtSign,
  MessageSquare,
  Ticket,
  ExternalLink,
  X,
} from 'lucide-react';
import { useNotifications, AppNotification } from '../../context/NotificationContext';
import { useAuth } from '../../context/AuthContext';

interface NotificationDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export const NotificationDropdown: React.FC<NotificationDropdownProps> = ({
  isOpen,
  onClose,
  triggerRef,
}) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ALL' | 'MENTIONS'>('ALL');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef]);

  if (!isOpen) return null;

  const isTenantAdmin = user?.roles?.some((r) => r === 'TENANT_ADMIN' || r === 'PLATFORM_ADMIN');
  const userProducts = (user?.products || []).map((p) => String(p).toLowerCase().trim()).filter(Boolean);
  const userProductIds = (user?.productIds || []).map((p) => String(p).toLowerCase().trim()).filter(Boolean);

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'MENTIONS') return n.type === 'MENTION';
    if (n.type === 'MENTION') return true;
    if (isTenantAdmin) return true;

    if (userProducts.length > 0 || userProductIds.length > 0) {
      if (n.product) return userProducts.includes(n.product.toLowerCase().trim());
      if (n.productId) return userProductIds.includes(n.productId.toLowerCase().trim());
      // Automatically hide legacy untagged notifications for product-restricted agents
      return false;
    }
    return true;
  });

  const handleNotificationClick = (item: AppNotification) => {
    markAsRead(item.id);
    onClose();
    if (item.linkUrl) {
      navigate(item.linkUrl);
    }
  };

  const formatTimeAgo = (dateStr: string) => {
    try {
      const now = Date.now();
      const time = new Date(dateStr).getTime();
      const diffSec = Math.floor((now - time) / 1000);

      if (diffSec < 45) return 'Just now';
      if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
      if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
      if (diffSec < 172800) return 'Yesterday';
      return new Date(dateStr).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  const getInitials = (name?: string) => {
    if (!name) return '??';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  return (
    <div
      ref={dropdownRef}
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: '8px',
        width: '380px',
        maxWidth: '90vw',
        maxHeight: '520px',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        borderRadius: '12px',
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 1000,
        overflow: 'hidden',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px 10px 16px',
          borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
              Notifications
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  backgroundColor: 'var(--primary, #2563eb)',
                  color: '#ffffff',
                  padding: '1px 7px',
                  borderRadius: '10px',
                }}
              >
                {unreadCount > 999 ? '999+' : unreadCount} new
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                title="Mark all as read"
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
                  padding: '3px 6px',
                  borderRadius: '4px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Check size={13} /> Mark all read
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('ALL')}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: '12px',
              fontWeight: activeTab === 'ALL' ? 700 : 500,
              color: activeTab === 'ALL' ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
              backgroundColor: activeTab === 'ALL' ? 'var(--bg-surface)' : 'transparent',
              border: activeTab === 'ALL' ? '1px solid var(--border-subtle)' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === 'ALL' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('MENTIONS')}
            style={{
              flex: 1,
              padding: '5px 0',
              fontSize: '12px',
              fontWeight: activeTab === 'MENTIONS' ? 700 : 500,
              color: activeTab === 'MENTIONS' ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
              backgroundColor: activeTab === 'MENTIONS' ? 'var(--bg-surface)' : 'transparent',
              border: activeTab === 'MENTIONS' ? '1px solid var(--border-subtle)' : '1px solid transparent',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              transition: 'all 0.15s ease',
              boxShadow: activeTab === 'MENTIONS' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
            }}
          >
            <AtSign size={13} /> Mentions ({notifications.filter((n) => n.type === 'MENTION').length})
          </button>
        </div>
      </div>

      {/* Notification List Stream */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: '120px', maxHeight: '380px' }}>
        {filteredNotifications.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--text-muted)',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: 'var(--bg-app, #f1f5f9)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <Bell size={18} />
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              {activeTab === 'MENTIONS' ? 'No mentions yet' : 'No notifications'}
            </div>
            <div style={{ fontSize: '11px', maxWidth: '220px' }}>
              {activeTab === 'MENTIONS'
                ? 'When a teammate @mentions you in an internal note or reply, it will appear here.'
                : 'Updates regarding your tickets, mentions, and customer replies will show here.'}
            </div>
          </div>
        ) : (
          filteredNotifications.map((item) => {
            const isMention = item.type === 'MENTION';
            return (
              <div
                key={item.id}
                onClick={() => handleNotificationClick(item)}
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                  backgroundColor: item.isRead
                    ? 'var(--bg-surface)'
                    : isMention
                    ? 'rgba(37, 99, 235, 0.04)'
                    : 'var(--bg-surface-elevated, #f8fafc)',
                  borderLeft: !item.isRead
                    ? isMention
                      ? '3px solid var(--primary, #2563eb)'
                      : '3px solid #10b981'
                    : '3px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)')}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = item.isRead
                    ? 'var(--bg-surface)'
                    : isMention
                    ? 'rgba(37, 99, 235, 0.04)'
                    : 'var(--bg-surface-elevated, #f8fafc)')
                }
              >
                {/* Avatar / Icon */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: isMention ? 'rgba(37, 99, 235, 0.12)' : '#e2e8f0',
                      color: isMention ? 'var(--primary, #2563eb)' : '#334155',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    {isMention ? <AtSign size={16} /> : getInitials(item.authorName)}
                  </div>
                  {isMention && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '-2px',
                        right: '-2px',
                        width: '14px',
                        height: '14px',
                        borderRadius: '50%',
                        backgroundColor: '#f59e0b',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '8px',
                        fontWeight: 800,
                        border: '1.5px solid var(--bg-surface, #ffffff)',
                      }}
                      title="Internal Note / Mention"
                    >
                      ★
                    </div>
                  )}
                </div>

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      marginBottom: '2px',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: item.isRead ? 600 : 700,
                        color: 'var(--text-primary)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {item.title}
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--text-muted)',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {formatTimeAgo(item.createdAt)}
                    </span>
                  </div>

                  <p
                    style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary, #475569)',
                      margin: 0,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.message}
                  </p>

                  {item.ticketNumber && (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        fontSize: '11px',
                        color: 'var(--primary, #2563eb)',
                        fontWeight: 600,
                        marginTop: '4px',
                      }}
                    >
                      <Ticket size={11} /> Open Ticket #{item.ticketNumber} <ExternalLink size={10} />
                    </div>
                  )}
                </div>

                {/* Unread indicator */}
                {!item.isRead && (
                  <div
                    style={{
                      width: '7px',
                      height: '7px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--primary, #2563eb)',
                      flexShrink: 0,
                      marginTop: '6px',
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border-subtle, #e2e8f0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
          }}
        >
          <button
            type="button"
            onClick={clearAll}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 4px',
              borderRadius: '3px',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <Trash2 size={12} /> Clear all history
          </button>
        </div>
      )}
    </div>
  );
};

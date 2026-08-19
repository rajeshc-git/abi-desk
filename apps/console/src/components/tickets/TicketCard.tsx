import React from 'react';
import { PriorityPill, StatusBadge, TierBadge } from '../common/Badge';

export interface TicketSummary {
  id: string;
  number: number;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  tier: string;
  channel: string;
  category?: string;
  requester?: { fullName: string; email: string };
  assignee?: { fullName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

interface TicketCardProps {
  ticket: TicketSummary;
  isSelected?: boolean;
  isUnread?: boolean;
  onClick?: () => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({ ticket, isSelected, isUnread, onClick }) => {
  const rawDate = ticket.createdAt || ticket.updatedAt;
  const dateObj = rawDate ? new Date(rawDate) : new Date();
  const formattedDate = isNaN(dateObj.getTime())
    ? 'Just now'
    : dateObj.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  return (
    <div
      onClick={onClick}
      style={{
        padding: '14px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        backgroundColor: isSelected
          ? 'var(--primary-surface)'
          : isUnread
          ? 'var(--bg-surface-elevated, #f0f9ff)'
          : 'transparent',
        borderLeft: isSelected
          ? '3px solid var(--primary)'
          : isUnread
          ? '3px solid #2563eb'
          : '3px solid transparent',
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-surface)';
      }}
      onMouseLeave={(e) => {
        if (!isSelected)
          e.currentTarget.style.backgroundColor = isUnread ? 'var(--bg-surface-elevated, #f0f9ff)' : 'transparent';
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '6px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--primary)',
            }}
          >
            #{ticket.number}
          </span>
          <TierBadge tier={ticket.tier} />
          {isUnread && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 700,
                color: '#ffffff',
                backgroundColor: 'var(--primary, #2563eb)',
                padding: '1px 6px',
                borderRadius: '10px',
                letterSpacing: '0.5px',
                textTransform: 'uppercase',
                display: 'inline-flex',
                alignItems: 'center',
                boxShadow: '0 1px 2px rgba(37,99,235,0.3)',
              }}
            >
              NEW
            </span>
          )}
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div
        style={{
          fontSize: '14px',
          fontWeight: isUnread ? 700 : 600,
          color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary, #334155)',
          marginBottom: '6px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {ticket.subject}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <PriorityPill priority={ticket.priority} />
          <span>•</span>
          <span style={{ fontWeight: isUnread ? 600 : 400 }}>{ticket.requester?.fullName || 'Customer'}</span>
        </div>
        <span>{formattedDate}</span>
      </div>
    </div>
  );
};

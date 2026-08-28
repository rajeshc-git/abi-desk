import React from 'react';
import { Folder } from 'lucide-react';
import { PriorityPill, StatusBadge, TierBadge } from '../common/Badge';
import { useSearch } from '../../context/SearchContext';

export interface TicketSummary {
  id: string;
  number: number;
  subject: string;
  description?: string;
  status: string;
  priority: string;
  tier: string;
  channel: string;
  category?: string | null;
  requester?: { fullName: string; email: string };
  assignee?: { fullName: string; email: string } | null;
  tags?: Array<{ tag: { name: string; slug: string; color?: string } }>;
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
  const { setSelectedTag, setSelectedCategory } = useSearch();
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
        minWidth: 0,
        width: '100%',
        boxSizing: 'border-box',
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
          gap: '8px',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexShrink: 1, overflow: 'hidden' }}>
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              fontWeight: 700,
              color: 'var(--primary)',
              flexShrink: 0,
            }}
          >
            #{ticket.number}
          </span>
          <div style={{ flexShrink: 0 }}>
            <TierBadge tier={ticket.tier} />
          </div>
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
                flexShrink: 0,
              }}
            >
              NEW
            </span>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      <div
        title={ticket.subject}
        style={{
          fontSize: '14px',
          fontWeight: isUnread ? 700 : 600,
          color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary, #334155)',
          marginBottom: '6px',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%',
          display: 'block',
        }}
      >
        {ticket.subject}
      </div>

      {/* Category and Tags pills container */}
      {(ticket.category || (ticket.tags && ticket.tags.length > 0)) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
          {ticket.category && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setSelectedCategory({ name: ticket.category!, slug: ticket.category!.toLowerCase().replace(/\s+/g, '-') });
              }}
              style={{
                fontSize: '10px',
                fontWeight: 600,
                backgroundColor: '#f5f3ff',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                borderRadius: '3px',
                padding: '1px 5px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              title={`Filter by category: ${ticket.category}`}
            >
              <Folder size={9} />
              {ticket.category}
            </span>
          )}
          {ticket.tags?.map((tItem, idx) => {
            const tag = tItem.tag;
            if (!tag) return null;
            return (
              <span
                key={idx}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedTag({ name: tag.name, slug: tag.slug, color: tag.color });
                }}
                style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  backgroundColor: tag.color ? `${tag.color}15` : '#f1f5f9',
                  color: tag.color || '#475569',
                  border: `1px solid ${tag.color ? `${tag.color}40` : '#e2e8f0'}`,
                  borderRadius: '3px',
                  padding: '1px 5px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'opacity 0.15s',
                }}
                title={`Filter by tag: ${tag.name}`}
              >
                {tag.name}
              </span>
            );
          })}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '11px',
          color: 'var(--text-muted)',
          gap: '8px',
          minWidth: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1, overflow: 'hidden' }}>
          <div style={{ flexShrink: 0 }}>
            <PriorityPill priority={ticket.priority} />
          </div>
          <span style={{ flexShrink: 0 }}>•</span>
          <span
            title={ticket.requester?.fullName || 'Customer'}
            style={{
              fontWeight: isUnread ? 600 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {ticket.requester?.fullName || 'Customer'}
          </span>
        </div>
        <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{formattedDate}</span>
      </div>
    </div>
  );
};

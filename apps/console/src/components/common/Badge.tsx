import React from 'react';
import {
  Mail,
  Zap,
  Globe,
  ExternalLink,
  MessageSquare,
  Phone,
  Monitor,
} from 'lucide-react';

export const getChannelBadge = (channel?: string) => {
  const ch = (channel || 'EMAIL').toUpperCase();
  switch (ch) {
    case 'EMAIL':
      return {
        icon: <Mail size={12} />,
        label: 'Email',
        color: '#2563eb',
        bg: 'rgba(37, 99, 235, 0.1)',
        border: 'rgba(37, 99, 235, 0.25)',
      };
    case 'API':
      return {
        icon: <Zap size={12} />,
        label: 'API',
        color: '#7c3aed',
        bg: 'rgba(124, 58, 237, 0.1)',
        border: 'rgba(124, 58, 237, 0.25)',
      };
    case 'WIDGET':
      return {
        icon: <Globe size={12} />,
        label: 'Widget',
        color: '#059669',
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.25)',
      };
    case 'PORTAL':
      return {
        icon: <ExternalLink size={12} />,
        label: 'Portal',
        color: '#0891b2',
        bg: 'rgba(6, 182, 212, 0.1)',
        border: 'rgba(6, 182, 212, 0.25)',
      };
    case 'CHAT':
      return {
        icon: <MessageSquare size={12} />,
        label: 'Chat',
        color: '#4f46e5',
        bg: 'rgba(79, 70, 229, 0.1)',
        border: 'rgba(79, 70, 229, 0.25)',
      };
    case 'PHONE':
      return {
        icon: <Phone size={12} />,
        label: 'Phone',
        color: '#d97706',
        bg: 'rgba(217, 119, 6, 0.1)',
        border: 'rgba(217, 119, 6, 0.25)',
      };
    case 'WEB':
    case 'CONSOLE':
      return {
        icon: <Monitor size={12} />,
        label: 'Web',
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.1)',
        border: 'rgba(2, 132, 199, 0.25)',
      };
    default:
      return {
        icon: <Globe size={12} />,
        label: ch,
        color: '#475569',
        bg: 'rgba(100, 116, 139, 0.1)',
        border: 'rgba(100, 116, 139, 0.25)',
      };
  }
};

export interface ChannelBadgeProps {
  channel?: string;
  iconOnly?: boolean;
  responsiveIconOnly?: boolean;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export const ChannelBadge: React.FC<ChannelBadgeProps> = ({
  channel,
  iconOnly = false,
  responsiveIconOnly = false,
  size = 'md',
  className = '',
  style = {},
}) => {
  const badge = getChannelBadge(channel);
  const isSm = size === 'sm';

  return (
    <span
      className={`channel-badge-pill ${responsiveIconOnly ? 'responsive-icon-only' : ''} ${className}`.trim()}
      style={{
        backgroundColor: badge.bg,
        color: badge.color,
        border: `1px solid ${badge.border}`,
        ...(isSm ? { fontSize: '9.5px', padding: '1px 5px', gap: '3px', fontWeight: 650 } : {}),
        ...style,
      }}
      title={`Inbound Channel: ${badge.label}`}
    >
      {React.cloneElement(badge.icon as React.ReactElement<any>, {
        size: isSm ? 10.5 : 12,
      })}
      {!iconOnly && (
        <span className="channel-badge-label" style={{ textTransform: 'capitalize' }}>
          {badge.label}
        </span>
      )}
    </span>
  );
};

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = (status || '').toLowerCase().replace(/_/g, '-');
  const normalizedUnder = (status || '').toLowerCase();
  const label =
    status === 'OPEN'
      ? 'Open'
      : status === 'IN_PROGRESS'
      ? 'In Progress'
      : (status || '').replace(/_/g, ' ');

  const isNew = normalized === 'new';

  return (
    <span className={`badge badge-${normalized} badge-${normalizedUnder}`}>
      {isNew && (
        <span
          style={{
            width: '5px',
            height: '5px',
            borderRadius: '50%',
            backgroundColor: '#0d9488',
            display: 'inline-block',
            boxShadow: '0 0 4px #2dd4bf',
            flexShrink: 0,
          }}
        />
      )}
      {label}
    </span>
  );
};

interface PriorityPillProps {
  priority: string;
}

export const PriorityPill: React.FC<PriorityPillProps> = ({ priority }) => {
  const normalized = priority.toLowerCase();
  return (
    <span className="prio-pill">
      <span className={`prio-dot ${normalized}`} />
      <span>{priority}</span>
    </span>
  );
};

interface TierBadgeProps {
  tier?: string;
}

export const TierBadge: React.FC<TierBadgeProps> = ({ tier = 'L1' }) => {
  return <span className={`tier-pill ${tier}`}>{tier}</span>;
};

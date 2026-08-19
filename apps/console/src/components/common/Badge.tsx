import React from 'react';

interface StatusBadgeProps {
  status: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const normalized = status.toLowerCase();
  const label = status.replace(/_/g, ' ');

  return <span className={`badge badge-${normalized}`}>{label}</span>;
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

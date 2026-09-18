import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Check, ChevronDown, X, Loader2 } from 'lucide-react';

export interface StatusOption {
  value: string;
  label: string;
  color: string;
  category?: 'open' | 'pending' | 'development' | 'resolved' | 'closed';
  description?: string;
}

export const ALL_STATUSES: StatusOption[] = [
  { value: 'NEW', label: 'New', color: '#94a3b8', category: 'open' },
  { value: 'TRIAGE', label: 'Triage', color: '#64748b', category: 'open' },
  { value: 'OPEN', label: 'Open', color: '#0284c7', category: 'open' },
  { value: 'PENDING_CUSTOMER', label: 'Pending Customer', color: '#f59e0b', category: 'pending' },
  { value: 'ON_HOLD', label: 'On Hold', color: '#ea580c', category: 'pending' },
  { value: 'ESCALATED_L2', label: 'Escalated (L2)', color: '#ec4899', category: 'open' },
  { value: 'ESCALATED_L3', label: 'Escalated (L3)', color: '#d946ef', category: 'open' },
  { value: 'IN_DEVELOPMENT', label: 'In Development', color: '#6366f1', category: 'development' },
  { value: 'IN_QA', label: 'In QA', color: '#8b5cf6', category: 'development' },
  { value: 'PENDING_RELEASE', label: 'Pending Release', color: '#f97316', category: 'development' },
  { value: 'RELEASED', label: 'Released', color: '#06b6d4', category: 'development' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification', color: '#0ea5e9', category: 'development' },
  { value: 'AWAITING_CUSTOMER_CONFIRMATION', label: 'Awaiting Customer Confirmation', color: '#3b82f6', category: 'resolved' },
  { value: 'RESOLVED', label: 'Resolved', color: '#22c55e', category: 'resolved' },
  { value: 'CLOSED', label: 'Closed', color: '#16a34a', category: 'closed' },
  { value: 'REOPENED', label: 'Reopened', color: '#f43f5e', category: 'open' },
  { value: 'CANCELLED', label: 'Cancelled', color: '#ef4444', category: 'closed' },
];

export const getStatusMeta = (status: string): StatusOption => {
  const found = ALL_STATUSES.find((s) => s.value === status);
  if (found) return found;
  return {
    value: status,
    label: status.replace(/_/g, ' '),
    color: '#64748b',
  };
};

interface StatusPopoverProps {
  status: string;
  onStatusChange: (newStatus: string) => Promise<void> | void;
  disabled?: boolean;
  size?: 'sm' | 'md';
  align?: 'left' | 'right';
}

export const StatusPopover: React.FC<StatusPopoverProps> = ({
  status,
  onStatusChange,
  disabled = false,
  size = 'md',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentMeta = useMemo(() => getStatusMeta(status), [status]);

  const filteredStatuses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_STATUSES;
    return ALL_STATUSES.filter(
      (s) =>
        s.label.toLowerCase().includes(q) ||
        s.value.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = async (newStatus: string) => {
    if (newStatus === status || isUpdating) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      await onStatusChange(newStatus);
      setIsOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className="status-popover-btn"
        disabled={disabled || isUpdating}
        onClick={() => setIsOpen((prev) => !prev)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          height: '28px',
          padding: '0 9px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: '1px solid var(--border-medium, #e2e8f0)',
          borderRadius: 'var(--radius-md, 6px)',
          color: 'var(--text-primary, #0f172a)',
          fontSize: '11.5px',
          fontWeight: 600,
          cursor: disabled || isUpdating ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease-in-out',
          outline: 'none',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        title="Change Status (Zoho Desk style)"
      >
        {isUpdating ? (
          <Loader2 size={13} className="animate-spin" style={{ color: currentMeta.color }} />
        ) : (
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: currentMeta.color,
              flexShrink: 0,
              boxShadow: `0 0 0 2px ${currentMeta.color}22`,
            }}
          />
        )}
        <span style={{ whiteSpace: 'nowrap' }}>{currentMeta.label}</span>
        <ChevronDown size={13} style={{ color: 'var(--text-muted)', marginLeft: '2px' }} />
      </button>

      {/* Zoho Desk Styled Popover */}
      {isOpen && (
        <div
          className="status-popover-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            width: '260px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-medium)',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            overflow: 'hidden',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          {/* Search Header */}
          <div
            style={{
              padding: '8px 10px',
              borderBottom: '1px solid var(--border-subtle)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={14}
              style={{
                position: 'absolute',
                left: '18px',
                color: 'var(--text-muted)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search Status"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 28px 6px 30px',
                fontSize: '12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-app)',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '18px',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Group Header */}
          <div
            style={{
              padding: '8px 12px 4px 12px',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle)',
              marginBottom: '2px',
            }}
          >
            STATUS
          </div>

          {/* Status List */}
          <div
            style={{
              maxHeight: '280px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {filteredStatuses.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                No statuses found
              </div>
            ) : (
              filteredStatuses.map((item) => {
                const isSelected = item.value === status;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => handleSelect(item.value)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '5px',
                      border: 'none',
                      backgroundColor: isSelected
                        ? 'var(--bg-surface-elevated, #f1f5f9)'
                        : 'transparent',
                      color: 'var(--text-primary)',
                      fontSize: '12.5px',
                      fontWeight: isSelected ? 600 : 400,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f8fafc)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>

                    {isSelected && (
                      <Check size={14} style={{ color: '#0284c7', flexShrink: 0, marginLeft: '8px' }} />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

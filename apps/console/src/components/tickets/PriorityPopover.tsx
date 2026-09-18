import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Check, ChevronDown, X, Loader2, AlertTriangle, ShieldAlert, ArrowUp, Minus, ArrowDown } from 'lucide-react';

export interface PriorityOption {
  value: string;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description?: string;
  icon?: React.ReactNode;
}

export const ALL_PRIORITIES: PriorityOption[] = [
  {
    value: 'CRITICAL',
    label: 'Critical',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.25)',
    description: 'Immediate resolution needed (P1)',
    icon: <ShieldAlert size={14} color="#ef4444" />,
  },
  {
    value: 'URGENT',
    label: 'Urgent',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.12)',
    borderColor: 'rgba(249, 115, 22, 0.25)',
    description: 'High customer impact (P2)',
    icon: <AlertTriangle size={14} color="#f97316" />,
  },
  {
    value: 'HIGH',
    label: 'High',
    color: '#f59e0b',
    bgColor: 'rgba(245, 158, 11, 0.12)',
    borderColor: 'rgba(245, 158, 11, 0.25)',
    description: 'Elevated attention required',
    icon: <ArrowUp size={14} color="#f59e0b" />,
  },
  {
    value: 'NORMAL',
    label: 'Normal',
    color: '#2563eb',
    bgColor: 'rgba(37, 99, 235, 0.12)',
    borderColor: 'rgba(37, 99, 235, 0.25)',
    description: 'Standard support timeline',
    icon: <Minus size={14} color="#2563eb" />,
  },
  {
    value: 'LOW',
    label: 'Low',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.12)',
    borderColor: 'rgba(100, 116, 139, 0.25)',
    description: 'Minor inquiry or non-blocking',
    icon: <ArrowDown size={14} color="#64748b" />,
  },
];

export const getPriorityMeta = (priority: string): PriorityOption => {
  const found = ALL_PRIORITIES.find((p) => p.value === priority?.toUpperCase());
  if (found) return found;
  return {
    value: priority || 'NORMAL',
    label: priority || 'Normal',
    color: '#64748b',
    bgColor: 'rgba(100, 116, 139, 0.12)',
    borderColor: 'rgba(100, 116, 139, 0.25)',
    description: '',
  };
};

interface PriorityPopoverProps {
  priority: string;
  onPriorityChange: (newPriority: string) => Promise<void> | void;
  disabled?: boolean;
  align?: 'left' | 'right';
}

export const PriorityPopover: React.FC<PriorityPopoverProps> = ({
  priority,
  onPriorityChange,
  disabled = false,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentMeta = useMemo(() => getPriorityMeta(priority), [priority]);

  const filteredPriorities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_PRIORITIES;
    return ALL_PRIORITIES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.value.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q))
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

  const handleSelect = async (newPriority: string) => {
    if (newPriority === priority || isUpdating || disabled) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    try {
      await onPriorityChange(newPriority);
      setIsOpen(false);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button (Matching Category and Status Pill Design) */}
      <button
        type="button"
        className="priority-popover-btn"
        disabled={disabled || isUpdating}
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          height: '28px',
          padding: '0 8px',
          backgroundColor: isOpen ? currentMeta.bgColor : 'var(--bg-surface, #ffffff)',
          border: `1px solid ${isOpen ? currentMeta.borderColor : 'var(--border-medium, #e2e8f0)'}`,
          borderRadius: 'var(--radius-md, 6px)',
          color: currentMeta.color,
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
        title={disabled ? undefined : 'Click to change priority'}
      >
        {isUpdating ? (
          <Loader2 size={12} className="animate-spin" style={{ color: currentMeta.color }} />
        ) : (
          <span
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              backgroundColor: currentMeta.color,
              flexShrink: 0,
              boxShadow: `0 0 0 2px ${currentMeta.color}25`,
            }}
          />
        )}
        <span>{currentMeta.label}</span>
        {!disabled && <ChevronDown size={12} style={{ color: 'var(--text-muted)', marginLeft: '1px' }} />}
      </button>

      {/* Searchable Popover Dropdown */}
      {isOpen && !disabled && (
        <div
          className="priority-popover-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            width: '240px',
            maxWidth: 'calc(100vw - 24px)',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-medium, #e2e8f0)',
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
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={13}
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
              placeholder="Search Priority..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '5px 26px 5px 28px',
                fontSize: '12px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '4px',
                backgroundColor: 'var(--bg-app, #f8fafc)',
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
                <X size={12} />
              </button>
            )}
          </div>

          {/* Group Header */}
          <div
            style={{
              padding: '6px 12px 4px',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
              color: 'var(--text-muted)',
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            PRIORITY
          </div>

          {/* Priority Options List */}
          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {filteredPriorities.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                No matching priorities
              </div>
            ) : (
              filteredPriorities.map((item) => {
                const isSelected = item.value === priority?.toUpperCase();
                return (
                  <div
                    key={item.value}
                    onClick={() => handleSelect(item.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? item.bgColor : 'transparent',
                      transition: 'background-color 0.12s ease',
                      gap: '8px',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-hover, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: item.color,
                          flexShrink: 0,
                        }}
                      />
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontSize: '12px',
                            fontWeight: isSelected ? 700 : 500,
                            color: isSelected ? item.color : 'var(--text-primary)',
                            lineHeight: 1.2,
                          }}
                        >
                          {item.label}
                        </div>
                        {item.description && (
                          <div
                            style={{
                              fontSize: '10.5px',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <Check size={14} style={{ color: item.color, flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

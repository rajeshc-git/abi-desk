import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Check, ChevronDown, X, Layers, ShieldCheck, Cpu, Cloud, CheckCircle2, Headphones } from 'lucide-react';

export interface TierOption {
  value: string;
  label: string;
  title: string;
  color: string;
  bgColor: string;
  borderColor: string;
  description: string;
  icon?: React.ReactNode;
}

export const ALL_TIERS: TierOption[] = [
  {
    value: 'L1',
    label: 'Tier L1',
    title: 'L1 Support',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    description: 'First Contact & General Triage',
    icon: <Headphones size={14} color="#1d4ed8" />,
  },
  {
    value: 'L2',
    label: 'Tier L2',
    title: 'L2 Support',
    color: '#6b21a8',
    bgColor: '#f3e8ff',
    borderColor: '#d8b4fe',
    description: 'Senior Technical Investigation',
    icon: <Layers size={14} color="#6b21a8" />,
  },
  {
    value: 'L3',
    label: 'Tier L3',
    title: 'L3 Support',
    color: '#be185d',
    bgColor: '#fce7f3',
    borderColor: '#fbcfe8',
    description: 'Core Engineering & Deep Debugging',
    icon: <ShieldCheck size={14} color="#be185d" />,
  },
  {
    value: 'DEV',
    label: 'Dev Team',
    title: 'DEV',
    color: '#0e7490',
    bgColor: '#ecfeff',
    borderColor: '#a5f3fc',
    description: 'Product Development & Code Fixes',
    icon: <Cpu size={14} color="#0e7490" />,
  },
  {
    value: 'DEVOPS',
    label: 'DevOps / Infra',
    title: 'DEVOPS',
    color: '#d97706',
    bgColor: '#fffbeb',
    borderColor: '#fde68a',
    description: 'Cloud Infrastructure & Reliability',
    icon: <Cloud size={14} color="#d97706" />,
  },
  {
    value: 'QA',
    label: 'QA / Testing',
    title: 'QA',
    color: '#047857',
    bgColor: '#ecfdf5',
    borderColor: '#a7f3d0',
    description: 'Verification & Quality Testing',
    icon: <CheckCircle2 size={14} color="#047857" />,
  },
];

export const getTierMeta = (tier: string): TierOption => {
  const found = ALL_TIERS.find((t) => t.value === tier?.toUpperCase());
  if (found) return found;
  return {
    value: tier || 'L1',
    label: `Tier ${tier || 'L1'}`,
    title: tier || 'L1',
    color: '#1d4ed8',
    bgColor: '#eff6ff',
    borderColor: '#bfdbfe',
    description: 'Support Tier',
  };
};

interface TierPopoverProps {
  tier: string;
  onTierSelect: (newTier: string) => void;
  disabled?: boolean;
  align?: 'left' | 'right';
}

export const TierPopover: React.FC<TierPopoverProps> = ({
  tier,
  onTierSelect,
  disabled = false,
  align = 'left',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const currentMeta = useMemo(() => getTierMeta(tier), [tier]);

  const filteredTiers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return ALL_TIERS;
    return ALL_TIERS.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.value.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
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

  const handleSelect = (selectedTier: string) => {
    if (disabled) return;
    setIsOpen(false);
    if (selectedTier !== tier) {
      onTierSelect(selectedTier);
    }
  };

  return (
    <div style={{ position: 'relative', display: 'inline-block' }} ref={popoverRef}>
      {/* Trigger Button (Matching Category, Priority, and Status Pill Design) */}
      <button
        type="button"
        className="tier-popover-btn"
        disabled={disabled}
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
          cursor: disabled ? 'not-allowed' : 'pointer',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)',
          transition: 'all 0.15s ease-in-out',
          outline: 'none',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
        title={disabled ? undefined : 'Click to transfer or escalate tier'}
      >
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
        <span>Tier: {currentMeta.title}</span>
        {!disabled && <ChevronDown size={12} style={{ color: 'var(--text-muted)', marginLeft: '1px' }} />}
      </button>

      {/* Searchable Popover Dropdown */}
      {isOpen && !disabled && (
        <div
          className="tier-popover-dropdown"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            ...(align === 'right' ? { right: 0, left: 'auto' } : { left: 0, right: 'auto' }),
            width: '260px',
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
              placeholder="Search Tier or Team..."
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
            SUPPORT TIERS & TEAMS
          </div>

          {/* Tier Options List */}
          <div
            style={{
              maxHeight: '270px',
              overflowY: 'auto',
              padding: '4px',
            }}
          >
            {filteredTiers.length === 0 ? (
              <div
                style={{
                  padding: '16px 12px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                }}
              >
                No matching tiers
              </div>
            ) : (
              filteredTiers.map((item) => {
                const isSelected = item.value === tier?.toUpperCase();
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
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span>{item.label}</span>
                          {isSelected && (
                            <span
                              style={{
                                fontSize: '10px',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                backgroundColor: `${item.color}20`,
                                color: item.color,
                                fontWeight: 700,
                              }}
                            >
                              Current
                            </span>
                          )}
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

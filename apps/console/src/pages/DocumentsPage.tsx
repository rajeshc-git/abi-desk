import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileSpreadsheet,
  Download,
  Filter,
  Calendar,
  Building2,
  Tag,
  Folder,
  Layers,
  User,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  RefreshCw,
  Search,
  X,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Check,
  ArrowRight,
  Shield,
  HelpCircle,
  Inbox,
  BarChart3,
  SlidersHorizontal,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Trash2,
} from 'lucide-react';
import { ApiClient } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { LoadingSpinner } from '../components/common/LoadingSpinner';

interface FilterState {
  datePreset:
    | 'all'
    | 'today'
    | 'yesterday'
    | '7days'
    | '14days'
    | '30days'
    | '90days'
    | 'this_week'
    | 'last_week'
    | 'this_month'
    | 'last_month'
    | 'this_quarter'
    | 'this_year'
    | 'custom';
  dateField?: 'createdAt' | 'updatedAt' | 'resolvedAt' | 'closedAt';
  startDate: string;
  endDate: string;
  assignment: 'all' | 'assigned' | 'unassigned' | 'specific';
  assigneeIds: string[];
  teamIds: string[];
  queueIds: string[];
  organization: string; // Single organization filter
  products: string[];
  categories: string[];
  tags: string[];
  channels: string[];
  slaBreach: 'all' | 'breached' | 'within_sla';
  statuses: string[];
  priorities: string[];
  tiers: string[];
}

interface ColumnDef {
  id: string;
  label: string;
  category: 'core' | 'people' | 'classification' | 'metrics' | 'content';
  default: boolean;
}

const AVAILABLE_COLUMNS: ColumnDef[] = [
  // Core Info
  { id: 'key', label: 'Ticket ID / Key', category: 'core', default: true },
  { id: 'subject', label: 'Subject / Title', category: 'core', default: true },
  { id: 'status', label: 'Current Status', category: 'core', default: true },
  { id: 'priority', label: 'Priority Level', category: 'core', default: true },
  { id: 'tier', label: 'Support Tier', category: 'core', default: true },
  { id: 'channel', label: 'Inbound Channel', category: 'core', default: true },

  // People & Teams
  { id: 'requesterName', label: 'Customer Name', category: 'people', default: true },
  { id: 'requesterEmail', label: 'Customer Email', category: 'people', default: true },
  { id: 'assigneeName', label: 'Assigned Agent', category: 'people', default: true },
  { id: 'teamName', label: 'Assigned Team', category: 'people', default: true },

  // Classification & Hierarchy
  { id: 'organization', label: 'Client Organization', category: 'classification', default: true },
  { id: 'product', label: 'Product / Module', category: 'classification', default: true },
  { id: 'category', label: 'Category', category: 'classification', default: true },
  { id: 'subcategory', label: 'Subcategory', category: 'classification', default: false },
  { id: 'tags', label: 'Tags', category: 'classification', default: true },

  // SLA & Timestamps
  { id: 'slaStatus', label: 'SLA Status', category: 'metrics', default: true },
  { id: 'createdAt', label: 'Created Date & Time', category: 'metrics', default: true },
  { id: 'resolvedAt', label: 'Resolved Date & Time', category: 'metrics', default: false },
  { id: 'closedAt', label: 'Closed Date & Time', category: 'metrics', default: false },
  { id: 'firstResponseTime', label: 'First Response (Mins)', category: 'metrics', default: false },
  { id: 'resolutionTime', label: 'Resolution Time (Hours)', category: 'metrics', default: false },

  // Content & Analysis
  { id: 'rootCause', label: 'Root Cause Analysis', category: 'content', default: false },
  { id: 'capaNotes', label: 'CAPA Notes', category: 'content', default: false },
  { id: 'description', label: 'Full Ticket Body / Description', category: 'content', default: false },
];

const ALL_STATUSES = [
  'NEW',
  'TRIAGE',
  'OPEN',
  'PENDING_CUSTOMER',
  'ON_HOLD',
  'ESCALATED_L2',
  'ESCALATED_L3',
  'IN_DEVELOPMENT',
  'IN_QA',
  'PENDING_RELEASE',
  'RELEASED',
  'RESOLVED',
  'CLOSED',
  'CANCELLED',
];

const ALL_PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT', 'CRITICAL'];
const ALL_TIERS = ['L1', 'L2', 'L3', 'DEV', 'DEVOPS', 'QA'];
const ALL_CHANNELS = ['EMAIL', 'PORTAL', 'WIDGET', 'CHAT', 'API', 'PHONE'];

/** UX-Friendly Customized Date Range & Preset Filter Picker */
interface CustomDateFilterPickerProps {
  label: string;
  icon?: React.ReactNode;
  datePreset: FilterState['datePreset'];
  dateField?: FilterState['dateField'];
  startDate: string;
  endDate: string;
  calculatedLabel: string;
  onChange: (updates: {
    datePreset?: FilterState['datePreset'];
    dateField?: FilterState['dateField'];
    startDate?: string;
    endDate?: string;
  }) => void;
  onClear: () => void;
}

const DATE_FIELD_OPTIONS: { id: 'createdAt' | 'updatedAt' | 'resolvedAt' | 'closedAt'; label: string; desc: string }[] = [
  { id: 'createdAt', label: 'Created Date', desc: 'When ticket was submitted' },
  { id: 'updatedAt', label: 'Last Updated', desc: 'When ticket was modified' },
  { id: 'resolvedAt', label: 'Resolved Date', desc: 'When ticket was resolved' },
  { id: 'closedAt', label: 'Closed Date', desc: 'When ticket was closed' },
];

const PRESET_GROUPS = [
  {
    title: 'Quick Look',
    presets: [
      { id: 'all' as const, label: 'All Time' },
      { id: 'today' as const, label: 'Today (Last 24h)' },
      { id: 'yesterday' as const, label: 'Yesterday' },
    ],
  },
  {
    title: 'Rolling Windows',
    presets: [
      { id: '7days' as const, label: 'Last 7 Days' },
      { id: '14days' as const, label: 'Last 14 Days' },
      { id: '30days' as const, label: 'Last 30 Days' },
      { id: '90days' as const, label: 'Last 90 Days' },
    ],
  },
  {
    title: 'Calendar Cycles',
    presets: [
      { id: 'this_week' as const, label: 'This Week' },
      { id: 'last_week' as const, label: 'Last Week' },
      { id: 'this_month' as const, label: 'This Month' },
      { id: 'last_month' as const, label: 'Last Month' },
      { id: 'this_quarter' as const, label: 'This Quarter' },
      { id: 'this_year' as const, label: 'This Year' },
    ],
  },
  {
    title: 'Custom',
    presets: [
      { id: 'custom' as const, label: 'Custom Range...' },
    ],
  },
];

const CustomDateFilterPicker: React.FC<CustomDateFilterPickerProps> = ({
  label,
  icon,
  datePreset,
  dateField = 'createdAt',
  startDate,
  endDate,
  calculatedLabel,
  onChange,
  onClear,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const isFiltered = datePreset !== 'all';
  const pad = (n: number) => String(n).padStart(2, '0');
  const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  // Quick shortcut helper for custom dates
  const setQuickCustom = (type: 'this_month' | 'last_month' | 'ytd' | 'last30' | 'today') => {
    const now = new Date();
    if (type === 'today') {
      const todayStr = toYMD(now);
      onChange({ datePreset: 'custom', startDate: todayStr, endDate: todayStr });
    } else if (type === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      onChange({ datePreset: 'custom', startDate: toYMD(start), endDate: toYMD(now) });
    } else if (type === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      onChange({ datePreset: 'custom', startDate: toYMD(start), endDate: toYMD(end) });
    } else if (type === 'ytd') {
      const start = new Date(now.getFullYear(), 0, 1);
      onChange({ datePreset: 'custom', startDate: toYMD(start), endDate: toYMD(now) });
    } else if (type === 'last30') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      onChange({ datePreset: 'custom', startDate: toYMD(start), endDate: toYMD(now) });
    }
  };

  // Compute days difference for custom
  const customDiffDays = useMemo(() => {
    if (!startDate || !endDate) return null;
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (isNaN(s) || isNaN(e)) return null;
    if (e < s) return -1; // invalid
    const diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return diff;
  }, [startDate, endDate]);

  const activeFieldDef = DATE_FIELD_OPTIONS.find((f) => f.id === dateField) || DATE_FIELD_OPTIONS[0];

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-subtle, #f8fafc)',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {icon || <Calendar size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
          {label}
        </label>
        {isFiltered && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            style={{
              fontSize: '11px',
              color: 'var(--primary, #2563eb)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '36px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: isOpen ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #cbd5e1)',
          borderRadius: '6px',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '6px',
          boxShadow: isOpen ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0, overflow: 'hidden' }}>
          {isFiltered ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                color: 'var(--primary, #2563eb)',
                padding: '2px 7px',
                borderRadius: '4px',
                fontSize: '11.5px',
                fontWeight: 500,
                maxWidth: '100%',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {calculatedLabel}
                {dateField && dateField !== 'createdAt' ? ` [${activeFieldDef.label}]` : ''}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onClear();
                }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8 }}
                title="Clear"
              >
                <X size={12} />
              </span>
            </span>
          ) : (
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
              All Time (Unrestricted)...
            </span>
          )}
        </div>

        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            width: '420px',
            maxWidth: '92vw',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-subtle, #cbd5e1)',
            borderRadius: '10px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.05)',
            zIndex: 120,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Popover Header: Date Field Selection */}
          <div
            style={{
              padding: '12px 14px 10px',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Filter by Timestamp Field
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              {DATE_FIELD_OPTIONS.map((f) => {
                const isSelected = (dateField || 'createdAt') === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => onChange({ dateField: f.id })}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: isSelected ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #cbd5e1)',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface, #ffffff)',
                      color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-secondary)',
                      fontSize: '11.5px',
                      fontWeight: isSelected ? 700 : 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.12s ease',
                    }}
                    title={f.desc}
                  >
                    <Clock size={12} style={{ flexShrink: 0, opacity: isSelected ? 1 : 0.6 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
                    {isSelected && <Check size={12} style={{ marginLeft: 'auto', color: 'var(--primary, #2563eb)' }} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Preset Buttons Grid */}
          <div style={{ padding: '12px 14px', maxHeight: '280px', overflowY: 'auto' }} className="custom-scrollbar">
            {PRESET_GROUPS.map((group) => (
              <div key={group.title} style={{ marginBottom: '10px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: 750, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '5px' }}>
                  {group.title}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(115px, 1fr))', gap: '6px' }}>
                  {group.presets.map((preset) => {
                    const isSelected = datePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          onChange({ datePreset: preset.id });
                          if (preset.id !== 'custom') {
                            setIsOpen(false);
                          }
                        }}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #e2e8f0)',
                          backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.1)' : 'var(--bg-surface, #ffffff)',
                          color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                          fontSize: '11.5px',
                          fontWeight: isSelected ? 700 : 450,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          textAlign: 'left',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f1f5f9)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-surface, #ffffff)';
                        }}
                      >
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {preset.label}
                        </span>
                        {isSelected && <Check size={12} style={{ flexShrink: 0, color: 'var(--primary, #2563eb)' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Custom Date Range Selector Area */}
            {datePreset === 'custom' && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(37, 99, 235, 0.04)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--primary, #2563eb)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Calendar size={13} />
                  Specify Custom Start & End Dates
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                      From Date (00:00)
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => onChange({ datePreset: 'custom', startDate: e.target.value })}
                      className="form-control"
                      style={{ fontSize: '11.5px', padding: '4px 8px', height: '32px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '10.5px', fontWeight: 650, color: 'var(--text-secondary)', display: 'block', marginBottom: '3px' }}>
                      To Date (23:59)
                    </label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => onChange({ datePreset: 'custom', endDate: e.target.value })}
                      className="form-control"
                      style={{ fontSize: '11.5px', padding: '4px 8px', height: '32px' }}
                    />
                  </div>
                </div>

                {/* Quick Date Shortcuts for Custom */}
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px', marginTop: '2px' }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 650 }}>Quick Pick:</span>
                  {[
                    { id: 'today' as const, label: 'Today' },
                    { id: 'last30' as const, label: 'Past 30D' },
                    { id: 'this_month' as const, label: 'This Month' },
                    { id: 'last_month' as const, label: 'Last Month' },
                    { id: 'ytd' as const, label: 'Year-to-Date' },
                  ].map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setQuickCustom(s.id)}
                      style={{
                        fontSize: '10.5px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-subtle, #cbd5e1)',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: 500,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary, #2563eb)')}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle, #cbd5e1)')}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Selected Duration Preview or Validation Error */}
                {customDiffDays !== null && (
                  <div style={{ fontSize: '11px', marginTop: '2px' }}>
                    {customDiffDays === -1 ? (
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>
                        ⚠️ Start date cannot be after end date
                      </span>
                    ) : (
                      <span style={{ color: 'var(--primary, #2563eb)', fontWeight: 600 }}>
                        ✓ {customDiffDays} day{customDiffDays === 1 ? '' : 's'} range selected ({startDate} → {endDate})
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Popover Footer */}
          <div
            style={{
              padding: '10px 14px',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              borderTop: '1px solid var(--border-subtle, #e2e8f0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <button
              type="button"
              onClick={() => {
                onClear();
                setIsOpen(false);
              }}
              style={{
                fontSize: '11.5px',
                color: 'var(--text-secondary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                padding: '4px 8px',
              }}
            >
              Reset to All Time
            </button>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="btn btn-primary"
              style={{
                fontSize: '12px',
                height: '30px',
                padding: '0 14px',
                borderRadius: '6px',
                fontWeight: 650,
              }}
            >
              Apply Filter
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/** Reusable Searchable Single-Select Dropdown for Organization */
interface SearchableSingleSelectProps {
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  options: { value: string; label: string; subLabel?: string }[];
  selectedValue: string;
  onChange: (value: string) => void;
}

const SearchableSingleSelect: React.FC<SearchableSingleSelectProps> = ({
  label,
  icon,
  placeholder = 'All Organizations (Search & select)...',
  options,
  selectedValue,
  onChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || (opt.subLabel && opt.subLabel.toLowerCase().includes(q)),
    );
  }, [options, searchQuery]);

  const selectedOption = options.find((o) => o.value === selectedValue);

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-subtle, #f8fafc)',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {icon}
          {label}
        </label>
        {selectedValue && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              fontSize: '11px',
              color: 'var(--primary, #2563eb)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '36px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: isOpen ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #cbd5e1)',
          borderRadius: '6px',
          padding: '4px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '6px',
          boxShadow: isOpen ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, overflow: 'hidden' }}>
          {selectedOption ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                backgroundColor: 'rgba(37, 99, 235, 0.08)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                color: 'var(--primary, #2563eb)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: 650,
                maxWidth: '100%',
              }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedOption.label}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.8 }}
                title="Clear"
              >
                <X size={12} />
              </span>
            </span>
          ) : (
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{placeholder}</span>
          )}
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-subtle, #cbd5e1)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search bar inside dropdown */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', backgroundColor: 'var(--bg-subtle, #f8fafc)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search organization..."
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  width: '100%',
                  background: 'transparent',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px 0' }}>
            <div
              onClick={() => {
                onChange('');
                setIsOpen(false);
              }}
              style={{
                padding: '7px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: !selectedValue ? 700 : 450,
                backgroundColor: !selectedValue ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                color: !selectedValue ? 'var(--primary, #2563eb)' : 'var(--text-secondary)',
                borderBottom: '1px solid var(--border-subtle, #f1f5f9)',
              }}
            >
              All Organizations (Unrestricted)
            </div>

            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                No matching organization found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValue === opt.value;
                return (
                  <div
                    key={opt.value}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '12px',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                      fontWeight: isSelected ? 700 : 450,
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
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

/** Reusable Searchable Multi-Select Dropdown with removable chips */
interface SearchableMultiSelectProps {
  label: string;
  icon?: React.ReactNode;
  placeholder?: string;
  options: { value: string; label: string; subLabel?: string }[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  maxDisplayChips?: number;
}

const SearchableMultiSelect: React.FC<SearchableMultiSelectProps> = ({
  label,
  icon,
  placeholder = 'Search & select...',
  options,
  selectedValues,
  onChange,
  maxDisplayChips = 3,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase();
    return options.filter(
      (opt) => opt.label.toLowerCase().includes(q) || (opt.subLabel && opt.subLabel.toLowerCase().includes(q)),
    );
  }, [options, searchQuery]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const removeValue = (e: React.MouseEvent, val: string) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== val));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const selectAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(options.map((o) => o.value));
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        backgroundColor: 'var(--bg-subtle, #f8fafc)',
        padding: '12px 14px',
        borderRadius: '8px',
        border: '1px solid var(--border-subtle, #e2e8f0)',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <label
          style={{
            fontSize: '12px',
            fontWeight: 700,
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          {icon}
          {label}
        </label>
        {selectedValues.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            style={{
              fontSize: '11px',
              color: 'var(--primary, #2563eb)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 600,
              padding: 0,
            }}
          >
            Clear ({selectedValues.length})
          </button>
        )}
      </div>

      {/* Trigger Box */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          minHeight: '36px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          border: isOpen ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle, #cbd5e1)',
          borderRadius: '6px',
          padding: '4px 8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          gap: '6px',
          flexWrap: 'wrap',
          boxShadow: isOpen ? '0 0 0 2px rgba(37, 99, 235, 0.15)' : 'none',
          transition: 'all 0.15s ease',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center', flex: 1 }}>
          {selectedValues.length === 0 ? (
            <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{placeholder}</span>
          ) : (
            <>
              {selectedValues.slice(0, maxDisplayChips).map((val) => {
                const opt = options.find((o) => o.value === val);
                const displayLabel = opt ? opt.label : val;
                return (
                  <span
                    key={val}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      backgroundColor: 'rgba(37, 99, 235, 0.08)',
                      border: '1px solid rgba(37, 99, 235, 0.25)',
                      color: 'var(--primary, #2563eb)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayLabel}
                    </span>
                    <span
                      onClick={(e) => removeValue(e, val)}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', opacity: 0.75 }}
                      title="Remove"
                    >
                      <X size={12} />
                    </span>
                  </span>
                );
              })}
              {selectedValues.length > maxDisplayChips && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    color: 'var(--text-secondary)',
                    backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  +{selectedValues.length - maxDisplayChips} more
                </span>
              )}
            </>
          )}
        </div>
        <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-subtle, #cbd5e1)',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            zIndex: 100,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Search bar & Actions inside dropdown */}
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-subtle, #e2e8f0)', backgroundColor: 'var(--bg-subtle, #f8fafc)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '6px', padding: '4px 8px' }}>
              <Search size={14} style={{ color: 'var(--text-muted)' }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                style={{
                  border: 'none',
                  outline: 'none',
                  fontSize: '12px',
                  width: '100%',
                  background: 'transparent',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', padding: '0 2px' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{ fontSize: '11px', color: 'var(--primary, #2563eb)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >
                Select All ({options.length})
              </button>
              {selectedValues.length > 0 && (
                <button
                  type="button"
                  onClick={clearAll}
                  style={{ fontSize: '11px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                >
                  Deselect All
                </button>
              )}
            </div>
          </div>

          {/* Options List */}
          <div style={{ maxHeight: '200px', overflowY: 'auto', padding: '4px 0' }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      fontSize: '12px',
                      backgroundColor: isSelected ? 'rgba(37, 99, 235, 0.06)' : 'transparent',
                      color: isSelected ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                      transition: 'background-color 0.1s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f1f5f9)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                      <span
                        style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '3px',
                          border: isSelected ? '1px solid var(--primary, #2563eb)' : '1px solid #cbd5e1',
                          backgroundColor: isSelected ? 'var(--primary, #2563eb)' : '#ffffff',
                          color: '#ffffff',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '10px',
                          flexShrink: 0,
                        }}
                      >
                        {isSelected && '✓'}
                      </span>
                      <span style={{ fontWeight: isSelected ? 650 : 450, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {opt.label}
                      </span>
                    </div>
                    {opt.subLabel && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '6px', flexShrink: 0 }}>
                        {opt.subLabel}
                      </span>
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


// Helper function for robust CSV parsing (RFC 4180 compliant)
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const cleanText = text.replace(/^\uFEFF/, ''); // Remove UTF-8 BOM if present
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentVal.trim());
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentVal.trim());
      if (currentRow.some((c) => c !== '')) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }

  if (currentVal || currentRow.length > 0) {
    currentRow.push(currentVal.trim());
    if (currentRow.some((c) => c !== '')) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

interface FilterPopoverMultiSelectProps {
  title: string;
  icon?: React.ReactNode;
  options: string[] | { value: string; label: string }[];
  selectedValues: string[];
  onChange: (vals: string[]) => void;
  searchPlaceholder?: string;
}

const FilterPopoverMultiSelect: React.FC<FilterPopoverMultiSelectProps> = ({
  title,
  icon,
  options,
  selectedValues,
  onChange,
  searchPlaceholder = 'Search...',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const normalizedOptions = useMemo(() => {
    return options.map((opt) => (typeof opt === 'string' ? { value: opt, label: opt } : opt));
  }, [options]);

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return normalizedOptions;
    const q = searchQuery.toLowerCase();
    return normalizedOptions.filter(
      (opt) => opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q)
    );
  }, [normalizedOptions, searchQuery]);

  const toggleOption = (val: string) => {
    if (selectedValues.includes(val)) {
      onChange(selectedValues.filter((v) => v !== val));
    } else {
      onChange([...selectedValues, val]);
    }
  };

  const selectAll = () => {
    onChange(normalizedOptions.map((o) => o.value));
  };

  const clearAll = () => {
    onChange([]);
  };

  const isNoneSelected = selectedValues.length === 0;

  return (
    <div style={{ position: 'relative' }} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-secondary"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          height: '38px',
          padding: '0 14px',
          borderRadius: '8px',
          fontSize: '13px',
          fontWeight: 650,
          border: isOpen || selectedValues.length > 0 ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle)',
          backgroundColor: isOpen || selectedValues.length > 0 ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
          color: isOpen || selectedValues.length > 0 ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
          boxShadow: isOpen ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
          transition: 'all 0.15s ease',
          cursor: 'pointer',
          boxSizing: 'border-box',
        }}
      >
        {icon}
        <span>{title}</span>
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            backgroundColor: selectedValues.length > 0 ? 'rgba(37, 99, 235, 0.14)' : 'var(--bg-subtle, #f1f5f9)',
            color: selectedValues.length > 0 ? 'var(--primary, #2563eb)' : 'var(--text-muted)',
            padding: '2px 8px',
            borderRadius: '10px',
            lineHeight: 1.2,
          }}
        >
          {isNoneSelected ? 'All' : `${selectedValues.length}/${normalizedOptions.length}`}
        </span>
        {isOpen ? (
          <ChevronUp size={14} style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }} />
        ) : (
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        )}
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            width: '320px',
            backgroundColor: 'var(--bg-surface, #ffffff)',
            borderRadius: '12px',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.14), 0 6px 16px -2px rgba(0, 0, 0, 0.06)',
            padding: '16px',
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h4
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: 'var(--text-primary)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  margin: 0,
                }}
              >
                {title}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                {isNoneSelected
                  ? `All ${normalizedOptions.length} included`
                  : `${selectedValues.length} of ${normalizedOptions.length} selected`}
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                type="button"
                onClick={selectAll}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'rgba(37, 99, 235, 0.09)',
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  color: 'var(--primary, #2563eb)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                All
              </button>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  padding: '3px 10px',
                  borderRadius: '6px',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  color: 'var(--text-secondary, #475569)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                Clear
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              borderRadius: '8px',
              border: '1.5px solid var(--primary, #2563eb)',
              backgroundColor: 'var(--bg-surface, #ffffff)',
            }}
          >
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                border: 'none',
                outline: 'none',
                backgroundColor: 'transparent',
                fontSize: '12.5px',
                color: 'var(--text-primary)',
                width: '100%',
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  color: 'var(--text-muted)',
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Scrollable Item List */}
          <div
            style={{
              maxHeight: '240px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '5px',
              paddingRight: '2px',
            }}
          >
            {filteredOptions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                No options matching "{searchQuery}"
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt.value);
                return (
                  <div
                    key={opt.value}
                    onClick={() => toggleOption(opt.value)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '8px',
                      backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                      border: isChecked ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'all 0.12s ease',
                      userSelect: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {/* Left Side: Square Checkbox + Label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                      <div
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '4px',
                          backgroundColor: isChecked ? 'var(--primary, #2563eb)' : 'var(--bg-surface, #ffffff)',
                          border: isChecked ? '1.5px solid var(--primary, #2563eb)' : '1.5px solid var(--border-subtle, #cbd5e1)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'all 0.12s',
                        }}
                      >
                        {isChecked && <Check size={12} strokeWidth={3.2} color="#ffffff" />}
                      </div>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isChecked ? 700 : 500,
                          color: isChecked ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {opt.label}
                      </span>
                    </div>

                    {/* Right Side: Circular Check Badge */}
                    <div
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        backgroundColor: isChecked ? 'var(--primary, #2563eb)' : 'transparent',
                        border: isChecked ? '1.5px solid var(--primary, #2563eb)' : '1.5px solid var(--border-subtle, #e2e8f0)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        opacity: isChecked ? 1 : 0.35,
                        transition: 'all 0.12s',
                      }}
                    >
                      {isChecked && <Check size={11} strokeWidth={3.2} color="#ffffff" />}
                    </div>
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

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();

  // Loading States
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(true);
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Metadata lists
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [queues, setQueues] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [productsList, setProductsList] = useState<string[]>([]);

  // Preset Available Counts
  const [presetCounts, setPresetCounts] = useState<{
    today_tickets?: number;
    open_escalated?: number;
    unassigned_tickets?: number;
    this_month_open?: number;
    resolved_month?: number;
  }>({});

  // UI Accordion / Dropdown States
  const [showColumnsCustomizer, setShowColumnsCustomizer] = useState(false);
  const [columnSearchQuery, setColumnSearchQuery] = useState('');
  const columnCustomizerRef = useRef<HTMLDivElement>(null);

  // Close column customizer on click outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        showColumnsCustomizer &&
        columnCustomizerRef.current &&
        !columnCustomizerRef.current.contains(e.target as Node)
      ) {
        setShowColumnsCustomizer(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [showColumnsCustomizer]);

  // Filter State - Defaults to ALL TIME so all tickets are immediately visible!
  const initialFilters: FilterState = {
    datePreset: 'all',
    startDate: '',
    endDate: '',
    assignment: 'all',
    assigneeIds: [],
    teamIds: [],
    queueIds: [],
    organization: '',
    products: [],
    categories: [],
    tags: [],
    channels: [],
    slaBreach: 'all',
    statuses: [],
    priorities: [],
    tiers: [],
  };

  const [filters, setFilters] = useState<FilterState>(initialFilters);

  // Selected Columns State
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    () => new Set(AVAILABLE_COLUMNS.filter((c) => c.default).map((c) => c.id)),
  );

  // Preview Data & Matching Count
  const [totalMatchCount, setTotalMatchCount] = useState<number>(0);
  const [matchedTicketsCache, setMatchedTicketsCache] = useState<any[]>([]);

  // CSV Beautifier & Viewer State
  const [isLoadingViewerData, setIsLoadingViewerData] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<{
    loaded: number;
    total: number;
    percent: number;
    statusText: string;
  } | null>(null);
  const [uploadedCsvData, setUploadedCsvData] = useState<{
    filename: string;
    headers: string[];
    rows: string[][];
    rawText: string;
  } | null>(null);
  const [viewerSearchQuery, setViewerSearchQuery] = useState('');
  const [viewerSortColIndex, setViewerSortColIndex] = useState<number | null>(null);
  const [viewerSortAsc, setViewerSortAsc] = useState(true);
  const [viewerPage, setViewerPage] = useState(1);
  const [viewerPageSize, setViewerPageSize] = useState(25);
  const [isViewerFullscreen, setIsViewerFullscreen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const viewerContainerRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const savedWindowScrollYRef = useRef<number>(0);

  // Toggle fullscreen with exact window scroll position preservation
  const toggleViewerFullscreen = () => {
    if (!isViewerFullscreen) {
      savedWindowScrollYRef.current = window.scrollY || window.pageYOffset || 0;
      setIsViewerFullscreen(true);
    } else {
      setIsViewerFullscreen(false);
      setTimeout(() => {
        if (viewerContainerRef.current) {
          viewerContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          window.scrollTo({ top: savedWindowScrollYRef.current, behavior: 'instant' });
        }
      }, 30);
    }
  };

  // Close fullscreen on Escape key with scroll restoration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isViewerFullscreen) {
        toggleViewerFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isViewerFullscreen]);

  // Keep internal table scroll aligned to top on page change without shifting window scroll
  useEffect(() => {
    if (tableScrollRef.current) {
      tableScrollRef.current.scrollTop = 0;
    }
  }, [viewerPage]);

  // Metadata & Preset Counts fetcher (can be invoked on mount & on manual refresh)
  const fetchMetadataAndCounts = async () => {
    setIsLoadingMetadata(true);
    try {
      const extractList = (res: any): any[] => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (Array.isArray(res.data)) return res.data;
        if (Array.isArray(res.items)) return res.items;
        if (Array.isArray(res.users)) return res.users;
        if (Array.isArray(res.teams)) return res.teams;
        if (Array.isArray(res.products)) return res.products;
        if (Array.isArray(res.tags)) return res.tags;
        if (Array.isArray(res.categories)) return res.categories;
        if (Array.isArray(res.organizations)) return res.organizations;
        return [];
      };

      const [
        orgsRes,
        tagsRes,
        catsRes,
        teamsRes,
        queuesRes,
        usersRes,
        rosterProdsRes,
        prodsRes,
      ] = await Promise.allSettled([
        ApiClient.get('/organizations'),
        ApiClient.get('/tags'),
        ApiClient.get('/categories'),
        ApiClient.get('/admin/teams').catch(() => ApiClient.get('/teams')),
        ApiClient.get('/queues'),
        ApiClient.get('/admin/users').catch(() => ApiClient.get('/users')),
        ApiClient.get('/admin/roster/products'),
        ApiClient.get('/products'),
      ]);

      if (orgsRes.status === 'fulfilled') {
        setOrganizations(extractList(orgsRes.value));
      }

      const productSet = new Set<string>();

      // Products strictly from Shift Roster Products matrix
      if (rosterProdsRes.status === 'fulfilled') {
        const list = extractList(rosterProdsRes.value);
        list.forEach((p: any) => {
          const name = typeof p === 'string' ? p : p.name || p.slug;
          if (name) productSet.add(String(name).trim());
        });
      }

      // Products from /products endpoint
      if (prodsRes.status === 'fulfilled') {
        const list = extractList(prodsRes.value);
        list.forEach((p: any) => {
          const name = typeof p === 'string' ? p : p.name;
          if (name) productSet.add(String(name).trim());
        });
      }

      // Products associated with ticket tags
      if (tagsRes.status === 'fulfilled') {
        const list = extractList(tagsRes.value);
        setTags(list);
        list.forEach((t: any) => {
          if (t.product) productSet.add(String(t.product).trim());
        });
      }

      setProductsList(Array.from(productSet).filter(Boolean).sort((a, b) => a.localeCompare(b)));

      if (catsRes.status === 'fulfilled') {
        setCategories(extractList(catsRes.value));
      }
      if (teamsRes.status === 'fulfilled') {
        setTeams(extractList(teamsRes.value));
      }
      if (queuesRes.status === 'fulfilled') {
        setQueues(extractList(queuesRes.value));
      }
      if (usersRes.status === 'fulfilled') {
        const rawUsers = extractList(usersRes.value);
        // Strictly filter ONLY actual internal staff members (exclude guests, external customers & system bots)
        const staffOnly = rawUsers.filter((u: any) => {
          if (u.kind === 'STAFF') return true;
          if (u.kind === 'CUSTOMER' || u.kind === 'SYSTEM' || u.kind === 'GUEST') return false;
          if (Array.isArray(u.roles) && u.roles.length > 0) {
            return u.roles.some((r: any) => {
              const roleKey = typeof r === 'string' ? r : r.role?.key;
              return roleKey && roleKey !== 'CUSTOMER' && roleKey !== 'GUEST';
            });
          }
          return false;
        });
        setUsersList(staffOnly);
      }

      // Fetch counts for the 5 presets
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const [p1, p2, p3, p4, p5] = await Promise.allSettled([
        ApiClient.get(`/tickets?pageSize=1&createdAfter=${todayStr}T00:00:00.000Z`),
        ApiClient.get(`/tickets?pageSize=1&status=OPEN,TRIAGE,ESCALATED_L2,ESCALATED_L3,IN_DEVELOPMENT,IN_QA`),
        ApiClient.get(`/tickets?pageSize=1&unassigned=true`),
        ApiClient.get(`/tickets?pageSize=1&status=NEW,OPEN,TRIAGE&createdAfter=${monthStart}`),
        ApiClient.get(`/tickets?pageSize=1&status=RESOLVED,CLOSED&createdAfter=${monthStart}`),
      ]);

      setPresetCounts({
        today_tickets: p1.status === 'fulfilled' ? (p1.value?.total ?? (p1.value?.tickets?.length || 0)) : undefined,
        open_escalated: p2.status === 'fulfilled' ? (p2.value?.total ?? (p2.value?.tickets?.length || 0)) : undefined,
        unassigned_tickets: p3.status === 'fulfilled' ? (p3.value?.total ?? (p3.value?.tickets?.length || 0)) : undefined,
        this_month_open: p4.status === 'fulfilled' ? (p4.value?.total ?? (p4.value?.tickets?.length || 0)) : undefined,
        resolved_month: p5.status === 'fulfilled' ? (p5.value?.total ?? (p5.value?.tickets?.length || 0)) : undefined,
      });
    } catch (err: any) {
      console.error('Failed to load document metadata', err);
    } finally {
      setIsLoadingMetadata(false);
    }
  };

  // Initial metadata fetch on mount
  useEffect(() => {
    fetchMetadataAndCounts();
  }, []);

  // Compute calculated Date Range from preset & field
  const calculatedDates = useMemo(() => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const formatFriendly = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const fieldLabels: Record<string, string> = {
      createdAt: 'Created',
      updatedAt: 'Updated',
      resolvedAt: 'Resolved',
      closedAt: 'Closed',
    };
    const fieldName = fieldLabels[filters.dateField || 'createdAt'] || 'Created';

    if (filters.datePreset === 'all') {
      return { start: undefined, end: undefined, label: 'All Time', fieldName };
    }
    if (filters.datePreset === 'today') {
      const todayStr = toYMD(now);
      return {
        start: `${todayStr}T00:00:00.000Z`,
        end: `${todayStr}T23:59:59.999Z`,
        label: `Today (${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(yest.getDate() - 1);
      const yestStr = toYMD(yest);
      return {
        start: `${yestStr}T00:00:00.000Z`,
        end: `${yestStr}T23:59:59.999Z`,
        label: `Yesterday (${formatFriendly(yest)})`,
        fieldName,
      };
    }
    if (filters.datePreset === '7days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 7);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `Last 7 Days (${formatFriendly(start)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === '14days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 14);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `Last 14 Days (${formatFriendly(start)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === '30days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 30);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `Last 30 Days (${formatFriendly(start)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === '90days') {
      const start = new Date(now);
      start.setDate(start.getDate() - 90);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `Last 90 Days (${formatFriendly(start)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'this_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      return {
        start: monday.toISOString(),
        end: now.toISOString(),
        label: `This Week (${formatFriendly(monday)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'last_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const monday = new Date(now.getFullYear(), now.getMonth(), diff, 0, 0, 0, 0);
      const sunday = new Date(now.getFullYear(), now.getMonth(), diff + 6, 23, 59, 59, 999);
      return {
        start: monday.toISOString(),
        end: sunday.toISOString(),
        label: `Last Week (${formatFriendly(monday)} – ${formatFriendly(sunday)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'this_month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `This Month (${formatFriendly(start)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return {
        start: start.toISOString(),
        end: end.toISOString(),
        label: `Last Month (${formatFriendly(start)} – ${formatFriendly(end)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'this_quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1, 0, 0, 0, 0);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `This Quarter (Q${quarter + 1}: ${formatFriendly(start)} – ${formatFriendly(now)})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'this_year') {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return {
        start: start.toISOString(),
        end: now.toISOString(),
        label: `This Year (${start.getFullYear()})`,
        fieldName,
      };
    }
    if (filters.datePreset === 'custom') {
      const s = filters.startDate ? `${filters.startDate}T00:00:00.000Z` : undefined;
      const e = filters.endDate ? `${filters.endDate}T23:59:59.999Z` : undefined;
      const sDisp = filters.startDate ? formatFriendly(new Date(`${filters.startDate}T00:00:00`)) : 'Start';
      const eDisp = filters.endDate ? formatFriendly(new Date(`${filters.endDate}T00:00:00`)) : 'End';
      return {
        start: s,
        end: e,
        label: `Custom (${sDisp} → ${eDisp})`,
        fieldName,
      };
    }
    return { start: undefined, end: undefined, label: 'All Time (Unrestricted)', fieldName };
  }, [filters.datePreset, filters.dateField, filters.startDate, filters.endDate]);

  // Active Filter Summary Chips
  const activeFilterChips = useMemo(() => {
    const chips: { id: string; label: string; onRemove: () => void }[] = [];

    if (filters.datePreset !== 'all') {
      chips.push({
        id: 'date',
        label: `📅 ${calculatedDates.fieldName}: ${calculatedDates.label}`,
        onRemove: () =>
          setFilters((p) => ({
            ...p,
            datePreset: 'all',
            startDate: '',
            endDate: '',
            dateField: 'createdAt',
          })),
      });
    }

    if (filters.assignment === 'unassigned') {
      chips.push({
        id: 'unassigned',
        label: '👤 Unassigned Only',
        onRemove: () => setFilters((p) => ({ ...p, assignment: 'all' })),
      });
    } else if (filters.assignment === 'assigned') {
      chips.push({
        id: 'assigned',
        label: '👤 Assigned Only',
        onRemove: () => setFilters((p) => ({ ...p, assignment: 'all' })),
      });
    }

    if (filters.assigneeIds.length > 0) {
      chips.push({
        id: 'assignees',
        label: `👤 Agents (${filters.assigneeIds.length})`,
        onRemove: () => setFilters((p) => ({ ...p, assigneeIds: [] })),
      });
    }

    if (filters.teamIds.length > 0) {
      chips.push({
        id: 'teams',
        label: `👥 Teams (${filters.teamIds.length})`,
        onRemove: () => setFilters((p) => ({ ...p, teamIds: [] })),
      });
    }

    if (filters.queueIds.length > 0) {
      chips.push({
        id: 'queues',
        label: `📬 Queues (${filters.queueIds.length})`,
        onRemove: () => setFilters((p) => ({ ...p, queueIds: [] })),
      });
    }

    if (filters.organization) {
      chips.push({
        id: 'org',
        label: `🏢 Client: ${filters.organization}`,
        onRemove: () => setFilters((p) => ({ ...p, organization: '' })),
      });
    }

    if (filters.products.length > 0) {
      chips.push({
        id: 'prods',
        label: `📦 Products (${filters.products.length})`,
        onRemove: () => setFilters((p) => ({ ...p, products: [] })),
      });
    }

    if (filters.categories.length > 0) {
      chips.push({
        id: 'cats',
        label: `🏷️ Categories (${filters.categories.length})`,
        onRemove: () => setFilters((p) => ({ ...p, categories: [] })),
      });
    }

    if (filters.tags.length > 0) {
      chips.push({
        id: 'tags',
        label: `🔖 Tags (${filters.tags.length})`,
        onRemove: () => setFilters((p) => ({ ...p, tags: [] })),
      });
    }

    if (filters.channels.length > 0) {
      chips.push({
        id: 'channels',
        label: `📡 Channels (${filters.channels.length})`,
        onRemove: () => setFilters((p) => ({ ...p, channels: [] })),
      });
    }

    if (filters.slaBreach === 'breached') {
      chips.push({
        id: 'sla',
        label: '⚠️ SLA Breached Only',
        onRemove: () => setFilters((p) => ({ ...p, slaBreach: 'all' })),
      });
    } else if (filters.slaBreach === 'within_sla') {
      chips.push({
        id: 'sla',
        label: '🛡️ Within SLA Target',
        onRemove: () => setFilters((p) => ({ ...p, slaBreach: 'all' })),
      });
    }

    if (filters.statuses.length > 0) {
      chips.push({
        id: 'status',
        label: `📌 Statuses (${filters.statuses.length})`,
        onRemove: () => setFilters((p) => ({ ...p, statuses: [] })),
      });
    }

    if (filters.priorities.length > 0) {
      chips.push({
        id: 'priority',
        label: `🔥 Priorities (${filters.priorities.length})`,
        onRemove: () => setFilters((p) => ({ ...p, priorities: [] })),
      });
    }

    if (filters.tiers.length > 0) {
      chips.push({
        id: 'tier',
        label: `🛡️ Tiers (${filters.tiers.length})`,
        onRemove: () => setFilters((p) => ({ ...p, tiers: [] })),
      });
    }

    return chips;
  }, [filters, calculatedDates]);

  // Client-side ticket filter evaluator for multi-criteria
  const filterTicketMatches = (ticket: any, f: FilterState, dates: { start?: string; end?: string }) => {
    // 1. Date range check on selected date field (default: createdAt)
    if (dates.start || dates.end) {
      const fieldKey = f.dateField || 'createdAt';
      const rawVal = ticket[fieldKey];
      if (!rawVal) return false;
      const tTime = new Date(rawVal).getTime();
      if (isNaN(tTime)) return false;
      if (dates.start && tTime < new Date(dates.start).getTime()) return false;
      if (dates.end && tTime > new Date(dates.end).getTime()) return false;
    }

    // 2. Status
    if (f.statuses.length > 0 && !f.statuses.includes(ticket.status)) return false;

    // 3. Priority
    if (f.priorities.length > 0 && !f.priorities.includes(ticket.priority)) return false;

    // 4. Tier
    if (f.tiers.length > 0 && !f.tiers.includes(ticket.tier)) return false;

    // 5. Channel
    if (f.channels.length > 0 && !f.channels.includes(ticket.channel)) return false;

    // 6. Assignment
    if (f.assignment === 'unassigned' && ticket.assigneeId) return false;
    if (f.assignment === 'assigned' && !ticket.assigneeId) return false;
    if (f.assigneeIds.length > 0 && (!ticket.assigneeId || !f.assigneeIds.includes(ticket.assigneeId))) return false;

    // 7. Team & Queue
    if (f.teamIds.length > 0 && (!ticket.teamId || !f.teamIds.includes(ticket.teamId))) return false;
    if (f.queueIds.length > 0 && (!ticket.queueId || !f.queueIds.includes(ticket.queueId))) return false;

    // 8. Organization (single selection check)
    if (f.organization) {
      const orgName = ticket.organization || ticket.customFields?.organization || '';
      if (!orgName.toLowerCase().includes(f.organization.toLowerCase())) return false;
    }

    // 9. Product
    if (f.products.length > 0) {
      const prodName = ticket.product || ticket.customFields?.product || '';
      if (!f.products.some((pr) => prodName.toLowerCase().includes(pr.toLowerCase()))) return false;
    }

    // 10. Category
    if (f.categories.length > 0) {
      const catName = ticket.category || '';
      if (!f.categories.some((cat) => catName.toLowerCase().includes(cat.toLowerCase()))) return false;
    }

    // 11. Tags
    if (f.tags.length > 0) {
      const ticketTags: string[] = Array.isArray(ticket.tags)
        ? ticket.tags.map((t: any) => (typeof t === 'string' ? t : t.name || t.tag?.name || ''))
        : typeof ticket.tags === 'string'
          ? [ticket.tags]
          : [];
      if (!f.tags.some((tag) => ticketTags.some((tt) => tt.toLowerCase().includes(tag.toLowerCase())))) return false;
    }

    // 12. SLA
    if (f.slaBreach === 'breached' && !ticket.isBreached && !ticket.slaBreached) return false;
    if (f.slaBreach === 'within_sla' && (ticket.isBreached || ticket.slaBreached)) return false;

    return true;
  };

  // Fetch Preview tickets and live matching count
  const loadPreview = async () => {
    setIsFetchingPreview(true);
    try {
      const params = new URLSearchParams();
      params.set('pageSize', '50');
      params.set('page', '1');

      if (calculatedDates.start) params.set('createdAfter', calculatedDates.start);
      if (calculatedDates.end) params.set('createdBefore', calculatedDates.end);
      if (filters.statuses.length > 0) params.set('status', filters.statuses.join(','));
      if (filters.priorities.length > 0) params.set('priority', filters.priorities.join(','));
      if (filters.tiers.length > 0) params.set('tier', filters.tiers.join(','));
      if (filters.channels.length === 1) params.set('channel', filters.channels[0]);
      if (filters.assignment === 'unassigned') params.set('unassigned', 'true');
      else if (filters.assigneeIds.length === 1) params.set('assigneeId', filters.assigneeIds[0]);
      if (filters.teamIds.length === 1) params.set('teamId', filters.teamIds[0]);
      if (filters.queueIds.length === 1) params.set('queueId', filters.queueIds[0]);
      if (filters.organization) params.set('organization', filters.organization);
      if (filters.products.length === 1) params.set('product', filters.products[0]);
      if (filters.categories.length === 1) params.set('category', filters.categories[0]);
      if (filters.tags.length === 1) params.set('tag', filters.tags[0]);
      if (filters.slaBreach === 'breached') params.set('breached', 'true');

      const res = await ApiClient.get(`/tickets?${params.toString()}`);
      // Robustly extract tickets list regardless of response structure
      const rawList = res?.tickets || res?.items || res?.data || (Array.isArray(res) ? res : []);
      const matched = rawList.filter((t: any) => filterTicketMatches(t, filters, calculatedDates));

      const totalCount = typeof res?.total === 'number' ? res.total : matched.length;

      setMatchedTicketsCache(matched);
      setTotalMatchCount(totalCount);
    } catch (err: any) {
      console.error('Failed to load preview tickets', err);
    } finally {
      setIsFetchingPreview(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPreview();
    }, 150);
    return () => clearTimeout(timer);
  }, [filters, calculatedDates]);

  // Handle Multi-Select Toggle
  const toggleStatus = (st: string) => {
    setFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(st)
        ? prev.statuses.filter((s) => s !== st)
        : [...prev.statuses, st],
    }));
  };

  const togglePriority = (pr: string) => {
    setFilters((prev) => ({
      ...prev,
      priorities: prev.priorities.includes(pr)
        ? prev.priorities.filter((p) => p !== pr)
        : [...prev.priorities, pr],
    }));
  };

  const toggleTier = (tr: string) => {
    setFilters((prev) => ({
      ...prev,
      tiers: prev.tiers.includes(tr) ? prev.tiers.filter((t) => t !== tr) : [...prev.tiers, tr],
    }));
  };

  const toggleColumn = (colId: string) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(colId)) {
        if (next.size > 1) next.delete(colId);
        else toast.warning('You must select at least one column for export');
      } else {
        next.add(colId);
      }
      return next;
    });
  };

  const selectAllColumns = () => {
    setSelectedColumns(new Set(AVAILABLE_COLUMNS.map((c) => c.id)));
  };

  const clearAllColumns = () => {
    setSelectedColumns(new Set());
  };

  const resetDefaultColumns = () => {
    setSelectedColumns(new Set(AVAILABLE_COLUMNS.filter((c) => c.default).map((c) => c.id)));
  };

  const selectMinimalColumns = () => {
    setSelectedColumns(new Set(['key', 'subject', 'status', 'priority', 'requesterName', 'assigneeName', 'createdAt']));
  };

  const resetAllFilters = () => {
    setFilters(initialFilters);
    toast.info('All filters have been reset');
  };

  // Refresh All Data (Metadata, Presets, and Preview)
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await Promise.allSettled([
        fetchMetadataAndCounts(),
        loadPreview(),
      ]);
      toast.success('Real-time data refreshed');
    } catch (err: any) {
      toast.error('Failed to refresh data');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Helper to build column value
  const getTicketColumnValue = (t: any, colId: string): string => {
    switch (colId) {
      case 'key':
        return t.key || t.number || t.id;
      case 'subject':
        return t.subject || '';
      case 'status':
        return t.status || '';
      case 'priority':
        return t.priority || '';
      case 'tier':
        return t.tier || '';
      case 'channel':
        return t.channel || '';
      case 'requesterName':
        return t.requester?.name || t.customer?.name || t.requesterName || '';
      case 'requesterEmail':
        return t.requester?.email || t.customer?.email || t.requesterEmail || '';
      case 'assigneeName': {
        if (t.assignee?.fullName) return t.assignee.fullName;
        if (t.assignee?.displayName) return t.assignee.displayName;
        if (t.assignee?.name) return t.assignee.name;
        if (t.assignee?.email) return t.assignee.email;
        if (t.assigneeId) {
          const found = usersList.find((u: any) => u.id === t.assigneeId);
          if (found) return found.fullName || found.displayName || found.name || found.email || 'Assigned';
          return 'Assigned';
        }
        return 'Unassigned';
      }
      case 'teamName': {
        if (t.team?.name) return t.team.name;
        if (t.teamId) {
          const found = teams.find((tm: any) => tm.id === t.teamId);
          if (found) return found.name || (found.tier ? `${found.tier} Support Team` : 'Support Team');
          return t.teamId;
        }
        return '';
      }
      case 'organization':
        return t.organization || t.customFields?.organization || '';
      case 'product':
        return t.product || t.customFields?.product || '';
      case 'category':
        return t.category || '';
      case 'subcategory':
        return t.subcategory || '';
      case 'tags':
        return Array.isArray(t.tags)
          ? t.tags.map((tg: any) => (typeof tg === 'string' ? tg : tg.name || tg.tag?.name || '')).join('; ')
          : typeof t.tags === 'string'
            ? t.tags
            : '';
      case 'slaStatus':
        return t.isBreached || t.slaBreached ? 'BREACHED' : t.slaPolicy?.name || 'WITHIN_SLA';
      case 'createdAt':
        return t.createdAt ? new Date(t.createdAt).toLocaleString() : '';
      case 'resolvedAt':
        return t.resolvedAt ? new Date(t.resolvedAt).toLocaleString() : '';
      case 'closedAt':
        return t.closedAt ? new Date(t.closedAt).toLocaleString() : '';
      case 'firstResponseTime':
        return t.firstResponseTimeMinutes ? `${t.firstResponseTimeMinutes} mins` : '';
      case 'resolutionTime':
        return t.resolutionTimeHours ? `${t.resolutionTimeHours} hrs` : '';
      case 'rootCause':
        return t.rootCause || '';
      case 'capaNotes':
        return t.capaNotes || '';
      case 'description':
        return t.description ? t.description.replace(/<[^>]*>?/gm, '').replace(/[\r\n]+/g, ' ') : '';
      default:
        return String(t[colId] || '');
    }
  };

  // High-performance parallel chunked fetcher (optimizes up to 50k records with zero UI lag)
  const fetchAllMatchingRecords = async (
    customParams?: Record<string, string>,
    onProgress?: (progress: { loaded: number; total: number; percent: number; statusText: string }) => void,
  ) => {
    const baseParams = new URLSearchParams();
    baseParams.set('pageSize', '100');

    if (customParams) {
      Object.entries(customParams).forEach(([k, v]) => {
        if (v) baseParams.set(k, v);
      });
    } else {
      if (calculatedDates.start) baseParams.set('createdAfter', calculatedDates.start);
      if (calculatedDates.end) baseParams.set('createdBefore', calculatedDates.end);
      if (filters.statuses.length > 0) baseParams.set('status', filters.statuses.join(','));
      if (filters.priorities.length > 0) baseParams.set('priority', filters.priorities.join(','));
      if (filters.tiers.length > 0) baseParams.set('tier', filters.tiers.join(','));
      if (filters.channels.length === 1) baseParams.set('channel', filters.channels[0]);
      if (filters.assignment === 'unassigned') baseParams.set('unassigned', 'true');
      else if (filters.assigneeIds.length === 1) baseParams.set('assigneeId', filters.assigneeIds[0]);
      if (filters.teamIds.length === 1) baseParams.set('teamId', filters.teamIds[0]);
      if (filters.queueIds.length === 1) baseParams.set('queueId', filters.queueIds[0]);
      if (filters.organization) baseParams.set('organization', filters.organization);
      if (filters.products.length === 1) baseParams.set('product', filters.products[0]);
      if (filters.categories.length === 1) baseParams.set('category', filters.categories[0]);
      if (filters.tags.length === 1) baseParams.set('tag', filters.tags[0]);
      if (filters.slaBreach === 'breached') baseParams.set('breached', 'true');
    }

    // Step 1: Fast initial request to get Page 1 and total count
    const p1Params = new URLSearchParams(baseParams);
    p1Params.set('page', '1');
    const firstRes = await ApiClient.get(`/tickets?${p1Params.toString()}`);
    const firstItems = firstRes?.tickets || firstRes?.items || firstRes?.data || (Array.isArray(firstRes) ? firstRes : []);
    const totalRecords = typeof firstRes?.total === 'number' ? firstRes.total : firstItems.length;
    const totalPages = Math.min(500, Math.ceil(totalRecords / 100)); // Supports up to 50,000 records

    if (totalPages <= 1 || firstItems.length === 0) {
      if (onProgress) {
        onProgress({ loaded: firstItems.length, total: totalRecords, percent: 100, statusText: 'Ready' });
      }
      return customParams
        ? firstItems
        : firstItems.filter((t: any) => filterTicketMatches(t, filters, calculatedDates));
    }

    let allRawRecords: any[] = [...firstItems];
    let loadedCount = firstItems.length;

    if (onProgress) {
      onProgress({
        loaded: loadedCount,
        total: totalRecords,
        percent: Math.min(99, Math.round((loadedCount / totalRecords) * 100)),
        statusText: `Fetched ${loadedCount.toLocaleString()} of ${totalRecords.toLocaleString()} records...`,
      });
    }

    // Step 2: Parallel batch retrieval (8 concurrent lanes for instant ~300ms loading)
    const remainingPages: number[] = [];
    for (let p = 2; p <= totalPages; p++) {
      remainingPages.push(p);
    }

    const CONCURRENCY = 8;
    for (let i = 0; i < remainingPages.length; i += CONCURRENCY) {
      const batch = remainingPages.slice(i, i + CONCURRENCY);
      const batchPromises = batch.map(async (pageNum) => {
        const pageParams = new URLSearchParams(baseParams);
        pageParams.set('page', String(pageNum));
        const res = await ApiClient.get(`/tickets?${pageParams.toString()}`);
        return res?.tickets || res?.items || res?.data || (Array.isArray(res) ? res : []);
      });

      const batchResults = await Promise.all(batchPromises);
      for (const items of batchResults) {
        allRawRecords.push(...items);
        loadedCount += items.length;
      }

      if (onProgress) {
        onProgress({
          loaded: loadedCount,
          total: totalRecords,
          percent: Math.min(99, Math.round((loadedCount / totalRecords) * 100)),
          statusText: `Loaded ${loadedCount.toLocaleString()} of ${totalRecords.toLocaleString()} records (${Math.round((loadedCount / totalRecords) * 100)}%)...`,
        });
      }

      // Non-blocking yield to keep browser rendering at 60fps
      await new Promise((r) => setTimeout(r, 0));
    }

    if (onProgress) {
      onProgress({
        loaded: allRawRecords.length,
        total: totalRecords,
        percent: 100,
        statusText: 'Processing and indexing records...',
      });
    }

    // Filter defensively for multi-selection criteria if needed
    return customParams
      ? allRawRecords
      : allRawRecords.filter((t: any) => filterTicketMatches(t, filters, calculatedDates));
  };

  // CSV Generation Function with UTF-8 BOM
  const generateAndDownload = async (
    customParams?: Record<string, string>,
    filenamePrefix = 'tickets-consolidated-report',
  ) => {
    setIsExporting(true);
    try {
      const allRecords = await fetchAllMatchingRecords(customParams);

      if (allRecords.length === 0) {
        toast.warning('No tickets match the selected filter criteria');
        return;
      }

      const activeCols = AVAILABLE_COLUMNS.filter((c) => selectedColumns.has(c.id));
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate())}`;

      // Build CSV with UTF-8 BOM
      const headers = activeCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');
      const rows = allRecords.map((t: any) => {
        return activeCols
          .map((c) => {
            const val = getTicketColumnValue(t, c.id);
            return `"${String(val).replace(/"/g, '""')}"`;
          })
          .join(',');
      });

      const csvContent = '\uFEFF' + [headers, ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const generatedFilename = `${filenamePrefix}-${dateStr}.csv`;
      link.setAttribute('download', generatedFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      // Also automatically load into the CSV Beautifier & Viewer for instant inspection!
      const parsed = parseCSV(csvContent);
      setUploadedCsvData({
        filename: generatedFilename,
        headers: parsed.headers,
        rows: parsed.rows,
        rawText: csvContent,
      });
      setViewerPage(1);

      toast.success(`Exported ${allRecords.length.toLocaleString()} records to CSV and loaded into CSV Viewer!`);
    } catch (err: any) {
      console.error('Export failed', err);
      toast.error(err.message || 'Failed to generate report export');
    } finally {
      setIsExporting(false);
    }
  };

  // Quick 1-Click Administrative Pre-packaged Reports
  const handleQuickExport = (type: string) => {
    switch (type) {
      case 'today_tickets':
        generateAndDownload({ createdAfter: `${new Date().toISOString().split('T')[0]}T00:00:00.000Z` }, 'todays-tickets');
        break;
      case 'open_escalated':
        generateAndDownload({ status: 'OPEN,TRIAGE,ESCALATED_L2,ESCALATED_L3,IN_DEVELOPMENT,IN_QA' }, 'open-escalated-tickets');
        break;
      case 'unassigned_tickets':
        generateAndDownload({ unassigned: 'true' }, 'unassigned-tickets-report');
        break;
      case 'this_month_open': {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        generateAndDownload({ status: 'NEW,OPEN,TRIAGE', createdAfter: start }, 'this-month-open-tickets');
        break;
      }
      case 'resolved_month': {
        const d = new Date();
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        generateAndDownload({ status: 'RESOLVED,CLOSED', createdAfter: start }, 'resolved-tickets-this-month');
        break;
      }
      default:
        generateAndDownload();
    }
  };

  // Handle CSV File Upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = parseCSV(text);
        if (parsed.headers.length === 0) {
          toast.warning('The uploaded CSV file is empty');
          return;
        }
        setUploadedCsvData({
          filename: file.name,
          headers: parsed.headers,
          rows: parsed.rows,
          rawText: text,
        });
        setViewerPage(1);
        setViewerSearchQuery('');
        toast.success(`Successfully loaded and beautified "${file.name}" (${parsed.rows.length.toLocaleString()} rows, ${parsed.headers.length} columns)`);
      } catch (err: any) {
        toast.error('Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Load currently filtered records directly into CSV Beautifier (fetching all pages with high-speed parallel lanes)
  const handleLoadCurrentPermutationIntoViewer = async () => {
    if (totalMatchCount === 0 && matchedTicketsCache.length === 0) {
      toast.warning('No tickets match current filters to display');
      return;
    }

    setIsLoadingViewerData(true);
    setLoadingProgress({
      loaded: 0,
      total: totalMatchCount || 50,
      percent: 5,
      statusText: 'Connecting to high-speed data stream...',
    });

    try {
      let records: any[] = [];
      if (totalMatchCount <= matchedTicketsCache.length && matchedTicketsCache.length > 0) {
        records = matchedTicketsCache;
      } else {
        records = await fetchAllMatchingRecords(undefined, (prog) => {
          setLoadingProgress(prog);
        });
      }

      if (records.length === 0) {
        toast.warning('No tickets match current filters');
        return;
      }

      setLoadingProgress({
        loaded: records.length,
        total: records.length,
        percent: 98,
        statusText: 'Formatting columns and indexing records...',
      });
      // Non-blocking yield
      await new Promise((r) => setTimeout(r, 10));

      const activeCols = AVAILABLE_COLUMNS.filter((c) => selectedColumns.has(c.id));
      const headers = activeCols.map((c) => c.label);
      const rows = records.map((t) => activeCols.map((c) => getTicketColumnValue(t, c.id)));
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate())}`;

      const rawCsvRows = rows.map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','));
      const rawCsvText = headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(',') + '\r\n' + rawCsvRows.join('\r\n');

      setUploadedCsvData({
        filename: `current-permutation-preview-${dateStr}.csv`,
        headers,
        rows,
        rawText: rawCsvText,
      });
      setViewerPage(1);
      setViewerSearchQuery('');
      toast.success(`Loaded all ${rows.length.toLocaleString()} filtered ticket records into CSV Beautifier!`);
    } catch (err: any) {
      console.error('Failed to load tickets into viewer', err);
      toast.error('Failed to load tickets into CSV viewer');
    } finally {
      setIsLoadingViewerData(false);
      setLoadingProgress(null);
    }
  };

  // Copy CSV to Clipboard
  const handleCopyToClipboard = () => {
    if (!uploadedCsvData) return;
    navigator.clipboard.writeText(uploadedCsvData.rawText);
    toast.success('CSV content copied to clipboard!');
  };

  // Filtered and Sorted CSV Rows for Viewer
  const filteredAndSortedViewerRows = useMemo(() => {
    if (!uploadedCsvData) return [];
    let rows = [...uploadedCsvData.rows];

    // Search filter across all columns
    if (viewerSearchQuery.trim()) {
      const q = viewerSearchQuery.toLowerCase();
      rows = rows.filter((r) => r.some((cell) => cell.toLowerCase().includes(q)));
    }

    // Sorting
    if (viewerSortColIndex !== null) {
      const idx = viewerSortColIndex;
      rows.sort((a, b) => {
        const valA = (a[idx] || '').toLowerCase();
        const valB = (b[idx] || '').toLowerCase();
        const numA = Number(valA);
        const numB = Number(valB);

        if (!isNaN(numA) && !isNaN(numB)) {
          return viewerSortAsc ? numA - numB : numB - numA;
        }
        return viewerSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      });
    }

    return rows;
  }, [uploadedCsvData, viewerSearchQuery, viewerSortColIndex, viewerSortAsc]);

  // Paginated Viewer Rows
  const paginatedViewerRows = useMemo(() => {
    const start = (viewerPage - 1) * viewerPageSize;
    return filteredAndSortedViewerRows.slice(start, start + viewerPageSize);
  }, [filteredAndSortedViewerRows, viewerPage, viewerPageSize]);

  const totalViewerPages = Math.ceil(filteredAndSortedViewerRows.length / viewerPageSize) || 1;

  // Render Cell with Smart Styling
  const renderBeautifiedCell = (val: string, header: string) => {
    const lowerHeader = header.toLowerCase();
    const upperVal = val.toUpperCase();

    // Status Styling
    if (lowerHeader.includes('status') || ['NEW', 'OPEN', 'RESOLVED', 'CLOSED', 'TRIAGE', 'IN_QA', 'ON_HOLD', 'CANCELLED'].includes(upperVal)) {
      if (upperVal === 'RESOLVED' || upperVal === 'CLOSED') {
        return (
          <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', padding: '2px 8px', borderRadius: '12px' }}>
            {val}
          </span>
        );
      }
      if (upperVal === 'NEW' || upperVal === 'OPEN' || upperVal === 'TRIAGE') {
        return (
          <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(59, 130, 246, 0.12)', color: '#2563eb', padding: '2px 8px', borderRadius: '12px' }}>
            {val}
          </span>
        );
      }
      if (upperVal.includes('ESCALAT') || upperVal === 'ON_HOLD') {
        return (
          <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '2px 8px', borderRadius: '12px' }}>
            {val}
          </span>
        );
      }
    }

    // Priority Styling
    if (lowerHeader.includes('priority')) {
      if (upperVal === 'CRITICAL' || upperVal === 'URGENT') {
        return (
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444' }}>
            🔥 {val}
          </span>
        );
      }
      if (upperVal === 'HIGH') {
        return (
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706' }}>
            ▲ {val}
          </span>
        );
      }
    }

    // SLA Status
    if (lowerHeader.includes('sla')) {
      if (upperVal.includes('BREACH')) {
        return (
          <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', padding: '2px 8px', borderRadius: '12px' }}>
            ⚠️ {val}
          </span>
        );
      }
      return (
        <span style={{ fontSize: '11px', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', padding: '2px 8px', borderRadius: '12px' }}>
          🛡️ {val}
        </span>
      );
    }

    // Organization or Product
    if (lowerHeader.includes('organization') && val) {
      return <span style={{ fontSize: '12px', fontWeight: 650, color: '#0284c7' }}>🏢 {val}</span>;
    }
    if (lowerHeader.includes('product') && val) {
      return <span style={{ fontSize: '12px', fontWeight: 650, color: '#9333ea' }}>📦 {val}</span>;
    }

    // Ticket ID
    if (lowerHeader.includes('id') || lowerHeader.includes('key')) {
      return <span style={{ fontWeight: 700, color: 'var(--primary, #2563eb)' }}>{val}</span>;
    }

    return val || <span style={{ color: 'var(--text-muted)' }}>—</span>;
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', width: '100%', padding: '24px 32px' }} className="custom-scrollbar">
      <div style={{ maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Top Hero Banner */}
        <div
          style={{
            backgroundColor: 'var(--bg-surface, #ffffff)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderRadius: '12px',
            padding: '24px 28px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                border: '1px solid rgba(37, 99, 235, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary, #2563eb)',
                flexShrink: 0,
              }}
            >
              <FileSpreadsheet size={26} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '22px', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                  Documents Center
                </h1>
              </div>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                Filter, customize, and export any permutation of tickets to Excel CSV, or upload and beautify CSV reports.
              </p>
            </div>
          </div>

          {/* Global Action Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefreshAll}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '7px',
                fontSize: '13px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
              }}
              title="Refresh real-time ticket counts and preview"
            >
              <RefreshCw
                size={14}
                style={{
                  color: 'var(--primary, #2563eb)',
                  animation: isRefreshing ? 'spin 0.8s linear infinite' : 'none',
                }}
              />
              <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <button
              type="button"
              onClick={resetAllFilters}
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                height: '38px',
                padding: '0 14px',
                borderRadius: '8px',
                fontWeight: 600,
              }}
            >
              <RotateCw size={14} /> Reset Filters
            </button>

            <button
              type="button"
              disabled={isExporting}
              onClick={() => generateAndDownload()}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '13px',
                fontWeight: 700,
                height: '38px',
                padding: '0 16px',
                borderRadius: '8px',
              }}
            >
              <Download size={15} />
              {isExporting ? 'Preparing Document...' : `Download CSV (${totalMatchCount} Items)`}
            </button>
          </div>
        </div>

        {/* Step 1: 1-Click Quick Reports with Real-time Count Badges */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 750, color: 'var(--primary, #2563eb)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                STEP 1 OF 3
              </span>
              <h3 style={{ fontSize: '15px', fontWeight: 750, margin: '2px 0 0', color: 'var(--text-primary)' }}>
                ⚡ Quick 1-Click Preset Reports
              </h3>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Instantly download operational summaries with real-time available counts
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '14px' }}>
            {/* Preset 1: Today's Tickets */}
            <div
              onClick={() => handleQuickExport('today_tickets')}
              style={{
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#0284c7';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(2, 132, 199, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Clock size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Today's Tickets</span>
                    {presetCounts.today_tickets !== undefined && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(2, 132, 199, 0.12)', color: '#0284c7', padding: '1px 6px', borderRadius: '10px' }}>
                        {presetCounts.today_tickets}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Created today • CSV</div>
                </div>
              </div>
              <Download size={15} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Preset 2: Open & Escalated */}
            <div
              onClick={() => handleQuickExport('open_escalated')}
              style={{
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#dc2626';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(220, 38, 38, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Open & Escalated</span>
                    {presetCounts.open_escalated !== undefined && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(239, 68, 68, 0.12)', color: '#dc2626', padding: '1px 6px', borderRadius: '10px' }}>
                        {presetCounts.open_escalated}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>L2/L3 & Dev Queue • CSV</div>
                </div>
              </div>
              <Download size={15} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Preset 3: Unassigned Tickets */}
            <div
              onClick={() => handleQuickExport('unassigned_tickets')}
              style={{
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#d97706';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(217, 119, 6, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <User size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Unassigned Tickets</span>
                    {presetCounts.unassigned_tickets !== undefined && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(245, 158, 11, 0.12)', color: '#d97706', padding: '1px 6px', borderRadius: '10px' }}>
                        {presetCounts.unassigned_tickets}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Needs Triage • CSV</div>
                </div>
              </div>
              <Download size={15} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Preset 4: Open This Month */}
            <div
              onClick={() => handleQuickExport('this_month_open')}
              style={{
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#9333ea';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(147, 51, 234, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Open This Month</span>
                    {presetCounts.this_month_open !== undefined && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(168, 85, 247, 0.12)', color: '#9333ea', padding: '1px 6px', borderRadius: '10px' }}>
                        {presetCounts.this_month_open}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Open & New this month • CSV</div>
                </div>
              </div>
              <Download size={15} style={{ color: 'var(--text-muted)' }} />
            </div>

            {/* Preset 5: Resolved This Month */}
            <div
              onClick={() => handleQuickExport('resolved_month')}
              style={{
                backgroundColor: 'var(--bg-surface, #ffffff)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '14px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#16a34a';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(22, 163, 74, 0.1)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '8px', backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Resolved This Month</span>
                    {presetCounts.resolved_month !== undefined && (
                      <span style={{ fontSize: '10.5px', fontWeight: 700, backgroundColor: 'rgba(34, 197, 94, 0.12)', color: '#16a34a', padding: '1px 6px', borderRadius: '10px' }}>
                        {presetCounts.resolved_month}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Completed tickets • CSV</div>
                </div>
              </div>
              <Download size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>
        </div>

        {/* Step 2: Custom Multi-Criteria Filter Palette */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Header with Live Counter Badge */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 750, color: 'var(--primary, #2563eb)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                STEP 2 OF 3
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 750, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={18} style={{ color: 'var(--primary, #2563eb)' }} />
                Custom Filter Permutations
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                Narrow down your document by combining date ranges, staff assignments, organization, products, categories, or status tags.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '12.5px',
                  fontWeight: 700,
                  backgroundColor: 'rgba(37, 99, 235, 0.08)',
                  color: 'var(--primary, #2563eb)',
                  border: '1px solid rgba(37, 99, 235, 0.2)',
                  padding: '5px 12px',
                  borderRadius: '20px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} />
                {isFetchingPreview ? 'Evaluating...' : `${totalMatchCount} matching tickets`}
              </span>
            </div>
          </div>

          {/* Active Filters Summary Bar */}
          {activeFilterChips.length > 0 && (
            <div
              style={{
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
              }}
            >
              <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '4px' }}>
                Active Criteria ({activeFilterChips.length}):
              </span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.id}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    backgroundColor: 'var(--bg-surface, #ffffff)',
                    border: '1px solid var(--border-subtle, #cbd5e1)',
                    padding: '3px 8px',
                    borderRadius: '16px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {chip.label}
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                    title="Remove filter"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={resetAllFilters}
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: 'var(--primary, #2563eb)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                Clear All
              </button>
            </div>
          )}

          {/* Filter Inputs 4-Column Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
            {/* Card A: Time & Date Window Customized Filter */}
            <CustomDateFilterPicker
              label="1. Time & Date Window"
              icon={<Calendar size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              datePreset={filters.datePreset}
              dateField={filters.dateField}
              startDate={filters.startDate}
              endDate={filters.endDate}
              calculatedLabel={calculatedDates.label}
              onChange={(updates) => setFilters((p) => ({ ...p, ...updates }))}
              onClear={() =>
                setFilters((p) => ({
                  ...p,
                  datePreset: 'all',
                  startDate: '',
                  endDate: '',
                  dateField: 'createdAt',
                }))
              }
            />

            {/* Card B: Assignment Mode & Staff Members */}
            <SearchableMultiSelect
              label="2. Staff & Assignees"
              icon={<User size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              placeholder="All Staff (Search & Multi-select)..."
              options={usersList.map((u: any) => {
                const name = u.fullName || u.displayName || u.name || u.email || 'Staff Member';
                const subLabel = u.email || (u.kind ? `[${u.kind}]` : undefined);
                return { value: u.id, label: name, subLabel };
              })}
              selectedValues={filters.assigneeIds}
              onChange={(vals) => setFilters((p) => ({ ...p, assigneeIds: vals, assignment: vals.length > 0 ? 'specific' : 'all' }))}
            />

            {/* Card C: Teams Multi-Select */}
            <SearchableMultiSelect
              label="3. Support Teams"
              icon={<Users size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              placeholder="All Teams (Search & Multi-select)..."
              options={teams.map((t: any) => ({
                value: t.id,
                label: t.name || (t.tier ? `${t.tier} Support Team` : 'Support Team'),
                subLabel: t.tier ? `Tier: ${t.tier}` : undefined,
              }))}
              selectedValues={filters.teamIds}
              onChange={(vals) => setFilters((p) => ({ ...p, teamIds: vals }))}
            />

            {/* Card D: Client Organization Single-Select */}
            <SearchableSingleSelect
              label="4. Client Organization"
              icon={<Building2 size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              placeholder="All Organizations (Search & select 1)..."
              options={organizations.map((org: any) => ({ value: org.name || org.id, label: org.name }))}
              selectedValue={filters.organization}
              onChange={(val) => setFilters((p) => ({ ...p, organization: val }))}
            />

            {/* Card E: Products Multi-Select */}
            <SearchableMultiSelect
              label="5. Products & Modules"
              icon={<Layers size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              placeholder="All Products (Search & Multi-select)..."
              options={productsList.map((prod: string) => ({ value: prod, label: prod }))}
              selectedValues={filters.products}
              onChange={(vals) => setFilters((p) => ({ ...p, products: vals }))}
            />

            {/* Card F: Categories Multi-Select */}
            <SearchableMultiSelect
              label="6. Ticket Categories"
              icon={<Folder size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              placeholder="All Categories (Search & Multi-select)..."
              options={categories.map((c: any) => ({ value: c.name || c.id, label: c.name }))}
              selectedValues={filters.categories}
              onChange={(vals) => setFilters((p) => ({ ...p, categories: vals }))}
            />

            {/* Card G: Tags Multi-Select */}
            <SearchableMultiSelect
              label="7. Ticket Tags"
              icon={<Tag size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              placeholder="All Tags (Search & Multi-select)..."
              options={tags.map((t: any) => ({
                value: t.name || t.id,
                label: t.name,
                subLabel: t.product ? `[${t.product}]` : undefined,
              }))}
              selectedValues={filters.tags}
              onChange={(vals) => setFilters((p) => ({ ...p, tags: vals }))}
            />

            {/* Card H: Inbound Channels & SLA Target */}
            <div style={{ backgroundColor: 'var(--bg-subtle, #f8fafc)', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Shield size={14} style={{ color: 'var(--primary, #2563eb)' }} />
                8. Channel & SLA Target
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  value={filters.channels.length === 1 ? filters.channels[0] : ''}
                  onChange={(e) => setFilters((p) => ({ ...p, channels: e.target.value ? [e.target.value] : [] }))}
                  className="form-control"
                  style={{ fontSize: '12.5px', flex: 1 }}
                >
                  <option value="">All Channels</option>
                  {ALL_CHANNELS.map((ch) => (
                    <option key={ch} value={ch}>
                      {ch}
                    </option>
                  ))}
                </select>
                <select
                  value={filters.slaBreach}
                  onChange={(e) => setFilters((p) => ({ ...p, slaBreach: e.target.value as any }))}
                  className="form-control"
                  style={{ fontSize: '12.5px', flex: 1 }}
                >
                  <option value="all">All SLA States</option>
                  <option value="breached">Breached SLA Only</option>
                  <option value="within_sla">Within SLA Target</option>
                </select>
              </div>
            </div>
          </div>

          {/* Status, Priority & Support Tier Compact Popover Filter Toolbar */}
          <div
            style={{
              paddingTop: '16px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '11.5px',
                fontWeight: 750,
                color: 'var(--text-secondary)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                marginRight: '4px',
              }}
            >
              Quick Presets:
            </span>

            <FilterPopoverMultiSelect
              title="Ticket Status"
              icon={<Tag size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              options={ALL_STATUSES}
              selectedValues={filters.statuses}
              onChange={(statuses) => setFilters((p) => ({ ...p, statuses }))}
              searchPlaceholder="Search ticket statuses..."
            />

            <FilterPopoverMultiSelect
              title="Priority"
              icon={<AlertTriangle size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              options={ALL_PRIORITIES}
              selectedValues={filters.priorities}
              onChange={(priorities) => setFilters((p) => ({ ...p, priorities }))}
              searchPlaceholder="Search priorities..."
            />

            <FilterPopoverMultiSelect
              title="Support Tier"
              icon={<Shield size={14} style={{ color: 'var(--primary, #2563eb)' }} />}
              options={ALL_TIERS}
              selectedValues={filters.tiers}
              onChange={(tiers) => setFilters((p) => ({ ...p, tiers }))}
              searchPlaceholder="Search tiers..."
            />
          </div>
        </div>

        {/* Step 3: Column Selector & CSV Beautifier / Viewer */}
        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '16px' }}>
            <div>
              <span style={{ fontSize: '11px', fontWeight: 750, color: 'var(--primary, #2563eb)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                STEP 3 OF 3
              </span>
              <h3 style={{ fontSize: '16px', fontWeight: 750, margin: '2px 0 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TableIcon size={18} style={{ color: 'var(--primary, #2563eb)' }} />
                Output Fields & CSV Beautifier
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>
                {selectedColumns.size} of {AVAILABLE_COLUMNS.length} fields selected. Export to CSV or upload and beautify any CSV report.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              {/* Columns Customizer Dropdown Popover with Product Theme Brand Color */}
              <div style={{ position: 'relative' }} ref={columnCustomizerRef}>
                <button
                  type="button"
                  onClick={() => setShowColumnsCustomizer(!showColumnsCustomizer)}
                  className="btn btn-secondary"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    height: '38px',
                    padding: '0 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 650,
                    border: showColumnsCustomizer ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle)',
                    backgroundColor: showColumnsCustomizer ? 'rgba(37, 99, 235, 0.08)' : 'var(--bg-surface)',
                    color: showColumnsCustomizer ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                    boxShadow: showColumnsCustomizer ? '0 0 0 3px rgba(37, 99, 235, 0.12)' : 'none',
                    transition: 'all 0.15s ease',
                    cursor: 'pointer',
                    boxSizing: 'border-box',
                  }}
                >
                  <SlidersHorizontal size={14} style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }} />
                  <span>Customize Export Fields</span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: 'rgba(37, 99, 235, 0.1)',
                      color: 'var(--primary, #2563eb)',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      lineHeight: 1.2,
                    }}
                  >
                    {selectedColumns.size}/{AVAILABLE_COLUMNS.length}
                  </span>
                  {showColumnsCustomizer ? (
                    <ChevronUp size={14} style={{ color: 'var(--primary, #2563eb)', flexShrink: 0 }} />
                  ) : (
                    <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  )}
                </button>

                {/* Popover Dropdown Card */}
                {showColumnsCustomizer && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 8px)',
                      right: 0,
                      width: '340px',
                      backgroundColor: 'var(--bg-surface, #ffffff)',
                      borderRadius: '12px',
                      border: '1px solid var(--border-subtle, #e2e8f0)',
                      boxShadow: '0 16px 36px -4px rgba(0, 0, 0, 0.14), 0 6px 16px -2px rgba(0, 0, 0, 0.06)',
                      padding: '16px',
                      zIndex: 1000,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px',
                    }}
                  >
                    {/* Header Row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <h4
                          style={{
                            fontSize: '12px',
                            fontWeight: 800,
                            color: 'var(--text-primary)',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            margin: 0,
                          }}
                        >
                          Customize Export Fields
                        </h4>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                          {selectedColumns.size} of {AVAILABLE_COLUMNS.length} fields visible
                        </p>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={selectAllColumns}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(37, 99, 235, 0.09)',
                            border: '1px solid rgba(37, 99, 235, 0.25)',
                            color: 'var(--primary, #2563eb)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={clearAllColumns}
                          style={{
                            padding: '3px 10px',
                            borderRadius: '6px',
                            backgroundColor: 'var(--bg-subtle, #f8fafc)',
                            border: '1px solid var(--border-subtle, #cbd5e1)',
                            color: 'var(--text-secondary, #475569)',
                            fontSize: '11.5px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            transition: 'all 0.12s ease',
                          }}
                        >
                          Clear
                        </button>
                      </div>
                    </div>

                    {/* Search Bar with Brand Focus Border */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '7px 10px',
                        borderRadius: '8px',
                        border: '1.5px solid var(--primary, #2563eb)',
                        backgroundColor: 'var(--bg-surface, #ffffff)',
                      }}
                    >
                      <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                      <input
                        type="text"
                        placeholder="Search field names..."
                        value={columnSearchQuery}
                        onChange={(e) => setColumnSearchQuery(e.target.value)}
                        style={{
                          border: 'none',
                          outline: 'none',
                          backgroundColor: 'transparent',
                          fontSize: '12.5px',
                          color: 'var(--text-primary)',
                          width: '100%',
                        }}
                      />
                      {columnSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setColumnSearchQuery('')}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                            color: 'var(--text-muted)',
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    {/* Scrollable Column List */}
                    <div
                      style={{
                        maxHeight: '280px',
                        overflowY: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        paddingRight: '2px',
                      }}
                    >
                      {AVAILABLE_COLUMNS.filter(
                        (col) =>
                          col.label.toLowerCase().includes(columnSearchQuery.toLowerCase()) ||
                          col.id.toLowerCase().includes(columnSearchQuery.toLowerCase())
                      ).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px 8px', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No fields matching "{columnSearchQuery}"
                        </div>
                      ) : (
                        AVAILABLE_COLUMNS.filter(
                          (col) =>
                            col.label.toLowerCase().includes(columnSearchQuery.toLowerCase()) ||
                            col.id.toLowerCase().includes(columnSearchQuery.toLowerCase())
                        ).map((col) => {
                          const isChecked = selectedColumns.has(col.id);
                          return (
                            <div
                              key={col.id}
                              onClick={() => toggleColumn(col.id)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '7px 10px',
                                borderRadius: '8px',
                                backgroundColor: isChecked ? 'rgba(37, 99, 235, 0.08)' : 'transparent',
                                border: isChecked ? '1px solid rgba(37, 99, 235, 0.25)' : '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                                userSelect: 'none',
                              }}
                              onMouseEnter={(e) => {
                                if (!isChecked) e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                              }}
                              onMouseLeave={(e) => {
                                if (!isChecked) e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              {/* Left Side: Square Checkbox + Label */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                                <div
                                  style={{
                                    width: '18px',
                                    height: '18px',
                                    borderRadius: '4px',
                                    backgroundColor: isChecked ? 'var(--primary, #2563eb)' : 'var(--bg-surface, #ffffff)',
                                    border: isChecked ? '1.5px solid var(--primary, #2563eb)' : '1.5px solid var(--border-subtle, #cbd5e1)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    transition: 'all 0.12s',
                                  }}
                                >
                                  {isChecked && <Check size={12} strokeWidth={3.2} color="#ffffff" />}
                                </div>
                                <span
                                  style={{
                                    fontSize: '13px',
                                    fontWeight: isChecked ? 700 : 500,
                                    color: isChecked ? 'var(--primary, #2563eb)' : 'var(--text-primary)',
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {col.label}
                                </span>
                              </div>

                              {/* Right Side: Circular Check Badge */}
                              <div
                                style={{
                                  width: '18px',
                                  height: '18px',
                                  borderRadius: '50%',
                                  backgroundColor: isChecked ? 'var(--primary, #2563eb)' : 'transparent',
                                  border: isChecked ? '1.5px solid var(--primary, #2563eb)' : '1.5px solid var(--border-subtle, #e2e8f0)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  opacity: isChecked ? 1 : 0.35,
                                  transition: 'all 0.12s',
                                }}
                              >
                                {isChecked && <Check size={11} strokeWidth={3.2} color="#ffffff" />}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                disabled={isExporting}
                onClick={() => generateAndDownload()}
                className="btn btn-primary"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  height: '38px',
                  padding: '0 16px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 700,
                  boxSizing: 'border-box',
                  cursor: isExporting ? 'not-allowed' : 'pointer',
                }}
              >
                <Download size={15} style={{ flexShrink: 0 }} />
                <span>{isExporting ? 'Preparing Document...' : `Download CSV (${totalMatchCount} Items)`}</span>
              </button>
            </div>
          </div>

          {/* DYNAMIC CSV BEAUTIFIER & INTERACTIVE VIEWER */}
          <div
            ref={viewerContainerRef}
            style={
              isViewerFullscreen
                ? {
                  position: 'fixed',
                  inset: 0,
                  zIndex: 99999,
                  backgroundColor: 'var(--bg-surface, #ffffff)',
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflow: 'hidden',
                }
                : {
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }
            }
          >
            {/* Action Toolbar for CSV Beautifier */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                backgroundColor: 'var(--bg-subtle, #f8fafc)',
                padding: '12px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-subtle, #e2e8f0)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '6px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h4 style={{ fontSize: '14px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                    CSV Beautifier & Interactive Viewer
                  </h4>
                  <p style={{ fontSize: '11.5px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
                    {uploadedCsvData
                      ? `Viewing "${uploadedCsvData.filename}" • ${uploadedCsvData.rows.length} records • ${uploadedCsvData.headers.length} columns`
                      : 'Load the current filter permutation or upload any downloaded CSV to inspect.'}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                <button
                  type="button"
                  onClick={handleLoadCurrentPermutationIntoViewer}
                  disabled={isLoadingViewerData}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 650 }}
                >
                  {isLoadingViewerData ? (
                    <RefreshCw size={14} className="spin-animation" style={{ color: 'var(--primary, #2563eb)' }} />
                  ) : (
                    <Sparkles size={14} style={{ color: 'var(--primary, #2563eb)' }} />
                  )}
                  {isLoadingViewerData && loadingProgress
                    ? `Loading (${loadingProgress.loaded.toLocaleString()}/${loadingProgress.total.toLocaleString()})...`
                    : `Load Current CSV (${totalMatchCount.toLocaleString()})`}
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                >
                  <Download size={14} style={{ transform: 'rotate(180deg)' }} />
                  Upload CSV File
                </button>

                {uploadedCsvData && (
                  <>
                    <button
                      type="button"
                      onClick={toggleViewerFullscreen}
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
                      title={isViewerFullscreen ? 'Exit Fullscreen (Esc)' : 'Expand to Fullscreen'}
                    >
                      {isViewerFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      <span>{isViewerFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setUploadedCsvData(null);
                        setIsViewerFullscreen(false);
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#dc2626';
                        e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.08)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-muted)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                      title="Clear and reset the CSV spreadsheet viewer"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '6px 10px',
                        borderRadius: '6px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Trash2 size={13} />
                      <span>Clear Viewer</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Viewer Search & Controls Bar */}
            {uploadedCsvData && !isLoadingViewerData && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '380px' }}>
                  <div style={{ position: 'relative', width: '100%' }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={viewerSearchQuery}
                      onChange={(e) => {
                        setViewerSearchQuery(e.target.value);
                        setViewerPage(1);
                      }}
                      placeholder={`Search across ${uploadedCsvData.rows.length} rows...`}
                      className="form-control"
                      style={{ paddingLeft: '32px', fontSize: '12px', height: '34px' }}
                    />
                    {viewerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setViewerSearchQuery('')}
                        style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Showing {paginatedViewerRows.length} of {filteredAndSortedViewerRows.length} rows
                  </span>
                </div>
              </div>
            )}

            {/* Live Progress Bar & Loader for Parallel Dataset Loading */}
            {isLoadingViewerData ? (
              <div
                style={{
                  border: '1px solid rgba(37, 99, 235, 0.25)',
                  borderRadius: '10px',
                  padding: '40px 24px',
                  textAlign: 'center',
                  backgroundColor: 'rgba(37, 99, 235, 0.03)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 4px 20px -2px rgba(37, 99, 235, 0.08)',
                }}
              >
                <div
                  style={{
                    width: '54px',
                    height: '54px',
                    borderRadius: '16px',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    color: 'var(--primary, #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 0 16px rgba(37, 99, 235, 0.2)',
                  }}
                >
                  <RefreshCw size={26} className="spin-animation" />
                </div>

                <div style={{ maxWidth: '520px', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Streaming Dataset into Viewer
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 650,
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: 'rgba(37, 99, 235, 0.1)',
                          color: 'var(--primary, #2563eb)',
                        }}
                      >
                        ⚡ 8x Parallel Lanes
                      </span>
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--primary, #2563eb)' }}>
                      {loadingProgress?.percent || 15}%
                    </span>
                  </div>

                  {/* Progress Bar Container */}
                  <div
                    style={{
                      width: '100%',
                      height: '8px',
                      backgroundColor: 'rgba(203, 213, 225, 0.4)',
                      borderRadius: '999px',
                      overflow: 'hidden',
                      position: 'relative',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${loadingProgress?.percent || 15}%`,
                        backgroundColor: 'var(--primary, #2563eb)',
                        borderRadius: '999px',
                        transition: 'width 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      }}
                    />
                  </div>

                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: '10px 0 0' }}>
                    {loadingProgress?.statusText || `Streaming ${totalMatchCount.toLocaleString()} records in parallel batches...`}
                  </p>
                </div>
              </div>
            ) : !uploadedCsvData ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-subtle, #cbd5e1)',
                  borderRadius: '10px',
                  padding: '48px 24px',
                  textAlign: 'center',
                  backgroundColor: 'var(--bg-subtle, #f8fafc)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
                  e.currentTarget.style.backgroundColor = 'rgba(37, 99, 235, 0.02)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-subtle, #cbd5e1)';
                  e.currentTarget.style.backgroundColor = 'var(--bg-subtle, #f8fafc)';
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary, #2563eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileSpreadsheet size={26} />
                </div>
                <div>
                  <h5 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
                    Drop or Upload any CSV to Beautify & Inspect
                  </h5>
                  <p style={{ fontSize: '12.5px', color: 'var(--text-muted)', margin: 0, maxWidth: '480px' }}>
                    Click here to select a `.csv` file, or click <strong>"Load Current CSV"</strong> above to inspect filtered tickets in the spreadsheet viewer.
                  </p>
                </div>
                <div style={{ marginTop: '4px' }}>
                  <span className="btn btn-secondary" style={{ fontSize: '12px', pointerEvents: 'none' }}>
                    <Download size={13} style={{ transform: 'rotate(180deg)' }} /> Browse or Drop File
                  </span>
                </div>
              </div>
            ) : filteredAndSortedViewerRows.length === 0 ? (
              <div style={{ padding: '36px 20px', textAlign: 'center', backgroundColor: 'var(--bg-subtle)', borderRadius: '8px' }}>
                <Search size={28} style={{ color: 'var(--text-muted)', opacity: 0.7, marginBottom: '6px' }} />
                <h5 style={{ fontSize: '14px', fontWeight: 650, margin: '0 0 4px' }}>No matching records found</h5>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                  No rows in "{uploadedCsvData.filename}" matched your search term "{viewerSearchQuery}".
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: isViewerFullscreen ? 1 : undefined, minHeight: 0 }}>
                <div
                  ref={tableScrollRef}
                  style={{
                    overflowX: 'auto',
                    overflowY: 'auto',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    minHeight: isViewerFullscreen ? 'calc(100vh - 200px)' : '380px',
                    maxHeight: isViewerFullscreen ? 'none' : '550px',
                    flex: isViewerFullscreen ? 1 : undefined,
                    backgroundColor: 'var(--bg-surface)',
                  }}
                  className="custom-scrollbar"
                >
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12.5px' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr style={{ backgroundColor: 'var(--bg-subtle, #f8fafc)', borderBottom: '2px solid var(--border-subtle)', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--text-muted)', width: '40px', textAlign: 'center' }}>#</th>
                        {uploadedCsvData.headers.map((h, colIdx) => {
                          const isSorted = viewerSortColIndex === colIdx;
                          return (
                            <th
                              key={colIdx}
                              onClick={() => {
                                if (viewerSortColIndex === colIdx) {
                                  setViewerSortAsc(!viewerSortAsc);
                                } else {
                                  setViewerSortColIndex(colIdx);
                                  setViewerSortAsc(true);
                                }
                              }}
                              style={{
                                padding: '10px 14px',
                                fontWeight: 700,
                                color: isSorted ? 'var(--primary, #2563eb)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                backgroundColor: isSorted ? 'rgba(37, 99, 235, 0.04)' : 'var(--bg-subtle, #f8fafc)',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span>{h}</span>
                                <span style={{ fontSize: isSorted ? '10px' : '13.5px', opacity: isSorted ? 1 : 0.45 }}>
                                  {isSorted ? (viewerSortAsc ? '▲' : '▼') : '↕'}
                                </span>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedViewerRows.map((row, rowIdx) => {
                        const globalRowIndex = (viewerPage - 1) * viewerPageSize + rowIdx + 1;
                        return (
                          <tr
                            key={rowIdx}
                            style={{
                              borderBottom: '1px solid var(--border-subtle)',
                              backgroundColor: rowIdx % 2 === 0 ? 'var(--bg-surface)' : 'rgba(248, 250, 252, 0.5)',
                            }}
                          >
                            <td style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                              {globalRowIndex}
                            </td>
                            {row.map((cell, cellIdx) => (
                              <td
                                key={cellIdx}
                                style={{
                                  padding: '8px 14px',
                                  maxWidth: '300px',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {renderBeautifiedCell(cell, uploadedCsvData.headers[cellIdx] || '')}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination & Page Size Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 0',
                    flexWrap: 'wrap',
                    gap: '10px',
                    borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                    marginTop: '2px',
                  }}
                >
                  {/* Left Bottom: Compact Rows Per Page Selector & Record Count */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Rows per page:</span>
                      <select
                        value={viewerPageSize}
                        onChange={(e) => {
                          setViewerPageSize(Number(e.target.value));
                          setViewerPage(1);
                        }}
                        className="form-control"
                        style={{ fontSize: '11.5px', height: '28px', width: '74px', padding: '2px 6px' }}
                      >
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                        <option value={100}>100</option>
                        <option value={250}>250</option>
                        <option value={500}>500</option>
                      </select>
                    </div>

                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Showing {(viewerPage - 1) * viewerPageSize + 1} - {Math.min(viewerPage * viewerPageSize, filteredAndSortedViewerRows.length)} of {filteredAndSortedViewerRows.length} rows
                    </span>
                  </div>

                  {/* Right Bottom: Comprehensive Pagination Controls */}
                  {totalViewerPages > 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                      {/* First Page Button */}
                      <button
                        type="button"
                        disabled={viewerPage <= 1}
                        onClick={() => setViewerPage(1)}
                        title="First Page (Page 1)"
                        className="btn btn-secondary"
                        style={{
                          fontSize: '11.5px',
                          padding: '0 8px',
                          height: '28px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          opacity: viewerPage <= 1 ? 0.45 : 1,
                          cursor: viewerPage <= 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronsLeft size={13} />
                        <span>First</span>
                      </button>

                      {/* Previous Page Button */}
                      <button
                        type="button"
                        disabled={viewerPage <= 1}
                        onClick={() => setViewerPage((p) => Math.max(1, p - 1))}
                        title="Previous Page"
                        className="btn btn-secondary"
                        style={{
                          fontSize: '11.5px',
                          padding: '0 8px',
                          height: '28px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          opacity: viewerPage <= 1 ? 0.45 : 1,
                          cursor: viewerPage <= 1 ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <ChevronLeft size={13} />
                        <span>Prev</span>
                      </button>

                      {/* Page Numbers with Smart Ellipsis */}
                      {Array.from({ length: totalViewerPages }, (_, i) => i + 1)
                        .filter((page) => {
                          if (totalViewerPages <= 7) return true;
                          if (page === 1 || page === totalViewerPages) return true;
                          return Math.abs(page - viewerPage) <= 1;
                        })
                        .reduce<(number | string)[]>((acc, page, idx, arr) => {
                          if (idx > 0 && typeof arr[idx - 1] === 'number' && (page as number) - (arr[idx - 1] as number) > 1) {
                            acc.push('...');
                          }
                          acc.push(page);
                          return acc;
                        }, [])
                        .map((p, idx) => {
                          if (typeof p === 'string') {
                            return (
                              <span
                                key={`dots-${idx}`}
                                style={{
                                  padding: '0 4px',
                                  color: 'var(--text-muted)',
                                  fontSize: '12px',
                                  fontWeight: 600,
                                  userSelect: 'none',
                                }}
                              >
                                ...
                              </span>
                            );
                          }
                          const isCurrent = p === viewerPage;
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => setViewerPage(p as number)}
                              title={`Go to page ${p}`}
                              style={{
                                minWidth: '28px',
                                height: '28px',
                                padding: '0 6px',
                                fontSize: '11.5px',
                                fontWeight: isCurrent ? 700 : 500,
                                borderRadius: '5px',
                                border: isCurrent ? '1px solid var(--primary, #2563eb)' : '1px solid var(--border-subtle)',
                                backgroundColor: isCurrent ? 'var(--primary, #2563eb)' : 'var(--bg-surface)',
                                color: isCurrent ? '#ffffff' : 'var(--text-primary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {p}
                            </button>
                          );
                        })}

                      {/* Next Page Button */}
                      <button
                        type="button"
                        disabled={viewerPage >= totalViewerPages}
                        onClick={() => setViewerPage((p) => Math.min(totalViewerPages, p + 1))}
                        title="Next Page"
                        className="btn btn-secondary"
                        style={{
                          fontSize: '11.5px',
                          padding: '0 8px',
                          height: '28px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          opacity: viewerPage >= totalViewerPages ? 0.45 : 1,
                          cursor: viewerPage >= totalViewerPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span>Next</span>
                        <ChevronRight size={13} />
                      </button>

                      {/* Last Page Button */}
                      <button
                        type="button"
                        disabled={viewerPage >= totalViewerPages}
                        onClick={() => setViewerPage(totalViewerPages)}
                        title={`Last Page (Page ${totalViewerPages})`}
                        className="btn btn-secondary"
                        style={{
                          fontSize: '11.5px',
                          padding: '0 8px',
                          height: '28px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          opacity: viewerPage >= totalViewerPages ? 0.45 : 1,
                          cursor: viewerPage >= totalViewerPages ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <span>Last</span>
                        <ChevronsRight size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};


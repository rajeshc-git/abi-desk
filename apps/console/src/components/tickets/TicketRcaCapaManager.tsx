import React, { useState, useEffect, useRef } from 'react';
import {
  FileSearch,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Check,
  Save,
  RotateCcw,
  Sparkles,
  Copy,
  Clock,
  Edit3,
  Maximize2,
  X,
  Code,
  FileText,
  CheckCircle2,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface TicketRcaCapaManagerProps {
  ticketId: string;
  ticketNumber?: string;
  ticketSubject?: string;
  rootCause?: string | null;
  capaNotes?: string | null;
  rcaUpdatedAt?: string | null;
  capaUpdatedAt?: string | null;
  rcaUpdatedBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  capaUpdatedBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  readonly?: boolean;
  highlightRcaError?: boolean;
  highlightCapaError?: boolean;
  onUpdate?: (updated: {
    rootCause?: string | null;
    capaNotes?: string | null;
    rcaUpdatedAt?: string | null;
    capaUpdatedAt?: string | null;
    rcaUpdatedBy?: any;
    capaUpdatedBy?: any;
  }) => void;
}

const RCA_CHIPS = [
  'Software / Logic Bug',
  'Data Mismatch / DB Issue',
  'Config / Env Issue',
  '3rd Party API / Gateway',
  'Infra / Latency / Resource',
  'User / Permission Issue',
];

const CAPA_CHIPS = [
  'Hotfix Deployed',
  'Data Patch Applied',
  'Config / Env Updated',
  'Automated Test Added',
  'Monitoring Alert Added',
  'Input Validation Added',
  'SOP / Runbook Updated',
];

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return `${Math.floor(diffSec / 86400)}d ago`;
}

// Intelligent content renderer: detects SQL/code blocks and formats bullets gracefully
const FormattedNotesView: React.FC<{
  text: string;
  accentColor: string;
}> = ({ text, accentColor }) => {
  if (!text || !text.trim()) {
    return <span style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '12px' }}>No notes recorded yet.</span>;
  }

  // Detect if text looks like a SQL query or code block
  const isCodeOrSql =
    /\b(select\s+.+\s+from|insert\s+into|update\s+.+\s+set|delete\s+from|create\s+table|where\s+|order\s+by|group\s+by)\b/i.test(text) ||
    (text.includes('{') && text.includes('}')) ||
    text.startsWith('curl ') ||
    text.includes('SELECT ') ||
    text.includes('WHERE ');

  const lines = text.split('\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {isCodeOrSql ? (
        <div
          style={{
            backgroundColor: 'var(--bg-app, #f8fafc)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            borderLeft: `3px solid ${accentColor}`,
            borderRadius: '6px',
            padding: '10px 12px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '11.5px',
            lineHeight: 1.6,
            color: 'var(--text-primary)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              color: 'var(--text-muted)',
              marginBottom: '6px',
            }}
          >
            <Code size={11} /> Query / Technical Trace
          </div>
          {text}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {lines.map((line, idx) => {
            const trimmed = line.trim();
            if (!trimmed) return <div key={idx} style={{ height: '4px' }} />;

            const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-');
            const bulletContent = isBullet ? trimmed.replace(/^[•\-]\s*/, '') : trimmed;

            // Check if line starts with a template chip keyword like "Software / Logic Bug:"
            const colonIndex = bulletContent.indexOf(':');
            const hasCategoryPrefix = isBullet && colonIndex > 0;
            const categoryPart = hasCategoryPrefix ? bulletContent.slice(0, colonIndex).trim() : null;
            const restPart = hasCategoryPrefix ? bulletContent.slice(colonIndex + 1).trim() : bulletContent;

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: isBullet ? '6px' : '0',
                  fontSize: '12.5px',
                  lineHeight: '1.55',
                  color: 'var(--text-primary)',
                  wordBreak: 'break-word',
                }}
              >
                {isBullet && (
                  <span
                    style={{
                      color: accentColor,
                      fontWeight: 700,
                      lineHeight: '1.55',
                      flexShrink: 0,
                    }}
                  >
                    •
                  </span>
                )}
                <div style={{ flex: 1 }}>
                  {hasCategoryPrefix ? (
                    <>
                      <span
                        style={{
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                          padding: '1px 5px',
                          borderRadius: '4px',
                          marginRight: '6px',
                          fontSize: '11px',
                          display: 'inline-block',
                        }}
                      >
                        {categoryPart}
                      </span>
                      <span>{restPart}</span>
                    </>
                  ) : (
                    <span>{bulletContent}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const TicketRcaCapaManager: React.FC<TicketRcaCapaManagerProps> = ({
  ticketId,
  ticketNumber,
  ticketSubject,
  rootCause,
  capaNotes,
  rcaUpdatedAt,
  capaUpdatedAt,
  rcaUpdatedBy,
  capaUpdatedBy,
  readonly = false,
  highlightRcaError = false,
  highlightCapaError = false,
  onUpdate,
}) => {
  const toast = useToast();

  // RCA State
  const [rcaText, setRcaText] = useState(rootCause || '');
  const [isRcaOpen, setIsRcaOpen] = useState(Boolean(rootCause));
  const [isRcaEditing, setIsRcaEditing] = useState(!rootCause);
  const [isSavingRca, setIsSavingRca] = useState(false);
  const [copiedRca, setCopiedRca] = useState(false);

  // CAPA State
  const [capaText, setCapaText] = useState(capaNotes || '');
  const [isCapaOpen, setIsCapaOpen] = useState(Boolean(capaNotes));
  const [isCapaEditing, setIsCapaEditing] = useState(!capaNotes);
  const [isSavingCapa, setIsSavingCapa] = useState(false);
  const [copiedCapa, setCopiedCapa] = useState(false);

  // Focus Modal State
  const [isFocusModalOpen, setIsFocusModalOpen] = useState(false);
  const [copiedFullReport, setCopiedFullReport] = useState(false);

  // Auto-resizing textarea refs
  const rcaTextareaRef = useRef<HTMLTextAreaElement>(null);
  const capaTextareaRef = useRef<HTMLTextAreaElement>(null);

  const autoResize = (el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(76, el.scrollHeight)}px`;
  };

  useEffect(() => {
    setRcaText(rootCause || '');
    if (rootCause) {
      setIsRcaEditing(false);
    } else {
      setIsRcaEditing(true);
    }
    if ((rootCause || highlightRcaError) && !isRcaOpen) setIsRcaOpen(true);
  }, [rootCause, highlightRcaError]);

  useEffect(() => {
    setCapaText(capaNotes || '');
    if (capaNotes) {
      setIsCapaEditing(false);
    } else {
      setIsCapaEditing(true);
    }
    if ((capaNotes || highlightCapaError) && !isCapaOpen) setIsCapaOpen(true);
  }, [capaNotes, highlightCapaError]);

  // Adjust height on text/edit change
  useEffect(() => {
    if (isRcaEditing && isRcaOpen) {
      autoResize(rcaTextareaRef.current);
    }
  }, [rcaText, isRcaEditing, isRcaOpen]);

  useEffect(() => {
    if (isCapaEditing && isCapaOpen) {
      autoResize(capaTextareaRef.current);
    }
  }, [capaText, isCapaEditing, isCapaOpen]);

  // Close focus modal with Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFocusModalOpen) {
        setIsFocusModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFocusModalOpen]);

  const handleSaveRca = async () => {
    if (isSavingRca || readonly) return;
    setIsSavingRca(true);
    try {
      const res = await ApiClient.patch(`/tickets/${ticketId}`, { rootCause: rcaText });
      toast.success('Root Cause Analysis updated');
      setIsRcaEditing(false);
      onUpdate?.({
        rootCause: rcaText,
        rcaUpdatedAt: res.rcaUpdatedAt || new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save Root Cause');
    } finally {
      setIsSavingRca(false);
    }
  };

  const handleSaveCapa = async () => {
    if (isSavingCapa || readonly) return;
    setIsSavingCapa(true);
    try {
      const res = await ApiClient.patch(`/tickets/${ticketId}`, { capaNotes: capaText });
      toast.success('CAPA actions updated');
      setIsCapaEditing(false);
      onUpdate?.({
        capaNotes: capaText,
        capaUpdatedAt: res.capaUpdatedAt || new Date().toISOString(),
      });
    } catch (err: any) {
      toast.error(err.message || 'Failed to save CAPA');
    } finally {
      setIsSavingCapa(false);
    }
  };

  const handleCopyRca = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!rcaText) return;
    navigator.clipboard.writeText(rcaText);
    setCopiedRca(true);
    setTimeout(() => setCopiedRca(false), 1800);
  };

  const handleCopyCapa = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!capaText) return;
    navigator.clipboard.writeText(capaText);
    setCopiedCapa(true);
    setTimeout(() => setCopiedCapa(false), 1800);
  };

  const handleCopyFullReport = () => {
    const report = [
      ticketNumber ? `### [Ticket #${ticketNumber}] ${ticketSubject || 'RCA & CAPA Report'}` : '### Root Cause & CAPA Report',
      '',
      '#### Root Cause (RCA):',
      rcaText || '*(None recorded)*',
      '',
      '#### Corrective & Preventive Actions (CAPA):',
      capaText || '*(None recorded)*',
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedFullReport(true);
    setTimeout(() => setCopiedFullReport(false), 2000);
  };

  const isRcaDirty = rcaText !== (rootCause || '');
  const isCapaDirty = capaText !== (capaNotes || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
      {/* ─── 1. ROOT CAUSE ANALYSIS (RCA) CARD ─── */}
      <div
        className="card"
        style={{
          padding: 0,
          border: highlightRcaError && !rootCause ? '1px solid #ef4444' : '1px solid var(--border-subtle)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          boxShadow: highlightRcaError && !rootCause ? '0 0 0 1px #ef4444, 0 1px 3px rgba(239, 68, 68, 0.1)' : '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Card Header Trigger */}
        <div
          onClick={() => setIsRcaOpen(!isRcaOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            cursor: 'pointer',
            backgroundColor: isRcaOpen ? 'rgba(239, 68, 68, 0.03)' : 'transparent',
            borderBottom: isRcaOpen ? '1px solid var(--border-subtle)' : 'none',
            transition: 'background-color 0.15s ease',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <FileSearch size={13} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Root Cause (RCA)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {rootCause ? (
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                Recorded
              </span>
            ) : (
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                }}
              >
                Empty
              </span>
            )}

            {/* Quick Popout Button */}
            {(rootCause || capaNotes) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFocusModalOpen(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '3px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
                title="Expand Full Post-Mortem View"
              >
                <Maximize2 size={13} />
              </button>
            )}

            <div style={{ color: 'var(--text-muted)' }}>
              {isRcaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>

        {/* Expandable RCA Content */}
        {isRcaOpen && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Mode A: Clean Reader View (When not editing and has content) */}
            {!isRcaEditing && rootCause ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-surface-elevated, #ffffff)',
                  borderRadius: '6px',
                }}
              >
                <FormattedNotesView text={rcaText} accentColor="#ef4444" />

                {/* Reader View Footer Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {rcaUpdatedAt && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} /> {formatRelativeTime(rcaUpdatedAt)}
                        {rcaUpdatedBy?.fullName && ` by ${rcaUpdatedBy.fullName}`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleCopyRca}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 7px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)',
                        color: copiedRca ? '#10b981' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                      title="Copy Root Cause"
                    >
                      {copiedRca ? <Check size={11} /> : <Copy size={11} />}
                      {copiedRca ? 'Copied' : 'Copy'}
                    </button>

                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => setIsRcaEditing(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-subtle, #f8fafc)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Mode B: Full-Height Auto-Expanding Editor */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Quick Template Chips */}
                {!readonly && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '2px' }}>
                    {RCA_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          if (rcaText.includes(chip)) return;
                          const next = rcaText ? `${rcaText}\n• ${chip}: ` : `• ${chip}: `;
                          setRcaText(next);
                        }}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          backgroundColor: 'var(--bg-subtle, #f8fafc)',
                          color: 'var(--text-secondary, #64748b)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Auto-Expanding Textarea (No Scrollbars!) */}
                <textarea
                  ref={rcaTextareaRef}
                  value={rcaText}
                  disabled={readonly || isSavingRca}
                  onChange={(e) => {
                    setRcaText(e.target.value);
                    autoResize(e.target);
                  }}
                  placeholder="Identify root cause (e.g. backend sync failure due to corrupted payload format)..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)',
                    backgroundColor: readonly ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    outline: 'none',
                    resize: 'none',
                    overflow: 'hidden',
                    minHeight: '76px',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#ef4444')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                />

                {/* Editor Action Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '6px',
                    fontSize: '11px',
                  }}
                >
                  {rootCause && (
                    <button
                      type="button"
                      onClick={() => {
                        setRcaText(rootCause || '');
                        setIsRcaEditing(false);
                      }}
                      disabled={isSavingRca}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}

                  {!readonly && (
                    <button
                      type="button"
                      onClick={handleSaveRca}
                      disabled={!isRcaDirty || isSavingRca}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: 'none',
                        backgroundColor: isRcaDirty ? '#ef4444' : 'var(--bg-subtle, #f1f5f9)',
                        color: isRcaDirty ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                        cursor: isRcaDirty && !isSavingRca ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Save size={12} />
                      <span>{isSavingRca ? 'Saving...' : 'Save RCA'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 2. CAPA (CORRECTIVE & PREVENTIVE ACTION) CARD ─── */}
      <div
        className="card"
        style={{
          padding: 0,
          border: highlightCapaError && !capaNotes ? '1px solid #10b981' : '1px solid var(--border-subtle)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          boxShadow: highlightCapaError && !capaNotes ? '0 0 0 1px #10b981, 0 1px 3px rgba(16, 185, 129, 0.1)' : '0 1px 3px rgba(0,0,0,0.03)',
        }}
      >
        {/* Card Header Trigger */}
        <div
          onClick={() => setIsCapaOpen(!isCapaOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px',
            cursor: 'pointer',
            backgroundColor: isCapaOpen ? 'rgba(16, 185, 129, 0.03)' : 'transparent',
            borderBottom: isCapaOpen ? '1px solid var(--border-subtle)' : 'none',
            transition: 'background-color 0.15s ease',
            userSelect: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '6px',
                backgroundColor: 'rgba(16, 185, 129, 0.12)',
                color: '#10b981',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <ShieldCheck size={13} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                CAPA Actions
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {capaNotes ? (
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 600,
                  color: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                }}
              >
                Recorded
              </span>
            ) : (
              <span
                style={{
                  fontSize: '10.5px',
                  fontWeight: 500,
                  color: 'var(--text-muted)',
                }}
              >
                Empty
              </span>
            )}

            {/* Quick Popout Button */}
            {(rootCause || capaNotes) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsFocusModalOpen(true);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '3px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  borderRadius: '4px',
                }}
                title="Expand Full Post-Mortem View"
              >
                <Maximize2 size={13} />
              </button>
            )}

            <div style={{ color: 'var(--text-muted)' }}>
              {isCapaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>

        {/* Expandable CAPA Content */}
        {isCapaOpen && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Mode A: Clean Reader View (When not editing and has content) */}
            {!isCapaEditing && capaNotes ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: 'var(--bg-surface-elevated, #ffffff)',
                  borderRadius: '6px',
                }}
              >
                <FormattedNotesView text={capaText} accentColor="#10b981" />

                {/* Reader View Footer Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '6px',
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    marginTop: '4px',
                    paddingTop: '6px',
                    borderTop: '1px solid var(--border-subtle, #f1f5f9)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {capaUpdatedAt && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                        <Clock size={11} /> {formatRelativeTime(capaUpdatedAt)}
                        {capaUpdatedBy?.fullName && ` by ${capaUpdatedBy.fullName}`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      onClick={handleCopyCapa}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '3px',
                        padding: '3px 7px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '4px',
                        backgroundColor: 'var(--bg-surface)',
                        color: copiedCapa ? '#10b981' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                      title="Copy CAPA Actions"
                    >
                      {copiedCapa ? <Check size={11} /> : <Copy size={11} />}
                      {copiedCapa ? 'Copied' : 'Copy'}
                    </button>

                    {!readonly && (
                      <button
                        type="button"
                        onClick={() => setIsCapaEditing(true)}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          padding: '3px 8px',
                          fontSize: '11px',
                          fontWeight: 600,
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: 'var(--bg-subtle, #f8fafc)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                        }}
                      >
                        <Edit3 size={11} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Mode B: Full-Height Auto-Expanding Editor */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {/* Quick Template Chips */}
                {!readonly && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '2px' }}>
                    {CAPA_CHIPS.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => {
                          if (capaText.includes(chip)) return;
                          const next = capaText ? `${capaText}\n• ${chip}: ` : `• ${chip}: `;
                          setCapaText(next);
                        }}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 500,
                          padding: '2px 7px',
                          borderRadius: '4px',
                          border: '1px solid var(--border-subtle, #e2e8f0)',
                          backgroundColor: 'var(--bg-subtle, #f8fafc)',
                          color: 'var(--text-secondary, #64748b)',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Auto-Expanding Textarea (No Scrollbars!) */}
                <textarea
                  ref={capaTextareaRef}
                  value={capaText}
                  disabled={readonly || isSavingCapa}
                  onChange={(e) => {
                    setCapaText(e.target.value);
                    autoResize(e.target);
                  }}
                  placeholder="Document corrective actions taken and preventive measures instituted..."
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    fontSize: '12.5px',
                    lineHeight: '1.5',
                    color: 'var(--text-primary)',
                    backgroundColor: readonly ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-medium)',
                    borderRadius: '6px',
                    outline: 'none',
                    resize: 'none',
                    overflow: 'hidden',
                    minHeight: '76px',
                    fontFamily: 'inherit',
                    transition: 'border-color 0.15s ease',
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = '#10b981')}
                  onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
                />

                {/* Editor Action Controls */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    gap: '6px',
                    fontSize: '11px',
                  }}
                >
                  {capaNotes && (
                    <button
                      type="button"
                      onClick={() => {
                        setCapaText(capaNotes || '');
                        setIsCapaEditing(false);
                      }}
                      disabled={isSavingCapa}
                      style={{
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  )}

                  {!readonly && (
                    <button
                      type="button"
                      onClick={handleSaveCapa}
                      disabled={!isCapaDirty || isSavingCapa}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '4px 10px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        borderRadius: '5px',
                        border: 'none',
                        backgroundColor: isCapaDirty ? '#10b981' : 'var(--bg-subtle, #f1f5f9)',
                        color: isCapaDirty ? '#ffffff' : 'var(--text-muted, #94a3b8)',
                        cursor: isCapaDirty && !isSavingCapa ? 'pointer' : 'not-allowed',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Save size={12} />
                      <span>{isSavingCapa ? 'Saving...' : 'Save CAPA'}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── 3. FULL FOCUS & DEEP READ MODAL ─── */}
      {isFocusModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            animation: 'fadeIn 0.15s ease-out',
          }}
          onClick={() => setIsFocusModalOpen(false)}
        >
          <div
            style={{
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: '12px',
              border: '1px solid var(--border-medium, #cbd5e1)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              width: '100%',
              maxWidth: '920px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: 'var(--bg-app, #f8fafc)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    color: 'var(--primary, #2563eb)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <FileText size={18} />
                </div>
                <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {ticketNumber && (
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'var(--primary, #2563eb)',
                        color: '#ffffff',
                        flexShrink: 0,
                      }}
                    >
                      #{ticketNumber}
                    </span>
                  )}
                  <h3
                    style={{
                      margin: 0,
                      fontSize: '14.5px',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                      maxWidth: '580px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    title={ticketSubject || 'Root Cause & CAPA'}
                  >
                    {ticketSubject || 'Root Cause (RCA) & CAPA Actions'}
                  </h3>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleCopyFullReport}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '6px 12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid var(--border-medium)',
                    backgroundColor: 'var(--bg-surface)',
                    color: copiedFullReport ? '#10b981' : 'var(--text-primary)',
                    cursor: 'pointer',
                  }}
                >
                  {copiedFullReport ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                  <span>{copiedFullReport ? 'Report Copied' : 'Copy Full Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFocusModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Spacious 2-Column or Stacked Layout */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                gap: '20px',
              }}
            >
              {/* Left Column: Root Cause Analysis */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.02)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(239, 68, 68, 0.12)',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <FileSearch size={14} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Root Cause Analysis (RCA)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyRca}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      padding: '3px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: copiedRca ? '#10b981' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {copiedRca ? <Check size={11} /> : <Copy size={11} />}
                    {copiedRca ? 'Copied' : 'Copy RCA'}
                  </button>
                </div>

                <div style={{ minHeight: '120px' }}>
                  <FormattedNotesView text={rcaText} accentColor="#ef4444" />
                </div>

                {rcaUpdatedAt && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(239, 68, 68, 0.1)', paddingTop: '8px' }}>
                    <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
                    Recorded {formatRelativeTime(rcaUpdatedAt)} {rcaUpdatedBy?.fullName ? `by ${rcaUpdatedBy.fullName}` : ''}
                  </div>
                )}
              </div>

              {/* Right Column: CAPA Actions */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'rgba(16, 185, 129, 0.02)',
                  border: '1px solid rgba(16, 185, 129, 0.15)',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                      style={{
                        width: '26px',
                        height: '26px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(16, 185, 129, 0.12)',
                        color: '#10b981',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <ShieldCheck size={14} />
                    </div>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Corrective & Preventive Actions (CAPA)
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyCapa}
                    style={{
                      background: 'transparent',
                      border: '1px solid var(--border-subtle)',
                      padding: '3px 8px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      color: copiedCapa ? '#10b981' : 'var(--text-muted)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    {copiedCapa ? <Check size={11} /> : <Copy size={11} />}
                    {copiedCapa ? 'Copied' : 'Copy CAPA'}
                  </button>
                </div>

                <div style={{ minHeight: '120px' }}>
                  <FormattedNotesView text={capaText} accentColor="#10b981" />
                </div>

                {capaUpdatedAt && (
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', borderTop: '1px solid rgba(16, 185, 129, 0.1)', paddingTop: '8px' }}>
                    <Clock size={11} style={{ display: 'inline', marginRight: '4px' }} />
                    Recorded {formatRelativeTime(capaUpdatedAt)} {capaUpdatedBy?.fullName ? `by ${capaUpdatedBy.fullName}` : ''}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border-subtle, #e2e8f0)',
                backgroundColor: 'var(--bg-app, #f8fafc)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11.5px',
                color: 'var(--text-muted)',
              }}
            >
              <span>Tip: Press <strong>Esc</strong> to close anytime</span>
              <button
                type="button"
                onClick={() => setIsFocusModalOpen(false)}
                className="btn btn-secondary"
                style={{ padding: '5px 14px', fontSize: '12px' }}
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

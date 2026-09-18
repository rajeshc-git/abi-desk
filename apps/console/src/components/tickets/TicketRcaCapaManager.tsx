import React, { useState, useEffect } from 'react';
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
  UserCheck,
} from 'lucide-react';
import { ApiClient } from '../../api/client';
import { useToast } from '../../context/ToastContext';

interface TicketRcaCapaManagerProps {
  ticketId: string;
  rootCause?: string | null;
  capaNotes?: string | null;
  rcaUpdatedAt?: string | null;
  capaUpdatedAt?: string | null;
  rcaUpdatedBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  capaUpdatedBy?: { id: string; fullName?: string | null; email?: string | null } | null;
  readonly?: boolean;
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

export const TicketRcaCapaManager: React.FC<TicketRcaCapaManagerProps> = ({
  ticketId,
  rootCause,
  capaNotes,
  rcaUpdatedAt,
  capaUpdatedAt,
  rcaUpdatedBy,
  capaUpdatedBy,
  readonly = false,
  onUpdate,
}) => {
  const toast = useToast();

  // RCA State
  const [rcaText, setRcaText] = useState(rootCause || '');
  const [isRcaOpen, setIsRcaOpen] = useState(Boolean(rootCause));
  const [isSavingRca, setIsSavingRca] = useState(false);
  const [copiedRca, setCopiedRca] = useState(false);

  // CAPA State
  const [capaText, setCapaText] = useState(capaNotes || '');
  const [isCapaOpen, setIsCapaOpen] = useState(Boolean(capaNotes));
  const [isSavingCapa, setIsSavingCapa] = useState(false);
  const [copiedCapa, setCopiedCapa] = useState(false);

  useEffect(() => {
    setRcaText(rootCause || '');
    if (rootCause && !isRcaOpen) setIsRcaOpen(true);
  }, [rootCause]);

  useEffect(() => {
    setCapaText(capaNotes || '');
    if (capaNotes && !isCapaOpen) setIsCapaOpen(true);
  }, [capaNotes]);

  const handleSaveRca = async () => {
    if (isSavingRca || readonly) return;
    setIsSavingRca(true);
    try {
      const res = await ApiClient.patch(`/tickets/${ticketId}`, { rootCause: rcaText });
      toast.success('Root Cause Analysis updated');
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

  const handleCopyRca = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!rcaText) return;
    navigator.clipboard.writeText(rcaText);
    setCopiedRca(true);
    setTimeout(() => setCopiedRca(false), 1800);
  };

  const handleCopyCapa = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!capaText) return;
    navigator.clipboard.writeText(capaText);
    setCopiedCapa(true);
    setTimeout(() => setCopiedCapa(false), 1800);
  };

  const isRcaDirty = rcaText !== (rootCause || '');
  const isCapaDirty = capaText !== (capaNotes || '');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* ─── 1. ROOT CAUSE ANALYSIS (RCA) CARD ─── */}
      <div
        className="card"
        style={{
          padding: 0,
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
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
            <div style={{ color: 'var(--text-muted)' }}>
              {isRcaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>

        {/* Expandable RCA Content */}
        {isRcaOpen && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
                      e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                      e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
                    }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={rcaText}
                disabled={readonly || isSavingRca}
                onChange={(e) => setRcaText(e.target.value)}
                placeholder="Identify root cause (e.g. backend sync failure due to corrupted payload format)..."
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  fontSize: '12px',
                  lineHeight: '1.45',
                  color: 'var(--text-primary)',
                  backgroundColor: readonly ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '64px',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary, #2563eb)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
              />
            </div>

            {/* Footer / Action Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--text-muted)',
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
                {rcaText && (
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
                      backgroundColor: 'transparent',
                      color: copiedRca ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Copy RCA Notes"
                  >
                    {copiedRca ? <Check size={11} /> : <Copy size={11} />}
                    {copiedRca ? 'Copied' : 'Copy'}
                  </button>
                )}

                {isRcaDirty && !readonly && (
                  <button
                    type="button"
                    onClick={() => setRcaText(rootCause || '')}
                    disabled={isSavingRca}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
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
                      backgroundColor: isRcaDirty ? 'var(--primary, #2563eb)' : 'var(--bg-subtle, #f1f5f9)',
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
          </div>
        )}
      </div>

      {/* ─── 2. CAPA (CORRECTIVE & PREVENTIVE ACTION) CARD ─── */}
      <div
        className="card"
        style={{
          padding: 0,
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
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
            <div style={{ color: 'var(--text-muted)' }}>
              {isCapaOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
          </div>
        </div>

        {/* Expandable CAPA Content */}
        {isCapaOpen && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
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
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--primary, #2563eb)';
                      e.currentTarget.style.color = 'var(--text-primary, #0f172a)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-subtle, #e2e8f0)';
                      e.currentTarget.style.color = 'var(--text-secondary, #64748b)';
                    }}
                  >
                    + {chip}
                  </button>
                ))}
              </div>
            )}

            {/* Textarea */}
            <div style={{ position: 'relative' }}>
              <textarea
                value={capaText}
                disabled={readonly || isSavingCapa}
                onChange={(e) => setCapaText(e.target.value)}
                placeholder="Document corrective actions taken and preventive measures instituted..."
                rows={3}
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '8px 10px',
                  fontSize: '12px',
                  lineHeight: '1.45',
                  color: 'var(--text-primary)',
                  backgroundColor: readonly ? 'var(--bg-subtle)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: '6px',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: '64px',
                  fontFamily: 'inherit',
                  transition: 'border-color 0.15s ease',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary, #2563eb)')}
                onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-medium)')}
              />
            </div>

            {/* Footer / Action Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px',
                fontSize: '11px',
                color: 'var(--text-muted)',
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
                {capaText && (
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
                      backgroundColor: 'transparent',
                      color: copiedCapa ? '#10b981' : 'var(--text-secondary)',
                      cursor: 'pointer',
                    }}
                    title="Copy CAPA Notes"
                  >
                    {copiedCapa ? <Check size={11} /> : <Copy size={11} />}
                    {copiedCapa ? 'Copied' : 'Copy'}
                  </button>
                )}

                {isCapaDirty && !readonly && (
                  <button
                    type="button"
                    onClick={() => setCapaText(capaNotes || '')}
                    disabled={isSavingCapa}
                    style={{
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 500,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: 'var(--text-muted)',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
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
          </div>
        )}
      </div>
    </div>
  );
};

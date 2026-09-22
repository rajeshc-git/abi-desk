import React, { useState, useEffect } from 'react';
import { GitMerge, X, Check, AlertCircle } from 'lucide-react';
import { StatusBadge, PriorityPill, TierBadge } from '../common/Badge';
import { ActionNoteBox } from '../common/ActionNoteBox';

export interface MergeTicketsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTickets: any[];
  onConfirmMerge: (primaryTicketId: string, secondaryTicketIds: string[], note?: string) => Promise<void>;
}

export const MergeTicketsModal: React.FC<MergeTicketsModalProps> = ({
  isOpen,
  onClose,
  selectedTickets,
  onConfirmMerge,
}) => {
  const [primaryId, setPrimaryId] = useState<string>('');
  const [mergeNote, setMergeNote] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize primaryId to the first ticket whenever the modal opens or selected tickets change
  useEffect(() => {
    if (selectedTickets.length > 0) {
      if (!selectedTickets.some((t) => t.id === primaryId)) {
        setPrimaryId(selectedTickets[0].id);
      }
    }
  }, [selectedTickets, isOpen]);

  if (!isOpen || selectedTickets.length < 2) return null;

  const primaryTicket = selectedTickets.find((t) => t.id === primaryId) || selectedTickets[0];
  const secondaryTickets = selectedTickets.filter((t) => t.id !== primaryId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!primaryId || secondaryTickets.length === 0) return;

    setError(null);
    setIsSubmitting(true);
    try {
      await onConfirmMerge(
        primaryId,
        secondaryTickets.map((t) => t.id),
        mergeNote.trim() || undefined,
      );
      setMergeNote('');
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to merge tickets.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '620px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#ffffff',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-lg)',
          border: '1px solid var(--border-subtle)',
          overflow: 'hidden',
          animation: 'console-fade-up 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'var(--primary-surface)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <GitMerge size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                Merge {selectedTickets.length} Tickets
              </h3>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                Select the primary ticket. All secondary tickets will be closed and linked into it.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="btn btn-ghost btn-sm"
            style={{ padding: '4px', color: 'var(--text-muted)' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          {/* Body content */}
          <div
            style={{
              padding: '20px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              flex: 1,
            }}
          >
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  color: '#b91c1c',
                  fontSize: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Explanatory banner */}
            <div
              style={{
                padding: '12px 14px',
                backgroundColor: 'var(--primary-surface)',
                border: '1px solid var(--primary-border)',
                borderRadius: '8px',
                fontSize: '12px',
                lineHeight: 1.45,
                color: 'var(--text-secondary)',
              }}
            >
              <strong style={{ color: 'var(--primary)' }}>How ticket merging works:</strong>
              <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
                <li>The <strong>Primary Ticket</strong> remains active and receives reference links & internal merge notes.</li>
                <li><strong>{secondaryTickets.length} secondary ticket(s)</strong> will be automatically marked <strong>CLOSED</strong>.</li>
                <li>You can easily <strong>Unmerge</strong> any ticket later from the ticket detail pane.</li>
              </ul>
            </div>

            {/* Ticket Selection List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Choose Destination (Primary / Master) Ticket:
              </label>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  paddingRight: '2px',
                }}
              >
                {selectedTickets.map((t) => {
                  const isPrimary = t.id === primaryId;
                  return (
                    <div
                      key={t.id}
                      onClick={() => setPrimaryId(t.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: isPrimary
                          ? '2px solid var(--primary)'
                          : '1px solid var(--border-subtle)',
                        backgroundColor: isPrimary ? 'rgba(37, 99, 235, 0.04)' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                        <input
                          type="radio"
                          name="primaryTicket"
                          checked={isPrimary}
                          onChange={() => setPrimaryId(t.id)}
                          style={{ cursor: 'pointer', accentColor: 'var(--primary)' }}
                        />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, fontSize: '12px', color: 'var(--primary)' }}>
                              #{t.number}
                            </span>
                            <StatusBadge status={t.status} />
                            <PriorityPill priority={t.priority} />
                            {t.tier && <TierBadge tier={t.tier} />}
                          </div>
                          <div
                            style={{
                              fontSize: '12px',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              marginTop: '2px',
                            }}
                          >
                            {t.subject}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Requester: {t.requester?.fullName || t.requester?.email || 'Unknown'}
                          </div>
                        </div>
                      </div>

                      <div style={{ marginLeft: '12px', flexShrink: 0 }}>
                        {isPrimary ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              backgroundColor: 'var(--primary)',
                              color: '#ffffff',
                              borderRadius: '4px',
                            }}
                          >
                            <Check size={12} /> Master Ticket
                          </span>
                        ) : (
                          <span
                            style={{
                              display: 'inline-block',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 600,
                              backgroundColor: '#f1f5f9',
                              color: '#64748b',
                              borderRadius: '4px',
                            }}
                          >
                            Will Merge & Close
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Merge Note / Reason */}
            <div className="form-group">
              <label className="form-label" htmlFor="mergeNote" style={{ marginBottom: '6px', display: 'block', fontWeight: 600 }}>
                Internal Merge Note <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(Optional)</span>
              </label>
              <ActionNoteBox
                value={mergeNote}
                onChange={setMergeNote}
                placeholder="e.g. • Merging duplicate user inquiries\n• Retaining primary issue context..."
                minRows={3}
                accentColor="#6366f1"
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '14px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: '#f8fafc',
            }}
          >
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Master: <strong style={{ color: 'var(--text-primary)' }}>#{primaryTicket?.number}</strong>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="btn btn-secondary btn-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !primaryId}
                className="btn btn-primary btn-sm"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <GitMerge size={13} />
                {isSubmitting ? 'Merging Tickets...' : `Confirm Merge (${selectedTickets.length} Tickets)`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

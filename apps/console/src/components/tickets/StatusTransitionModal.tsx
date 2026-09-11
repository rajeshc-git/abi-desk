import React, { useState } from 'react';
import { ArrowRight, X, Lock, CheckCircle2 } from 'lucide-react';
import { getStatusMeta } from './StatusPopover';

interface StatusTransitionModalProps {
  isOpen: boolean;
  ticketNumber: string | number;
  fromStatus: string;
  toStatus: string;
  onClose: () => void;
  onConfirm: (comment?: string) => Promise<void>;
  requiresComment?: boolean;
}

export const StatusTransitionModal: React.FC<StatusTransitionModalProps> = ({
  isOpen,
  ticketNumber,
  fromStatus,
  toStatus,
  onClose,
  onConfirm,
  requiresComment = false,
}) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const fromMeta = getStatusMeta(fromStatus);
  const toMeta = getStatusMeta(toStatus);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (requiresComment && !comment.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(comment.trim() || undefined);
      setComment('');
      onClose();
    } catch {
      // Error handled by parent toast
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
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '12px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.1)',
          border: '1px solid var(--border-medium, #e2e8f0)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
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
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
              Update Status — #{ticketNumber}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: fromMeta.color,
                  }}
                />
                {fromMeta.label}
              </span>
              <ArrowRight size={13} color="var(--text-muted, #94a3b8)" />
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  color: toMeta.color,
                }}
              >
                <span
                  style={{
                    width: '7px',
                    height: '7px',
                    borderRadius: '50%',
                    backgroundColor: toMeta.color,
                  }}
                />
                {toMeta.label}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted, #94a3b8)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: 'var(--text-primary, #0f172a)',
                marginBottom: '6px',
              }}
            >
              Transition Note / Rationale {requiresComment ? <span style={{ color: '#ef4444' }}>*</span> : <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>}
            </label>
            <p style={{ margin: '0 0 10px 0', fontSize: '12px', color: 'var(--text-muted, #64748b)', lineHeight: 1.4 }}>
              {toStatus === 'PENDING_CUSTOMER'
                ? 'Specify the information or action required from the customer. SLA timers will pause.'
                : toStatus === 'ON_HOLD'
                ? 'Specify the reason this ticket is put on hold (e.g., waiting for third-party vendor).'
                : toStatus === 'CANCELLED'
                ? 'Provide the reason for cancelling this ticket.'
                : `Add a note explaining why this ticket is moving to ${toMeta.label}.`}
            </p>
            <textarea
              required={requiresComment}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={`Enter note for transitioning to ${toMeta.label}...`}
              rows={4}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #cbd5e1)',
                backgroundColor: 'var(--bg-surface, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                fontSize: '13px',
                lineHeight: 1.4,
                resize: 'vertical',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              autoFocus
            />
          </div>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '12px',
              color: '#475569',
            }}
          >
            <Lock size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
            <span>This note will be safely logged in the ticket conversation timeline.</span>
          </div>

          {/* Modal Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '8px',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (requiresComment && !comment.trim())}
              className="btn btn-primary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <CheckCircle2 size={15} />
              {isSubmitting ? 'Updating...' : `Confirm Status → ${toMeta.label}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

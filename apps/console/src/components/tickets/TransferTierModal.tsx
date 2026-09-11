import React, { useState } from 'react';
import { ShieldAlert, ArrowRight, X, Lock } from 'lucide-react';
import { TierBadge } from '../common/Badge';

interface TransferTierModalProps {
  isOpen: boolean;
  ticketNumber: string;
  fromTier: string;
  toTier: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export const TransferTierModal: React.FC<TransferTierModalProps> = ({
  isOpen,
  ticketNumber,
  fromTier,
  toTier,
  onClose,
  onConfirm,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) return;
    setIsSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason('');
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
              Transfer Ticket #{ticketNumber}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <TierBadge tier={fromTier} />
              <ArrowRight size={14} color="var(--text-muted, #94a3b8)" />
              <TierBadge tier={toTier} />
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
              borderRadius: '4px',
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
                color: 'var(--text-primary, #1e293b)',
                marginBottom: '6px',
              }}
            >
              Transfer Reason & Hand-off Note <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              autoFocus
              rows={4}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={`Explain why this ticket is being moved to tier ${toTier} (e.g. Reproduction confirmed, escalating for backend logs...)`}
              style={{
                width: '100%',
                padding: '10px 12px',
                fontSize: '13px',
                borderRadius: '8px',
                border: '1px solid var(--border-medium, #cbd5e1)',
                backgroundColor: 'var(--bg-input, #ffffff)',
                color: 'var(--text-primary, #0f172a)',
                outline: 'none',
                resize: 'vertical',
                lineHeight: '1.5',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* Privacy Note */}
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '10px 12px',
              backgroundColor: '#fffbeb',
              border: '1px solid #fef3c7',
              borderRadius: '8px',
              color: '#92400e',
              fontSize: '12px',
              lineHeight: '1.4',
            }}
          >
            <Lock size={15} style={{ flexShrink: 0, marginTop: '2px', color: '#b45309' }} />
            <div>
              <strong>Internal Support Note:</strong> This note will be recorded as a private internal team note and will <u>not</u> be sent to the customer.
            </div>
          </div>

          {/* Action Buttons */}
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
              disabled={isSubmitting}
              className="btn btn-secondary btn-sm"
              style={{ padding: '8px 16px', fontSize: '13px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !reason.trim()}
              className="btn btn-primary btn-sm"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {isSubmitting ? 'Transferring...' : `Move to ${toTier}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

import React, { useEffect } from 'react';
import { Award, X, Sparkles, CheckCircle2 } from 'lucide-react';
import { fireCelebrationConfetti } from '../../utils/confetti';

export interface CelebrationData {
  agentId: string;
  agentName: string;
  adminName: string;
  timeframeLabel: string;
  resolvedCount: number;
  durationText?: string;
  celebratedAt?: string;
}

interface CelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: CelebrationData | null;
}

export const CelebrationModal: React.FC<CelebrationModalProps> = ({ isOpen, onClose, data }) => {
  useEffect(() => {
    if (isOpen && data) {
      fireCelebrationConfetti();
    }
  }, [isOpen, data]);

  if (!isOpen || !data) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(5px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.2s ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'var(--bg-surface, #ffffff)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Festive Header Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-hover, #1d4ed8) 100%)',
            padding: '28px 24px 20px',
            textAlign: 'center',
            position: 'relative',
            color: '#ffffff',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              border: 'none',
              background: 'rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={16} />
          </button>

          {/* Golden Trophy Icon */}
          <div
            style={{
              width: '64px',
              height: '64px',
              margin: '0 auto 12px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#713f12',
              boxShadow: '0 8px 20px rgba(234, 179, 8, 0.45)',
            }}
          >
            <Award size={36} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              padding: '3px 10px',
              borderRadius: '20px',
              marginBottom: '6px',
            }}
          >
            <Sparkles size={12} /> Top Performer Recognition
          </div>

          <h2 style={{ margin: '4px 0 2px', fontSize: '22px', fontWeight: 800, letterSpacing: '-0.02em' }}>
            Congratulations, {data.agentName}!
          </h2>
          <p style={{ margin: 0, fontSize: '12.5px', opacity: 0.9 }}>
            Recognized and celebrated by {data.adminName}
          </p>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Metrics Spotlight */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '12px',
            }}
          >
            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                Tickets Resolved
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                {data.resolvedCount}
              </div>
            </div>

            <div
              style={{
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                border: '1px solid var(--border-subtle, #e2e8f0)',
                borderRadius: '10px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: '11px', color: 'var(--text-muted, #64748b)', fontWeight: 600 }}>
                Timeframe
              </div>
              <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {data.timeframeLabel}
              </div>
            </div>
          </div>

          {data.durationText && (
            <div
              style={{
                fontSize: '11.5px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                backgroundColor: 'var(--bg-surface-elevated, #f8fafc)',
                padding: '6px 12px',
                borderRadius: '6px',
              }}
            >
              Period: {data.durationText}
            </div>
          )}

          {/* Appreciation Message */}
          <div
            style={{
              fontSize: '12.5px',
              lineHeight: 1.55,
              color: 'var(--text-secondary, #334155)',
              textAlign: 'center',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              padding: '14px 16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 700, color: '#15803d', marginBottom: '4px' }}>
              <CheckCircle2 size={15} /> Outstanding Customer Support
            </div>
            Thank you for your high resolution velocity, dedication, and exceptional service to our customers!
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={() => fireCelebrationConfetti()}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: '#fef3c7',
                color: '#92400e',
                border: '1px solid #fde68a',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <span>🎉</span> Celebrate Again!
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '12.5px',
                fontWeight: 700,
                backgroundColor: 'var(--primary, #2563eb)',
                color: '#ffffff',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              Thank You / Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { createPortal } from 'react-dom';
import { X, Megaphone, CheckCircle2, RotateCw, Sparkles } from 'lucide-react';

export interface BroadcastData {
  title?: string;
  message: string;
  adminName: string;
  targetAgentIds?: string[];
  broadcastAt?: string;
}

interface AnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: BroadcastData | null;
}

export const AnnouncementModal: React.FC<AnnouncementModalProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  if (!isOpen || !data) return null;

  const formattedTime = data.broadcastAt
    ? new Date(data.broadcastAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Just now';

  const isRefreshRecommendation =
    data.message.toLowerCase().includes('refresh') ||
    data.message.toLowerCase().includes('reload') ||
    data.message.toLowerCase().includes('update');

  const handleHardRefresh = async () => {
    try {
      if ('caches' in window) {
        const keys = await caches.keys().catch(() => []);
        await Promise.all(keys.map((k) => caches.delete(k))).catch(() => {});
      }
    } catch {}

    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.replace(url.toString());
  };

  const modalContent = (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(6px)',
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
        {/* Festive Header Banner with Brand Theme Colors */}
        <div
          style={{
            background: 'linear-gradient(135deg, var(--primary, #2563eb) 0%, var(--primary-hover, #1d4ed8) 100%)',
            padding: '24px 24px 18px',
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
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)')}
          >
            <X size={16} />
          </button>

          {/* Icon */}
          <div
            style={{
              width: '56px',
              height: '56px',
              margin: '0 auto 10px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #fef08a 0%, #facc15 50%, #eab308 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#713f12',
              boxShadow: '0 6px 16px rgba(234, 179, 8, 0.4)',
            }}
          >
            <Megaphone size={28} />
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              backdropFilter: 'blur(4px)',
              padding: '3px 10px',
              borderRadius: '20px',
              fontSize: '10.5px',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}
          >
            <Sparkles size={12} /> Team Announcement
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: '19px',
              fontWeight: 800,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            {data.title || 'Notice from Administrator'}
          </h2>
          <div style={{ fontSize: '11.5px', opacity: 0.9, marginTop: '3px' }}>
            Broadcast by {data.adminName} • {formattedTime}
          </div>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Main Broadcast Message */}
          <div
            style={{
              fontSize: '13.5px',
              lineHeight: 1.6,
              color: 'var(--text-primary, #0f172a)',
              backgroundColor: 'var(--bg-app, #f8fafc)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
              borderRadius: '10px',
              padding: '16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {data.message}
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
            {isRefreshRecommendation && (
              <button
                type="button"
                onClick={handleHardRefresh}
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
                <RotateCw size={14} /> Refresh Browser Now
              </button>
            )}

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
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                transition: 'all 0.15s ease',
              }}
            >
              <CheckCircle2 size={15} /> Acknowledge & Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

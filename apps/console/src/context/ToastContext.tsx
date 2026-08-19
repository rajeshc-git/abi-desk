import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}

export interface ToastContextType {
  success: (message: string, duration?: number) => void;
  error: (message: string, duration?: number) => void;
  info: (message: string, duration?: number) => void;
  warning: (message: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, type: Toast['type'], duration = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      setTimeout(() => {
        removeToast(id);
      }, duration);
    },
    [removeToast],
  );

  const success = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'success', duration);
    },
    [addToast],
  );

  const error = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'error', duration);
    },
    [addToast],
  );

  const info = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'info', duration);
    },
    [addToast],
  );

  const warning = useCallback(
    (message: string, duration?: number) => {
      addToast(message, 'warning', duration);
    },
    [addToast],
  );
  const value = useMemo(
    () => ({ success, error, info, warning }),
    [success, error, info, warning]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast Overlay Container */}
      <div
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          maxWidth: '360px',
          width: '100%',
          pointerEvents: 'none',
        }}
      >
        {toasts.map((toast) => {
          let Icon = Info;
          let color = 'var(--primary)';
          let bg = 'rgba(15, 23, 42, 0.85)';
          let border = 'var(--primary-border)';

          if (toast.type === 'success') {
            Icon = CheckCircle2;
            color = 'var(--primary)';
            border = 'var(--primary-border)';
          } else if (toast.type === 'error') {
            Icon = XCircle;
            color = '#ef4444'; // Red
            border = 'rgba(239, 68, 68, 0.25)';
          } else if (toast.type === 'warning') {
            Icon = AlertTriangle;
            color = '#f59e0b'; // Amber
            border = 'rgba(245, 158, 11, 0.25)';
          }

          return (
            <div
              key={toast.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: bg,
                backdropFilter: 'blur(12px)',
                border: `1px solid ${border}`,
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -4px rgba(0, 0, 0, 0.3)',
                color: '#f8fafc',
                pointerEvents: 'auto',
                position: 'relative',
                overflow: 'hidden',
                animation: 'toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                userSelect: 'none',
              }}
            >
              <Icon size={18} style={{ color, flexShrink: 0, marginTop: '2px' }} />

              <div style={{ flex: 1, fontSize: '13px', fontWeight: 500, lineHeight: 1.4 }}>
                {toast.message}
              </div>

              <button
                onClick={() => removeToast(toast.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color 0.15s ease',
                  marginTop: '2px',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f8fafc')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
              >
                <X size={14} />
              </button>

              {/* Progress Bar Animation */}
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  height: '3px',
                  backgroundColor: color,
                  animation: `toast-progress ${toast.duration}ms linear forwards`,
                  width: '100%',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Inject Keyframe Animations dynamically */}
      <style>{`
        @keyframes toast-slide-in {
          from {
            transform: translateX(120%) scale(0.9);
            opacity: 0;
          }
          to {
            transform: translateX(0) scale(1);
            opacity: 1;
          }
        }
        @keyframes toast-progress {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
};

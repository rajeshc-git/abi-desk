import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ size?: number; text?: string; inline?: boolean }> = ({
  size = 24,
  text,
  inline,
}) => {
  const isInline = inline || (size <= 18 && !text);

  if (isInline) {
    return (
      <Loader2
        size={size}
        style={{
          animation: 'spin 1s linear infinite',
          color: 'currentColor',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '32px',
      }}
    >
      <Loader2
        size={size}
        style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }}
      />
      {text && <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{text}</span>}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

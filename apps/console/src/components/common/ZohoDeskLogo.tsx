import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
}

export const ZohoDeskLogo: React.FC<LogoProps> = ({
  size = 34,
  showText = true,
  className = '',
}) => {
  return (
    <div
      className={`logo-container ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}
    >
      {/* Zoho Desk Inspired Multi-Layered Origami Ticket Ribbon Icon */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <defs>
          <linearGradient id="zohoRed" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#dc2626" />
          </linearGradient>
          <linearGradient id="zohoBlue" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="zohoGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#047857" />
          </linearGradient>
          <linearGradient id="zohoYellow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>
        </defs>

        {/* Outer Folded Ribbon Desk Container */}
        <rect x="4" y="6" width="18" height="18" rx="5" fill="url(#zohoRed)" />
        <rect x="26" y="6" width="18" height="18" rx="5" fill="url(#zohoGreen)" />
        <rect x="4" y="26" width="18" height="18" rx="5" fill="url(#zohoBlue)" />
        <rect x="26" y="26" width="18" height="18" rx="5" fill="url(#zohoYellow)" />

        {/* Center Support Desk Headphones / Checkmark Overlay */}
        <circle cx="24" cy="24" r="9" fill="#ffffff" />
        <path
          d="M19.5 24L22.5 27L28.5 21"
          stroke="var(--primary)"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>

      {showText && (
        <span
          style={{
            fontSize: '18px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: '#0f172a',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <span>ABI</span>
          <span
            style={{
              color: 'var(--primary)',
              backgroundColor: 'var(--primary-surface)',
              padding: '2px 7px',
              borderRadius: '6px',
              fontSize: '15px',
              fontWeight: 700,
            }}
          >
            DESK
          </span>
        </span>
      )}
    </div>
  );
};

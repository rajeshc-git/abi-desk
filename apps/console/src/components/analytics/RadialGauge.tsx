import React, { useId } from 'react';

interface RadialGaugeProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  target?: number;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  percentage,
  size = 140,
  strokeWidth = 12,
  label = 'SLA Met',
  sublabel,
  color,
  target,
}) => {
  const gaugeId = useId();
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const validPercentage = Math.min(Math.max(percentage, 0), 100);
  const strokeDashoffset = circumference - (validPercentage / 100) * circumference;

  // Auto color mapping if not provided
  let gaugeColor = color;
  if (!gaugeColor) {
    if (validPercentage >= 90)
      gaugeColor = '#10b981'; // Green
    else if (validPercentage >= 75)
      gaugeColor = '#f59e0b'; // Amber
    else gaugeColor = '#ef4444'; // Red
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <defs>
            <linearGradient id={`gauge-grad-${gaugeId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={gaugeColor} stopOpacity="1" />
              <stop offset="100%" stopColor={gaugeColor} stopOpacity="0.75" />
            </linearGradient>
            <filter id={`gauge-shadow-${gaugeId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="3"
                floodColor={gaugeColor}
                floodOpacity="0.3"
              />
            </filter>
          </defs>

          {/* Background Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--bg-surface-elevated, #334155)"
            strokeWidth={strokeWidth}
            fill="transparent"
            opacity="0.4"
          />

          {/* Value Progress Ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={`url(#gauge-grad-${gaugeId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            filter={`url(#gauge-shadow-${gaugeId})`}
            style={{
              transition: 'stroke-dashoffset 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          />
        </svg>

        {/* Center Content */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontSize: `${Math.round(size * 0.22)}px`,
              fontWeight: 800,
              color: 'var(--text-primary)',
            }}
          >
            {percentage}%
          </span>
          {label && (
            <span
              style={{
                fontSize: `${Math.max(Math.round(size * 0.08), 10)}px`,
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              {label}
            </span>
          )}
        </div>
      </div>

      {sublabel && (
        <div
          style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--text-secondary)',
            textAlign: 'center',
          }}
        >
          {sublabel}
        </div>
      )}
      {target !== undefined && (
        <div
          style={{
            marginTop: '2px',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-muted)',
          }}
        >
          Target: &gt;{target}%
        </div>
      )}
    </div>
  );
};

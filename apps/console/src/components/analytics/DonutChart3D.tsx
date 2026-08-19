import React, { useState, useId } from 'react';

export interface DonutSegment {
  label: string;
  count: number;
  color: string;
}

interface DonutChart3DProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  title?: string;
  centerText?: string;
  centerSubtext?: string;
}

export const DonutChart3D: React.FC<DonutChart3DProps> = ({
  segments,
  size = 180,
  thickness = 22,
  title,
  centerText,
  centerSubtext,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const donutId = useId();

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  if (total === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: size,
        }}
      >
        {title && (
          <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '8px' }}>{title}</h4>
        )}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          No distribution records available
        </div>
      </div>
    );
  }

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculate segment offsets
  let accumulatedPercent = 0;
  const processedSegments = segments.map((seg, idx) => {
    const percent = seg.count / total;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -accumulatedPercent * circumference;
    accumulatedPercent += percent;

    return {
      ...seg,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
      index: idx,
    };
  });

  const activeSegment = hoveredIndex !== null ? processedSegments[hoveredIndex] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {title && (
        <h4 style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px' }}>{title}</h4>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          gap: '16px',
          flexWrap: 'wrap',
        }}
      >
        {/* SVG Circle */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
          <svg
            width={size}
            height={size}
            style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}
          >
            <defs>
              <filter id={`donut-shadow-${donutId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.3" />
              </filter>
            </defs>

            {/* Base Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--bg-surface-elevated, #1e293b)"
              strokeWidth={thickness}
              fill="transparent"
              opacity="0.3"
            />

            {/* Segment Arcs */}
            {processedSegments.map((seg, i) => {
              const isHovered = hoveredIndex === i;
              return (
                <circle
                  key={i}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  stroke={seg.color}
                  strokeWidth={isHovered ? thickness + 4 : thickness}
                  strokeDasharray={seg.strokeDasharray}
                  strokeDashoffset={seg.strokeDashoffset}
                  fill="transparent"
                  filter={`url(#donut-shadow-${donutId})`}
                  style={{
                    cursor: 'pointer',
                    transition: 'stroke-width 0.2s ease, opacity 0.2s ease',
                    opacity: hoveredIndex === null || isHovered ? 1 : 0.6,
                  }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />
              );
            })}
          </svg>

          {/* Center Text Indicator */}
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
              pointerEvents: 'none',
            }}
          >
            <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
              {activeSegment ? activeSegment.count : centerText || total}
            </span>
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
              }}
            >
              {activeSegment
                ? `${activeSegment.label} (${activeSegment.percent}%)`
                : centerSubtext || 'Total'}
            </span>
          </div>
        </div>

        {/* Legend List */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flex: 1,
            minWidth: '130px',
          }}
        >
          {processedSegments.map((seg, idx) => (
            <div
              key={idx}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor:
                  hoveredIndex === idx ? 'var(--bg-surface-elevated)' : 'transparent',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: seg.color,
                  }}
                />
                <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{seg.label}</span>
              </div>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                {seg.count}{' '}
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}>
                  ({seg.percent}%)
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

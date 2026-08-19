import React, { useState, useId } from 'react';

export interface TimePoint {
  date: string;
  day?: string;
  created: number;
  resolved: number;
  breached?: number;
}

interface TimeAreaChartProps {
  data: TimePoint[];
  height?: number;
  title?: string;
}

export const TimeAreaChart: React.FC<TimeAreaChartProps> = ({
  data,
  height = 240,
  title = 'Ticket Inflow vs Resolution Velocity',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const chartId = useId();

  if (!data || data.length === 0) {
    return (
      <div
        style={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-muted)',
          fontSize: '13px',
        }}
      >
        No time-series data available for the selected timeframe.
      </div>
    );
  }

  const width = 700;
  const padding = { top: 20, right: 24, bottom: 36, left: 36 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Max value for scaling
  const maxVal = Math.max(...data.map((d) => Math.max(d.created, d.resolved, d.breached || 0)), 5);

  const getX = (index: number) => {
    if (data.length === 1) return padding.left + chartWidth / 2;
    return padding.left + (index / (data.length - 1)) * chartWidth;
  };

  const getY = (val: number) => {
    return padding.top + chartHeight - (val / maxVal) * chartHeight;
  };

  // Helper to generate smooth cubic bezier path
  const generatePath = (values: number[]) => {
    if (values.length === 0) return '';
    const points = values.map((val, i) => ({ x: getX(i), y: getY(val) }));
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = i > 0 ? points[i - 1] : points[i];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i != points.length - 2 ? points[i + 2] : p2;

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return path;
  };

  const createdPath = generatePath(data.map((d) => d.created));
  const resolvedPath = generatePath(data.map((d) => d.resolved));

  const firstX = getX(0);
  const lastX = getX(data.length - 1);
  const bottomY = padding.top + chartHeight;

  const createdArea = `${createdPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
  const resolvedArea = `${resolvedPath} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;

  // Grid lines
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = padding.top + chartHeight * (1 - ratio);
    const value = Math.round(maxVal * ratio);
    return { y, value };
  });

  const activePoint = hoverIndex !== null ? data[hoverIndex] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Header & Legend */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>{title}</h3>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                backgroundColor: '#3b82f6',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Created / Inflow</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                backgroundColor: '#10b981',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>Resolved</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                backgroundColor: '#ef4444',
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>SLA Breaches</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas Area */}
      <div style={{ position: 'relative', width: '100%', height }}>
        <svg
          viewBox={`0 0 ${width} ${height}`}
          style={{ width: '100%', height: '100%', overflow: 'visible', cursor: 'crosshair' }}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <defs>
            <linearGradient id={`grad-created-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id={`grad-resolved-${chartId}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
            </linearGradient>
            <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.3" />
            </filter>
          </defs>

          {/* Grid lines & Y-axis labels */}
          {gridLines.map((g, idx) => (
            <g key={idx}>
              <line
                x1={padding.left}
                y1={g.y}
                x2={padding.left + chartWidth}
                y2={g.y}
                stroke="var(--border-subtle)"
                strokeDasharray={idx === 0 ? '0' : '4 4'}
                strokeWidth={idx === 0 ? 1.5 : 1}
              />
              <text
                x={padding.left - 8}
                y={g.y + 4}
                textAnchor="end"
                fontSize="10"
                fill="var(--text-muted)"
                fontWeight="500"
              >
                {g.value}
              </text>
            </g>
          ))}

          {/* Filled Areas */}
          <path d={createdArea} fill={`url(#grad-created-${chartId})`} />
          <path d={resolvedArea} fill={`url(#grad-resolved-${chartId})`} />

          {/* Stroke Lines */}
          <path
            d={createdPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={resolvedPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* X-axis ticks */}
          {data.map((d, i) => {
            const x = getX(i);
            const showLabel = data.length <= 14 || i % Math.ceil(data.length / 10) === 0;
            return (
              <g key={i}>
                {showLabel && (
                  <text
                    x={x}
                    y={height - 10}
                    textAnchor="middle"
                    fontSize="10"
                    fill="var(--text-muted)"
                    fontWeight={i === hoverIndex ? '700' : '500'}
                  >
                    {d.date}
                  </text>
                )}
                {/* Invisible hover bar trigger */}
                <rect
                  x={x - chartWidth / data.length / 2}
                  y={padding.top}
                  width={chartWidth / data.length}
                  height={chartHeight}
                  fill="transparent"
                  onMouseEnter={() => setHoverIndex(i)}
                />
              </g>
            );
          })}

          {/* Active Hover Crosshair Line & Dots */}
          {hoverIndex !== null && activePoint && (
            <g>
              <line
                x1={getX(hoverIndex)}
                y1={padding.top}
                x2={getX(hoverIndex)}
                y2={bottomY}
                stroke="var(--primary)"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(activePoint.created)}
                r="5"
                fill="#3b82f6"
                stroke="#ffffff"
                strokeWidth="2"
              />
              <circle
                cx={getX(hoverIndex)}
                cy={getY(activePoint.resolved)}
                r="5"
                fill="#10b981"
                stroke="#ffffff"
                strokeWidth="2"
              />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoverIndex !== null && activePoint && (
          <div
            style={{
              position: 'absolute',
              top: '12px',
              left: `${Math.min(Math.max((getX(hoverIndex) / width) * 100, 15), 85)}%`,
              transform: 'translateX(-50%)',
              backgroundColor: 'var(--bg-surface-elevated, #1e293b)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-md)',
              padding: '8px 12px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
              pointerEvents: 'none',
              zIndex: 10,
              fontSize: '12px',
              minWidth: '150px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <div
              style={{
                fontWeight: 700,
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '4px',
                marginBottom: '6px',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}
            >
              {activePoint.date} {activePoint.day ? `(${activePoint.day})` : ''}
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                color: '#60a5fa',
                fontWeight: 600,
              }}
            >
              <span>Created:</span>
              <span>{activePoint.created}</span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px',
                color: '#34d399',
                fontWeight: 600,
              }}
            >
              <span>Resolved:</span>
              <span>{activePoint.resolved}</span>
            </div>
            {(activePoint.breached ?? 0) > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  color: '#f87171',
                  fontWeight: 600,
                }}
              >
                <span>Breached:</span>
                <span>{activePoint.breached}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

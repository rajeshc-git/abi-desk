import React, { useState } from 'react';

interface InflowHeatmapProps {
  matrix: number[][]; // 7 days x 24 hours
  days?: string[];
  maxCount: number;
  totalSampled?: number;
}

export const InflowHeatmap: React.FC<InflowHeatmapProps> = ({
  matrix,
  days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  maxCount = 1,
  totalSampled = 0,
}) => {
  const [hoveredCell, setHoveredCell] = useState<{
    day: string;
    hour: number;
    count: number;
  } | null>(null);

  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getColor = (count: number) => {
    if (count === 0) return 'var(--bg-surface-elevated, #1e293b)';
    const intensity = Math.min(count / maxCount, 1);
    if (intensity < 0.25) return 'rgba(59, 130, 246, 0.35)'; // Light blue
    if (intensity < 0.5) return 'rgba(59, 130, 246, 0.7)'; // Blue
    if (intensity < 0.75) return 'rgba(16, 185, 129, 0.85)'; // Emerald
    return '#f59e0b'; // Amber hot peak
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '14px',
        }}
      >
        <div>
          <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>
            Peak Ticket Inflow Heatmap
          </h3>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Identifies peak traffic hours to optimize agent staffing and shift schedules (
            {totalSampled} tickets analyzed)
          </p>
        </div>

        {/* Intensity Legend */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}
        >
          <span>Low</span>
          <div style={{ display: 'flex', gap: '3px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: 'var(--bg-surface-elevated)',
              }}
            />
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: 'rgba(59, 130, 246, 0.35)',
              }}
            />
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
              }}
            />
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: 'rgba(16, 185, 129, 0.85)',
              }}
            />
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '2px',
                backgroundColor: '#f59e0b',
              }}
            />
          </div>
          <span>Peak</span>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ minWidth: '600px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {/* Hour Headers */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '45px repeat(24, 1fr)',
              gap: '4px',
              marginBottom: '2px',
            }}
          >
            <div />
            {hours.map((h) => (
              <div
                key={h}
                style={{
                  fontSize: '9px',
                  fontWeight: 600,
                  color: 'var(--text-muted)',
                  textAlign: 'center',
                }}
              >
                {h % 3 === 0 ? `${h}h` : ''}
              </div>
            ))}
          </div>

          {/* Days & Cells */}
          {days.map((dayName, dayIdx) => (
            <div
              key={dayName}
              style={{
                display: 'grid',
                gridTemplateColumns: '45px repeat(24, 1fr)',
                gap: '4px',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {dayName}
              </span>
              {hours.map((h) => {
                const count = matrix[dayIdx]?.[h] ?? 0;
                return (
                  <div
                    key={h}
                    onMouseEnter={() => setHoveredCell({ day: dayName, hour: h, count })}
                    onMouseLeave={() => setHoveredCell(null)}
                    style={{
                      height: '18px',
                      borderRadius: '3px',
                      backgroundColor: getColor(count),
                      border: '1px solid var(--border-subtle)',
                      cursor: 'pointer',
                      transition: 'transform 0.15s ease, filter 0.15s ease',
                      transform:
                        hoveredCell?.day === dayName && hoveredCell?.hour === h
                          ? 'scale(1.25)'
                          : 'scale(1)',
                      zIndex: hoveredCell?.day === dayName && hoveredCell?.hour === h ? 5 : 1,
                    }}
                    title={`${dayName} at ${h}:00 - ${count} tickets`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Floating Hover Badge */}
      <div style={{ height: '20px', marginTop: '8px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {hoveredCell ? (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--primary)',
              textAlign: 'right',
            }}
          >
            {hoveredCell.day} at {hoveredCell.hour}:00 &rarr; {hoveredCell.count} ticket
            {hoveredCell.count === 1 ? '' : 's'} received
          </div>
        ) : (
          <div
            style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              textAlign: 'right',
              fontStyle: 'italic',
            }}
          >
            Hover over a cell to view specific hourly volume
          </div>
        )}
      </div>
    </div>
  );
};

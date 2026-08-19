import React, { useEffect, useState } from 'react';
import { Clock, PauseCircle, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface SlaClockData {
  kind: 'FIRST_RESPONSE' | 'RESOLUTION';
  state: 'RUNNING' | 'PAUSED' | 'MET' | 'BREACHED';
  targetDurationSeconds: number;
  elapsedSeconds: number;
  breachAt?: string | null;
  metAt?: string | null;
}

interface SlaCountdownProps {
  clocks?: SlaClockData[];
  ticketStatus: string;
}

export const SlaCountdown: React.FC<SlaCountdownProps> = ({ clocks = [], ticketStatus }) => {
  const [, setTick] = useState(0);

  // Re-render every second for live countdown
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatRemaining = (
    targetSecs: number,
    elapsedSecs: number,
    breachAt?: string | null,
    state?: string,
  ) => {
    if (state === 'MET') return { text: 'Met', statusClass: 'on-track', icon: CheckCircle2 };
    if (state === 'BREACHED')
      return { text: 'Breached', statusClass: 'breached', icon: AlertTriangle };
    if (state === 'PAUSED' || ticketStatus === 'PENDING_CUSTOMER') {
      return { text: 'Paused (Waiting on Customer)', statusClass: 'paused', icon: PauseCircle };
    }

    if (breachAt) {
      const remainingMs = new Date(breachAt).getTime() - Date.now();
      if (remainingMs <= 0)
        return { text: 'Breached', statusClass: 'breached', icon: AlertTriangle };

      const totalSecs = Math.floor(remainingMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;

      const timeStr = `${hours > 0 ? `${hours}h ` : ''}${mins}m ${secs}s`;
      const isAtRisk = totalSecs < 1800; // < 30 mins
      return {
        text: `${timeStr} left`,
        statusClass: isAtRisk ? 'at-risk' : 'on-track',
        icon: isAtRisk ? AlertTriangle : Clock,
      };
    }

    const remainingSecs = Math.max(0, targetDurationSecondsOrDefault(targetSecs) - elapsedSecs);
    const mins = Math.floor(remainingSecs / 60);
    return { text: `${mins}m left`, statusClass: 'on-track', icon: Clock };
  };

  const targetDurationSecondsOrDefault = (sec: number) => sec || 3600;

  const responseClock = clocks.find((c) => c.kind === 'FIRST_RESPONSE');
  const resolutionClock = clocks.find((c) => c.kind === 'RESOLUTION');

  const respInfo = responseClock
    ? formatRemaining(
        responseClock.targetDurationSeconds,
        responseClock.elapsedSeconds,
        responseClock.breachAt,
        responseClock.state,
      )
    : { text: '4h Target', statusClass: 'on-track', icon: Clock };

  const resInfo = resolutionClock
    ? formatRemaining(
        resolutionClock.targetDurationSeconds,
        resolutionClock.elapsedSeconds,
        resolutionClock.breachAt,
        resolutionClock.state,
      )
    : { text: '24h Target', statusClass: 'on-track', icon: Clock };

  const RespIcon = respInfo.icon;
  const ResIcon = resInfo.icon;

  return (
    <div className="sla-clock-widget">
      <div className="sla-metric">
        <span className="sla-title">First Response SLA</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RespIcon size={14} className={`sla-value ${respInfo.statusClass}`} />
          <span className={`sla-value ${respInfo.statusClass}`}>{respInfo.text}</span>
        </div>
      </div>

      <div style={{ width: '1px', height: '28px', backgroundColor: 'var(--border-subtle)' }} />

      <div className="sla-metric">
        <span className="sla-title">Resolution SLA</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <ResIcon size={14} className={`sla-value ${resInfo.statusClass}`} />
          <span className={`sla-value ${resInfo.statusClass}`}>{resInfo.text}</span>
        </div>
      </div>
    </div>
  );
};

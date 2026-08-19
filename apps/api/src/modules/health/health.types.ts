export type ProbeStatus = 'up' | 'down';

export interface ProbeResult {
  status: ProbeStatus;
  latencyMs: number;
  /** Present only when `status` is `down`. Safe to surface: no secrets. */
  error?: string;
}

export interface LivenessReport {
  status: 'ok';
  service: string;
  version: string;
  role: 'api' | 'worker';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessReport {
  /** `ok` when every dependency answered; `degraded` when any did not. */
  status: 'ok' | 'degraded';
  service: string;
  version: string;
  role: 'api' | 'worker';
  uptimeSeconds: number;
  timestamp: string;
  checks: Record<string, ProbeResult>;
}

/** A named dependency check. Registered by `HealthService`. */
export interface HealthProbe {
  name: string;
  execute(): Promise<void>;
}

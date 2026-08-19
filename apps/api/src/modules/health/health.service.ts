import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { RedisService } from '../../infra/redis/redis.service';
import {
  type HealthProbe,
  type LivenessReport,
  type ProbeResult,
  type ReadinessReport,
} from './health.types';

/**
 * Liveness and readiness reporting.
 *
 * Deliberately hand-rolled rather than pulled from a health-check library: the
 * behaviour we need is a bounded-time parallel fan-out over a handful of probes,
 * and owning it means the timeout semantics are explicit and unit-testable
 * instead of implied by a third-party version.
 *
 * Semantics:
 *  - liveness  -> "is this process running?"   Never touches dependencies, so
 *                 an orchestrator does not kill a healthy pod during a brief
 *                 database blip.
 *  - readiness -> "should this process receive traffic?" Fails if a hard
 *                 dependency is unreachable, taking the instance out of the load
 *                 balancer rotation.
 */
@Injectable()
export class HealthService {
  private readonly probes: HealthProbe[];

  constructor(
    private readonly config: AppConfig,
    prisma: PrismaService,
    redis: RedisService,
  ) {
    this.probes = [
      { name: 'database', execute: () => prisma.ping() },
      { name: 'redis', execute: () => redis.ping() },
    ];
  }

  liveness(): LivenessReport {
    return {
      status: 'ok',
      service: this.config.app.name,
      version: this.config.app.version,
      role: this.config.app.processRole,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async readiness(): Promise<ReadinessReport> {
    const timeoutMs = this.config.ops.healthProbeTimeoutMs;

    const results = await Promise.all(
      this.probes.map(async (probe) => ({
        name: probe.name,
        result: await this.runProbe(probe, timeoutMs),
      })),
    );

    const checks: Record<string, ProbeResult> = {};
    for (const { name, result } of results) {
      checks[name] = result;
    }

    const degraded = results.some(({ result }) => result.status === 'down');

    return {
      status: degraded ? 'degraded' : 'ok',
      service: this.config.app.name,
      version: this.config.app.version,
      role: this.config.app.processRole,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
      checks,
    };
  }

  /**
   * Runs a probe under a hard deadline.
   *
   * A hung TCP connection is the common failure mode, and without a timeout the
   * readiness endpoint itself hangs - which then trips the orchestrator's own
   * probe timeout with no diagnostic information.
   */
  private async runProbe(probe: HealthProbe, timeoutMs: number): Promise<ProbeResult> {
    const startedAt = process.hrtime.bigint();
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        probe.execute(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Probe timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);

      return { status: 'up', latencyMs: elapsedMs(startedAt) };
    } catch (error: unknown) {
      return {
        status: 'down',
        latencyMs: elapsedMs(startedAt),
        error: error instanceof Error ? error.message : 'Unknown probe failure',
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function elapsedMs(startedAt: bigint): number {
  return Number((process.hrtime.bigint() - startedAt) / 1_000n) / 1_000;
}

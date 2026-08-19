import { Controller, Get, HttpStatus, Res, VERSION_NEUTRAL } from '@nestjs/common';
import { type FastifyReply } from 'fastify';
import { Public, SkipCsrf } from '../../common/auth/auth.decorators';
import { HealthService } from './health.service';
import { type LivenessReport, type ReadinessReport } from './health.types';

/**
 * Probe endpoints.
 *
 * Mounted outside the versioned `/api/v1` prefix because orchestrators, load
 * balancers and Docker healthchecks should not have to track API versions.
 *
 * Two things are required to achieve that, and both are easy to miss:
 *   1. `setGlobalPrefix(..., { exclude: [...] })` drops the `/api` prefix, and
 *   2. `VERSION_NEUTRAL` drops the `/v1` segment.
 * Without (2) the routes resolve to `/v1/healthz` and every probe 404s.
 */
/**
 * Probes must be unauthenticated. A load balancer or Docker healthcheck has no
 * credentials, and requiring them would report a perfectly healthy process as down -
 * which is precisely what happened the first time the global auth guard was enabled.
 */
@Public()
@SkipCsrf()
@Controller({ version: VERSION_NEUTRAL })
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /** Liveness: process is up and the event loop is responsive. */
  @Get('healthz')
  liveness(): LivenessReport {
    return this.health.liveness();
  }

  /**
   * Readiness: every hard dependency answered within the probe timeout.
   * Returns 503 when degraded so upstream routing drains this instance.
   */
  @Get('readyz')
  async readiness(@Res({ passthrough: true }) reply: FastifyReply): Promise<ReadinessReport> {
    const report = await this.health.readiness();

    reply.status(report.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return report;
  }
}

import { describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/app-config';
import { loadEnv } from '../../config/env.schema';
import { type PrismaService } from '../../infra/prisma/prisma.service';
import { type RedisService } from '../../infra/redis/redis.service';
import { HealthService } from './health.service';

const BASE_ENV: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://app:pw@localhost:5432/abidesk',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'http://localhost:9000',
  S3_ACCESS_KEY_ID: 'test-key',
  S3_SECRET_ACCESS_KEY: 'test-secret',
  // 32 bytes of base64, as the schema requires.
  APP_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
  // The env contract requires these; values are irrelevant to the health probes but
  // `loadEnv` validates the whole schema, so an incomplete fixture fails at parse time.
  JWT_ACCESS_SECRET: 'test-access-secret-at-least-32-characters-long',
  JWT_REFRESH_SECRET: 'test-refresh-secret-at-least-32-characters-long',
};

function buildService(options: {
  ping?: () => Promise<void>;
  redisPing?: () => Promise<void>;
  timeoutMs?: number;
}) {
  const config = new AppConfig(
    loadEnv({
      ...BASE_ENV,
      ...(options.timeoutMs ? { HEALTH_PROBE_TIMEOUT_MS: String(options.timeoutMs) } : {}),
    }),
  );

  const prismaPing = vi.fn(options.ping ?? (() => Promise.resolve()));
  const redisPing = vi.fn(options.redisPing ?? (() => Promise.resolve()));

  const service = new HealthService(
    config,
    { ping: prismaPing } as unknown as PrismaService,
    { ping: redisPing } as unknown as RedisService,
  );

  return { service, prismaPing, redisPing };
}

describe('HealthService', () => {
  describe('liveness', () => {
    it('reports ok without touching any dependency', () => {
      const { service, prismaPing, redisPing } = buildService({});

      const report = service.liveness();

      expect(report.status).toBe('ok');
      expect(report.role).toBe('api');
      expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
      // The whole point of liveness: a database outage must not kill the process.
      expect(prismaPing).not.toHaveBeenCalled();
      expect(redisPing).not.toHaveBeenCalled();
    });
  });

  describe('readiness', () => {
    it('reports ok when every probe succeeds', async () => {
      const { service, prismaPing, redisPing } = buildService({});

      const report = await service.readiness();

      expect(report.status).toBe('ok');
      expect(report.checks.database?.status).toBe('up');
      expect(report.checks.redis?.status).toBe('up');
      expect(prismaPing).toHaveBeenCalledOnce();
      expect(redisPing).toHaveBeenCalledOnce();
    });

    it('reports degraded and names the failing dependency', async () => {
      const { service } = buildService({
        ping: () => Promise.reject(new Error('connection refused')),
      });

      const report = await service.readiness();

      expect(report.status).toBe('degraded');
      expect(report.checks.database).toMatchObject({
        status: 'down',
        error: 'connection refused',
      });
      // A failing database must not mask a healthy Redis - operators need both.
      expect(report.checks.redis?.status).toBe('up');
    });

    it('bounds a hung probe with the configured timeout', async () => {
      const { service } = buildService({
        timeoutMs: 25,
        redisPing: () =>
          new Promise<void>(() => {
            /* never settles, simulating a half-open socket */
          }),
      });

      const report = await service.readiness();

      expect(report.status).toBe('degraded');
      expect(report.checks.redis?.status).toBe('down');
      expect(report.checks.redis?.error).toContain('timed out after 25ms');
    });

    it('records latency for each probe', async () => {
      const { service } = buildService({});

      const report = await service.readiness();

      expect(report.checks.database?.latencyMs).toBeGreaterThanOrEqual(0);
      expect(report.checks.redis?.latencyMs).toBeGreaterThanOrEqual(0);
    });
  });
});

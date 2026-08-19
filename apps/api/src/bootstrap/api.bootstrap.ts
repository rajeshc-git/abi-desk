import { type IncomingMessage } from 'node:http';

import fastifyCookie from '@fastify/cookie';
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { type Logger } from 'pino';
import { AppModule } from '../app.module';
import { AllExceptionsFilter } from '../common/errors/all-exceptions.filter';
import { generateRequestId } from '../common/logging/logger.factory';
import { NestPinoLogger } from '../common/logging/nest-pino.logger';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe';
import { AppConfig } from '../config/app-config';
import { type Env } from '../config/env.schema';

/**
 * Boots the HTTP API.
 *
 * Route layout:
 *   /healthz, /readyz        - unversioned probes (excluded from the prefix)
 *   /api/v1/...              - everything else, URI-versioned
 *
 * Versioning is URI-based rather than header-based because tenant integrations
 * and webhook consumers are far more likely to get a URL right than a custom
 * `Accept` header.
 */
export async function bootstrapApi(env: Env, logger: Logger): Promise<void> {
  const adapter = new FastifyAdapter({
    // Reuse the single pino instance so access logs and application logs share
    // one format and one correlation id.
    loggerInstance: logger,
    genReqId: (request: IncomingMessage) =>
      generateRequestId(request.headers as Record<string, unknown>),
    requestIdHeader: 'x-request-id',
    trustProxy: env.TRUST_PROXY,
    bodyLimit: env.HTTP_BODY_LIMIT_BYTES,
    // Diagnostics payloads legitimately contain deep nesting (console traces,
    // network entries), so do not reject them as prototype-pollution attempts.
    onProtoPoisoning: 'remove',
    onConstructorPoisoning: 'remove',
  });

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.register(env, logger),
    adapter,
    {
      logger: new NestPinoLogger(logger),
      bufferLogs: true,
    },
  );

  const config = app.get(AppConfig);

  // Cookie parsing for the browser console's httpOnly session. Signed cookies are
  // not used: the cookie values are already a JWT and an opaque high-entropy token,
  // both of which carry their own integrity, so a second signature adds nothing.
  //
  // The cast is unavoidable: @fastify/cookie's default export bundles helper
  // functions alongside the plugin, so its type does not structurally match Nest's
  // `register` signature even though the value is a valid Fastify plugin. Confined
  // to this line.
  // Once @fastify/cookie's declaration merging is loaded, `FastifyInstance` gains
  // cookie helpers, and Nest's `register` signature no longer accepts the very
  // plugin that adds them - a circular typing problem in the plugin ecosystem, not
  // a real incompatibility. Narrowed to a minimal structural type for this call.
  const registrar = app as unknown as {
    register(plugin: unknown, options?: unknown): Promise<void>;
  };

  await registrar.register(fastifyCookie, {
    parseOptions: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.cookies.secure,
      path: '/',
    },
  });

  app.setGlobalPrefix(config.http.prefix, { exclude: ['healthz', 'readyz'] });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
    prefix: 'v',
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter(config));

  // Universal Credentialed CORS - dynamically reflects any requesting IP address, hostname, or domain
  app.enableCors({
    origin: (requestOrigin, callback) => {
      // Allows curl, server-to-server, and any browser IP/domain dynamically
      callback(null, requestOrigin || true);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'content-type',
      'authorization',
      'x-request-id',
      'x-abidesk-tenant',
      'x-csrf-token',
      'x-widget-public-key',
      'x-widget-user-email',
      'x-widget-user-token',
    ],
    exposedHeaders: ['x-request-id'],
    maxAge: 86_400,
  });

  // OpenAPI / Swagger Documentation
  const { DocumentBuilder, SwaggerModule } = await import('@nestjs/swagger');
  const swaggerConfig = new DocumentBuilder()
    .setTitle('ABI Desk Enterprise API')
    .setDescription(
      'Enterprise-grade multi-tenant customer support and issue tracking ticketing API',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('Tickets', 'Core ticketing lifecycle and activity timeline')
    .addTag('Workflow', 'Multi-tier workflow transitions and escalation')
    .addTag('Approvals', 'Enterprise approval gates and decisions')
    .addTag('Media & Diagnostics', 'Presigned direct S3 uploads and client telemetry')
    .addTag('Automation', 'Configurable condition-action automation rules')
    .addTag('SLA', 'Business hours calculator and SLA clock management')
    .addTag('Analytics', 'Executive scorecards, volume trends, and agent performance')
    .addTag('Tenant Administration', 'Brands, widget config, teams, queues, and user management')
    .addTag('API Keys', 'Argon2id-hashed server-to-server credentials')
    .addTag('Webhooks', 'HMAC-SHA256 signed outbound event deliveries')
    .addTag('Compliance', 'GDPR/DPDPA data subject requests and retention purging')
    .addTag('SSO', 'OIDC and SAML single sign-on')
    .addTag('Live Chat', 'Real-time WebSocket & REST chat desk')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Runs onModuleDestroy/onApplicationShutdown on SIGTERM so in-flight requests
  // drain and Postgres/Redis sessions close cleanly.
  app.enableShutdownHooks();

  await app.listen({ port: config.http.port, host: config.http.host });

  logger.info(
    {
      port: config.http.port,
      host: config.http.host,
      prefix: `/${config.http.prefix}/v1`,
      corsOrigins: config.http.corsOrigins,
    },
    'ABI Desk API listening',
  );
}

import { createHmac, randomBytes } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { type Prisma, openSecret, sealSecret } from '@abi-desk/db';
import { type Logger } from 'pino';
import { AppException } from '../../common/errors/app-exception';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { type CreateWebhookEndpointDto, type UpdateWebhookEndpointDto } from './webhook.dto';

@Injectable()
export class WebhookService {
  private readonly logger: Logger;

  constructor(
    private readonly db: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly config: AppConfig,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'WebhookService' });
  }

  /**
   * Registers a new webhook endpoint.
   */
  async createEndpoint(principal: AuthenticatedPrincipal, dto: CreateWebhookEndpointDto) {
    const tenantId = this.tenantContext.requireTenantId();

    const rawSecret = `whsec_${randomBytes(24).toString('hex')}`;
    const secretEncrypted = sealSecret(rawSecret, this.config.encryptionKey);
    const secretLast4 = rawSecret.slice(-4);

    const endpoint = await this.db.client.webhookEndpoint.create({
      data: {
        tenantId,
        name: dto.name,
        url: dto.url,
        events: dto.events,
        secretEncrypted,
        secretLast4,
        headers: (dto.headers ?? {}) as Prisma.InputJsonValue,
        maxRetries: dto.maxRetries ?? 5,
        timeoutMs: dto.timeoutMs ?? 10000,
        isActive: dto.isActive ?? true,
        createdById: principal.userId,
      },
    });

    this.logger.info(
      { endpointId: endpoint.id, tenantId, url: endpoint.url },
      'Webhook endpoint created',
    );

    return {
      id: endpoint.id,
      name: endpoint.name,
      url: endpoint.url,
      events: endpoint.events,
      secretLast4: endpoint.secretLast4,
      signingSecret: rawSecret, // returned once to the caller
      maxRetries: endpoint.maxRetries,
      timeoutMs: endpoint.timeoutMs,
      isActive: endpoint.isActive,
      createdAt: endpoint.createdAt,
    };
  }

  async listEndpoints(_principal: AuthenticatedPrincipal) {
    const tenantId = this.tenantContext.requireTenantId();
    return this.db.client.webhookEndpoint.findMany({
      where: { tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        secretLast4: true,
        headers: true,
        maxRetries: true,
        timeoutMs: true,
        isActive: true,
        disabledAt: true,
        consecutiveFailures: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getEndpoint(_principal: AuthenticatedPrincipal, endpointId: string) {
    const tenantId = this.tenantContext.requireTenantId();
    const endpoint = await this.db.client.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        secretLast4: true,
        headers: true,
        maxRetries: true,
        timeoutMs: true,
        isActive: true,
        disabledAt: true,
        consecutiveFailures: true,
        lastSuccessAt: true,
        lastFailureAt: true,
        createdAt: true,
      },
    });

    if (!endpoint) {
      throw AppException.notFound(`Webhook endpoint '${endpointId}' not found.`);
    }

    return endpoint;
  }

  async updateEndpoint(
    _principal: AuthenticatedPrincipal,
    endpointId: string,
    dto: UpdateWebhookEndpointDto,
  ) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`Webhook endpoint '${endpointId}' not found.`);
    }

    return this.db.client.webhookEndpoint.update({
      where: { id: endpointId },
      data: {
        name: dto.name,
        url: dto.url,
        events: dto.events,
        headers: dto.headers ? (dto.headers as Prisma.InputJsonValue) : undefined,
        maxRetries: dto.maxRetries,
        timeoutMs: dto.timeoutMs,
        isActive: dto.isActive,
      },
    });
  }

  async deleteEndpoint(_principal: AuthenticatedPrincipal, endpointId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const existing = await this.db.client.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
    });

    if (!existing) {
      throw AppException.notFound(`Webhook endpoint '${endpointId}' not found.`);
    }

    await this.db.client.webhookEndpoint.delete({
      where: { id: endpointId },
    });

    return { success: true, deletedEndpointId: endpointId };
  }

  /**
   * Dispatches a test ping event to the endpoint.
   */
  async testEndpoint(_principal: AuthenticatedPrincipal, endpointId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    const endpoint = await this.db.client.webhookEndpoint.findFirst({
      where: { id: endpointId, tenantId },
    });

    if (!endpoint) {
      throw AppException.notFound(`Webhook endpoint '${endpointId}' not found.`);
    }

    const testPayload = JSON.stringify({
      event: 'endpoint.ping',
      timestamp: new Date().toISOString(),
      tenantId,
      message: 'ABI Desk webhook delivery test ping',
    });

    const delivery = await this.db.client.webhookDelivery.create({
      data: {
        tenantId,
        endpointId: endpoint.id,
        eventType: 'endpoint.ping',
        eventId: endpoint.id,
        status: 'PENDING',
        requestBody: testPayload,
      },
    });

    // Execute delivery synchronously for test endpoint
    const result = await this.deliverWebhook(delivery.id);
    return { testDeliveryId: delivery.id, ...result };
  }

  /**
   * Executes webhook delivery with HMAC-SHA256 signing.
   */
  async deliverWebhook(deliveryId: string) {
    const delivery = await this.db.unsafeRawClient.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery || !delivery.endpoint) {
      return { success: false, error: 'Delivery or endpoint not found' };
    }

    const endpoint = delivery.endpoint;
    const signingSecret = openSecret(endpoint.secretEncrypted, this.config.encryptionKey);

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', signingSecret)
      .update(`${timestamp}.${delivery.requestBody}`)
      .digest('hex');

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'user-agent': 'ABI-Desk-Webhooks/1.0',
      'x-abidesk-event': delivery.eventType,
      'x-abidesk-delivery': delivery.id,
      'x-abidesk-timestamp': timestamp,
      'x-abidesk-signature': `t=${timestamp},v1=${signature}`,
      ...((endpoint.headers as Record<string, string>) ?? {}),
    };

    const startTime = Date.now();
    let responseStatus: number | null = null;
    let responseBody: string | null = null;
    let error: string | null = null;
    let success = false;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), endpoint.timeoutMs);

      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers,
        body: delivery.requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      responseStatus = res.status;
      const text = await res.text();
      responseBody = text.slice(0, 1000); // capped to 1000 chars

      if (res.ok) {
        success = true;
      } else {
        error = `HTTP ${res.status} ${res.statusText}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }

    const durationMs = Date.now() - startTime;
    const attempt = delivery.attempt + 1;

    let nextAttemptAt: Date | null = null;
    let status: 'DELIVERED' | 'FAILED' | 'EXHAUSTED' = success ? 'DELIVERED' : 'FAILED';

    if (!success) {
      if (attempt >= endpoint.maxRetries) {
        status = 'EXHAUSTED';
      } else {
        // Exponential backoff: 2^attempt * 30 seconds
        const backoffSeconds = Math.pow(2, attempt) * 30;
        nextAttemptAt = new Date(Date.now() + backoffSeconds * 1000);
      }
    }

    await this.db.unsafeRawClient.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status,
        attempt,
        responseStatus,
        responseBody,
        error,
        durationMs,
        nextAttemptAt,
        deliveredAt: success ? new Date() : null,
      },
    });

    await this.db.unsafeRawClient.webhookEndpoint.update({
      where: { id: endpoint.id },
      data: {
        lastSuccessAt: success ? new Date() : endpoint.lastSuccessAt,
        lastFailureAt: !success ? new Date() : endpoint.lastFailureAt,
        consecutiveFailures: success ? 0 : { increment: 1 },
      },
    });

    return {
      success,
      status,
      responseStatus,
      durationMs,
      error,
      attempt,
      nextAttemptAt,
    };
  }

  async listDeliveries(_principal: AuthenticatedPrincipal, endpointId: string) {
    const tenantId = this.tenantContext.requireTenantId();

    return this.db.client.webhookDelivery.findMany({
      where: { endpointId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}

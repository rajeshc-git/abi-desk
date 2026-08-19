import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type CreateWebhookEndpointDto,
  CreateWebhookEndpointSchema,
  type UpdateWebhookEndpointDto,
  UpdateWebhookEndpointSchema,
  type WebhookEndpointIdParamDto,
  WebhookEndpointIdParamSchema,
} from './webhook.dto';
import { WebhookService } from './webhook.service';

@Controller({ path: 'admin/webhooks', version: '1' })
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @RequirePermission('admin:webhook:manage')
  @Audited({ action: 'webhook_endpoint.created', resourceType: 'webhook_endpoint' })
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateWebhookEndpointDto) {
    return this.webhookService.createEndpoint(principal, dto);
  }

  @Get()
  @RequirePermission('admin:webhook:manage')
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.webhookService.listEndpoints(principal);
  }

  @Get(':id')
  @RequirePermission('admin:webhook:manage')
  get(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: WebhookEndpointIdParamDto,
  ) {
    return this.webhookService.getEndpoint(principal, params.id);
  }

  @Patch(':id')
  @RequirePermission('admin:webhook:manage')
  @Audited({ action: 'webhook_endpoint.updated', resourceType: 'webhook_endpoint', idParam: 'id' })
  update(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: WebhookEndpointIdParamDto,
    @Body() dto: UpdateWebhookEndpointDto,
  ) {
    return this.webhookService.updateEndpoint(principal, params.id, dto);
  }

  @Delete(':id')
  @RequirePermission('admin:webhook:manage')
  @Audited({ action: 'webhook_endpoint.deleted', resourceType: 'webhook_endpoint', idParam: 'id' })
  delete(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: WebhookEndpointIdParamDto,
  ) {
    return this.webhookService.deleteEndpoint(principal, params.id);
  }

  @Post(':id/test')
  @RequirePermission('admin:webhook:manage')
  @Audited({ action: 'webhook_endpoint.tested', resourceType: 'webhook_endpoint', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  test(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: WebhookEndpointIdParamDto,
  ) {
    return this.webhookService.testEndpoint(principal, params.id);
  }

  @Get(':id/deliveries')
  @RequirePermission('admin:webhook:manage')
  deliveries(
    @CurrentUser() principal: AuthenticatedPrincipal,
    @Param() params: WebhookEndpointIdParamDto,
  ) {
    return this.webhookService.listDeliveries(principal, params.id);
  }
}

import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Audited, CurrentUser, RequirePermission } from '../../common/auth/auth.decorators';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import {
  type ApiKeyIdParamDto,
  ApiKeyIdParamSchema,
  type CreateApiKeyDto,
  CreateApiKeySchema,
} from './api-key.dto';
import { ApiKeyService } from './api-key.service';

@Controller({ path: 'admin/api-keys', version: '1' })
export class ApiKeyController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Post()
  @RequirePermission('admin:apikey:manage')
  @Audited({ action: 'apikey.created', resourceType: 'api_key' })
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() principal: AuthenticatedPrincipal, @Body() dto: CreateApiKeyDto) {
    return this.apiKeyService.createKey(principal, dto);
  }

  @Get()
  @RequirePermission('admin:apikey:manage')
  list(@CurrentUser() principal: AuthenticatedPrincipal) {
    return this.apiKeyService.listKeys(principal);
  }

  @Delete(':id')
  @RequirePermission('admin:apikey:manage')
  @Audited({ action: 'apikey.revoked', resourceType: 'api_key', idParam: 'id' })
  revoke(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: ApiKeyIdParamDto) {
    return this.apiKeyService.revokeKey(principal, params.id);
  }

  @Post(':id/rotate')
  @RequirePermission('admin:apikey:manage')
  @Audited({ action: 'apikey.rotated', resourceType: 'api_key', idParam: 'id' })
  @HttpCode(HttpStatus.OK)
  rotate(@CurrentUser() principal: AuthenticatedPrincipal, @Param() params: ApiKeyIdParamDto) {
    return this.apiKeyService.rotateKey(principal, params.id);
  }
}

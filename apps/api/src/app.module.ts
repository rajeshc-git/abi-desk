import { type DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { type Logger } from 'pino';
import { AuditModule } from './common/audit/audit.module';
import { AuditInterceptor } from './common/audit/audit.interceptor';
import { CsrfGuard } from './common/auth/csrf.guard';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { PermissionGuard } from './common/auth/permission.guard';
import { TenantContextInterceptor } from './common/auth/tenant-context.interceptor';
import { LoggingModule } from './common/logging/logging.module';
import { ConfigModule } from './config/config.module';
import { type Env } from './config/env.schema';
import { MailModule } from './infra/mail/mail.module';
import { PrismaModule } from './infra/prisma/prisma.module';
import { RedisModule } from './infra/redis/redis.module';
import { StorageModule } from './infra/storage/storage.module';
import { TenancyModule } from './infra/tenancy/tenancy.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthorizationModule } from './modules/authorization/authorization.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { ApiKeyModule } from './modules/api-keys/api-key.module';
import { ApprovalModule } from './modules/approvals/approval.module';
import { AutomationModule } from './modules/automation/automation.module';
import { ChatModule } from './modules/chat/chat.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { HealthModule } from './modules/health/health.module';
import { MediaModule } from './modules/media/media.module';
import { SlaModule } from './modules/sla/sla.module';
import { SsoModule } from './modules/sso/sso.module';
import { TenancyAdminModule } from './modules/tenancy-admin/tenancy-admin.module';
import { TicketModule } from './modules/tickets/ticket.module';
import { WebhookModule } from './modules/webhooks/webhook.module';
import { WorkflowModule } from './modules/workflow/workflow.module';

/**
 * Application composition root.
 *
 * Built as a dynamic module so validated configuration and the shared logger are
 * injected from `main.ts` rather than re-derived from `process.env` inside the
 * container. That keeps the module graph testable: a test can boot the same graph
 * with a fixture `Env` and a silent logger.
 *
 * ## Request pipeline order
 *
 * Nest runs guards, then interceptors, then the handler. The registration order
 * below matters:
 *
 *  1. `JwtAuthGuard`   - resolves the principal (its own DB lookups run under an
 *                        explicit RLS bypass, since no tenant scope exists yet).
 *  2. `CsrfGuard`      - rejects forged cookie-authenticated writes.
 *  3. `TenantContextInterceptor` - opens the AsyncLocalStorage tenant scope that
 *                        every service and query below relies on.
 *
 * Authentication is therefore the default for every route, and `@Public()` is an
 * explicit, reviewable exception.
 */
@Module({})
export class AppModule {
  static register(env: Env, logger: Logger): DynamicModule {
    return {
      module: AppModule,
      imports: [
        // Cross-cutting infrastructure (all @Global).
        ConfigModule.forRoot(env),
        LoggingModule.forRoot(logger),
        PrismaModule,
        RedisModule,
        TenancyModule,
        MailModule,
        StorageModule,
        AuditModule,
        AuthorizationModule,
        AuthModule,

        // Feature modules.
        HealthModule,
        TicketModule,
        WorkflowModule,
        ApprovalModule,
        MediaModule,
        AutomationModule,
        SlaModule,
        AnalyticsModule,
        TenancyAdminModule,
        ApiKeyModule,
        WebhookModule,
        ComplianceModule,
        SsoModule,
        ChatModule,
      ],
      providers: [
        // Guards run in registration order: authenticate, then authorize, then
        // reject forged cookie writes.
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: APP_GUARD, useClass: CsrfGuard },

        // Interceptors: the tenant scope must be open before the audit interceptor
        // writes, since the audit row is itself tenant-scoped and subject to RLS.
        { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    };
  }
}

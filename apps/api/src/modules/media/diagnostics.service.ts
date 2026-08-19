import { Injectable } from '@nestjs/common';
import { type Prisma } from '@abi-desk/db';
import { AppException } from '../../common/errors/app-exception';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { type AuthenticatedPrincipal } from '../auth/auth.types';
import { ticketFilterFor } from '../tickets/ticket-scope';
import { type SubmitDiagnosticsDto } from './media.dto';
import { redact } from './redaction';

/** Fallbacks when a tenant has no widget config yet. Mirror the schema defaults. */
const DEFAULT_MAX_CONSOLE_ENTRIES = 200;
const DEFAULT_MAX_NETWORK_ENTRIES = 100;
/** Independent cap on JS errors; the schema has no column for it. */
const MAX_JS_ERRORS = 100;
/** Hard ceiling on a serialized bundle, after truncation. */
const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

/**
 * Ingest and read-back for automatically captured diagnostics.
 *
 * Implements the requirements' "Automatically Captured Diagnostics" list: browser and OS,
 * device, viewport, locale and timezone, page and referrer, host session identifiers,
 * console output, network activity, JavaScript errors and performance metrics.
 *
 * Two things happen on the way in, in this order, and the order matters:
 *
 *   1. **Truncate** to the tenant's configured caps. Done first so redaction never has to
 *      walk an unbounded payload - otherwise a hostile client could make ingest expensive
 *      by sending a million console lines.
 *   2. **Redact** every remaining string. The widget already scrubs, but the widget is
 *      code in someone else's page; anything arriving here is untrusted.
 *
 * Reading a bundle back needs `capture:diagnostics:read`, which is separate from the
 * permission to submit one. Everybody's widget submits diagnostics; only staff may read
 * the console and network traces, because those are the most sensitive artefact in the
 * product and can contain another user's data from the host application.
 */
@Injectable()
export class DiagnosticsService {
  constructor(private readonly prisma: TenantPrismaService) {}

  /**
   * Attaches a diagnostics bundle to a ticket.
   *
   * One bundle per ticket, enforced by a unique constraint on `ticketId`. Re-submitting
   * replaces the existing bundle rather than erroring: a widget retrying after a network
   * failure should converge, not fail permanently, and the newer capture is the better
   * one.
   */
  async submit(principal: AuthenticatedPrincipal, ticketId: string, input: SubmitDiagnosticsDto) {
    const tenantId = this.requireTenant(principal);
    await this.loadTicketInScope(principal, ticketId);

    const limits = await this.resolveLimits(tenantId, ticketId);

    // Step 1: bound the payload.
    const consoleEntries = input.consoleEntries.slice(-limits.maxConsoleEntries);
    const networkEntries = input.networkEntries.slice(-limits.maxNetworkEntries);
    const jsErrors = input.jsErrors.slice(-MAX_JS_ERRORS);

    // Kept as the *most recent* N rather than the first N: the tail is what was
    // happening when the user hit the problem, which is the whole point of the capture.

    // Step 2: redact everything that survived.
    const scrubbed = redact({
      pageUrl: input.pageUrl,
      pageTitle: input.pageTitle,
      referrerUrl: input.referrerUrl,
      userAgent: input.userAgent,
      consoleEntries,
      networkEntries,
      jsErrors,
      performanceMetrics: input.performanceMetrics,
      featureFlags: input.featureFlags,
      customContext: input.customContext,
    });

    const payload = scrubbed.value;
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');

    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      throw AppException.unprocessable(
        `Diagnostics payload is ${payloadBytes} bytes, above the ${MAX_PAYLOAD_BYTES} byte limit.`,
        [{ path: 'consoleEntries', message: 'Reduce the captured payload size.' }],
      );
    }

    const retainUntil = await this.resolveRetention(tenantId);

    const data = {
      tenantId,
      ticketId,
      capturedAt: input.capturedAt,

      pageUrl: truncate(payload.pageUrl, 2048),
      pageTitle: payload.pageTitle ? truncate(payload.pageTitle, 500) : null,
      referrerUrl: payload.referrerUrl ? truncate(payload.referrerUrl, 2048) : null,
      hostSessionId: input.hostSessionId ?? null,
      hostUserId: input.hostUserId ?? null,
      hostAccountId: input.hostAccountId ?? null,

      userAgent: payload.userAgent,
      browserName: input.browserName ?? null,
      browserVersion: input.browserVersion ?? null,
      engineName: input.engineName ?? null,
      osName: input.osName ?? null,
      osVersion: input.osVersion ?? null,
      deviceType: input.deviceType ?? null,
      deviceModel: input.deviceModel ?? null,

      viewportWidth: input.viewportWidth ?? null,
      viewportHeight: input.viewportHeight ?? null,
      screenWidth: input.screenWidth ?? null,
      screenHeight: input.screenHeight ?? null,
      devicePixelRatio: input.devicePixelRatio ?? null,
      colorScheme: input.colorScheme ?? null,

      timezone: input.timezone ?? null,
      locale: input.locale ?? null,

      connectionType: input.connectionType ?? null,
      deviceMemoryGb: input.deviceMemoryGb ?? null,
      hardwareConcurrency: input.hardwareConcurrency ?? null,

      consoleEntries: payload.consoleEntries as Prisma.InputJsonValue,
      // Denormalized so a ticket list can show "3 errors" without deserializing the
      // whole payload. Counted from the truncated set, so the number matches what is
      // actually stored rather than what was sent.
      consoleErrorCount: countLevel(payload.consoleEntries, 'error'),
      consoleWarnCount: countLevel(payload.consoleEntries, 'warn'),

      networkEntries: payload.networkEntries as Prisma.InputJsonValue,
      networkFailureCount: countNetworkFailures(payload.networkEntries),

      jsErrors: payload.jsErrors as Prisma.InputJsonValue,
      jsErrorCount: payload.jsErrors.length,

      performanceMetrics: (payload.performanceMetrics ?? {}) as Prisma.InputJsonValue,
      featureFlags: (payload.featureFlags ?? null) as Prisma.InputJsonValue,
      customContext: (payload.customContext ?? null) as Prisma.InputJsonValue,

      payloadBytes,
      redactionsApplied: scrubbed.applied,
      retainUntil,
    };

    const bundle = await this.prisma.client.diagnosticBundle.upsert({
      where: { ticketId },
      create: data,
      update: data,
      select: { id: true, ticketId: true, payloadBytes: true, redactionsApplied: true },
    });

    return {
      id: bundle.id,
      ticketId: bundle.ticketId,
      payloadBytes: bundle.payloadBytes,
      // Returned so a client can confirm scrubbing happened, and so a test can assert it.
      redactionsApplied: bundle.redactionsApplied,
      counts: {
        consoleEntries: payload.consoleEntries.length,
        consoleErrors: data.consoleErrorCount,
        consoleWarnings: data.consoleWarnCount,
        networkEntries: payload.networkEntries.length,
        networkFailures: data.networkFailureCount,
        jsErrors: data.jsErrorCount,
      },
      truncated: {
        consoleEntries: input.consoleEntries.length - consoleEntries.length,
        networkEntries: input.networkEntries.length - networkEntries.length,
        jsErrors: input.jsErrors.length - jsErrors.length,
      },
    };
  }

  /**
   * The agent-facing view of a bundle.
   *
   * Requires `capture:diagnostics:read` at the route, and the ticket must be in the
   * caller's row scope - holding the permission does not grant access to every ticket's
   * diagnostics, only to those whose ticket the caller can already see.
   */
  async getForTicket(principal: AuthenticatedPrincipal, ticketId: string) {
    const tenantId = this.requireTenant(principal);
    await this.loadTicketInScope(principal, ticketId);

    const bundle = await this.prisma.client.diagnosticBundle.findFirst({
      where: { tenantId, ticketId },
    });

    if (!bundle) throw AppException.notFound('Diagnostic bundle for ticket', ticketId);

    return {
      id: bundle.id,
      ticketId: bundle.ticketId,
      capturedAt: bundle.capturedAt,
      page: {
        url: bundle.pageUrl,
        title: bundle.pageTitle,
        referrer: bundle.referrerUrl,
      },
      host: {
        sessionId: bundle.hostSessionId,
        userId: bundle.hostUserId,
        accountId: bundle.hostAccountId,
      },
      environment: {
        userAgent: bundle.userAgent,
        browserName: bundle.browserName,
        browserVersion: bundle.browserVersion,
        engineName: bundle.engineName,
        osName: bundle.osName,
        osVersion: bundle.osVersion,
        deviceType: bundle.deviceType,
        deviceModel: bundle.deviceModel,
        timezone: bundle.timezone,
        locale: bundle.locale,
        connectionType: bundle.connectionType,
        deviceMemoryGb: bundle.deviceMemoryGb,
        hardwareConcurrency: bundle.hardwareConcurrency,
      },
      display: {
        viewportWidth: bundle.viewportWidth,
        viewportHeight: bundle.viewportHeight,
        screenWidth: bundle.screenWidth,
        screenHeight: bundle.screenHeight,
        devicePixelRatio: bundle.devicePixelRatio,
        colorScheme: bundle.colorScheme,
      },
      counts: {
        consoleErrors: bundle.consoleErrorCount,
        consoleWarnings: bundle.consoleWarnCount,
        networkFailures: bundle.networkFailureCount,
        jsErrors: bundle.jsErrorCount,
      },
      consoleEntries: bundle.consoleEntries,
      networkEntries: bundle.networkEntries,
      jsErrors: bundle.jsErrors,
      performanceMetrics: bundle.performanceMetrics,
      featureFlags: bundle.featureFlags,
      customContext: bundle.customContext,
      // Surfaced so an agent seeing `[REDACTED]` knows it was masked on purpose rather
      // than missing from the capture.
      redactionsApplied: bundle.redactionsApplied,
      payloadBytes: bundle.payloadBytes,
      retainUntil: bundle.retainUntil,
      createdAt: bundle.createdAt,
    };
  }

  /**
   * The compact summary a ticket view shows without loading the traces.
   *
   * Deliberately readable with only ticket access and no `capture:diagnostics:read`: the
   * counts say whether it is worth asking for the full bundle, and reveal nothing that
   * was captured.
   */
  async getSummaryForTicket(principal: AuthenticatedPrincipal, ticketId: string) {
    const tenantId = this.requireTenant(principal);
    await this.loadTicketInScope(principal, ticketId);

    const bundle = await this.prisma.client.diagnosticBundle.findFirst({
      where: { tenantId, ticketId },
      select: {
        id: true,
        capturedAt: true,
        browserName: true,
        browserVersion: true,
        osName: true,
        osVersion: true,
        deviceType: true,
        consoleErrorCount: true,
        consoleWarnCount: true,
        networkFailureCount: true,
        jsErrorCount: true,
        payloadBytes: true,
      },
    });

    return bundle ?? null;
  }

  // -------------------------------------------------------------------------
  // Internals
  // -------------------------------------------------------------------------

  private requireTenant(principal: AuthenticatedPrincipal): string {
    if (!principal.tenantId) {
      throw AppException.permissionDenied('Diagnostics require a tenant-scoped caller.', {
        userId: principal.userId,
      });
    }

    return principal.tenantId;
  }

  private async loadTicketInScope(principal: AuthenticatedPrincipal, ticketId: string) {
    const scope = ticketFilterFor(principal);
    if (!scope) throw AppException.notFound('Ticket', ticketId);

    const ticket = await this.prisma.client.ticket.findFirst({
      where: { AND: [{ id: ticketId, deletedAt: null }, scope] },
      select: { id: true, brandId: true },
    });

    if (!ticket) throw AppException.notFound('Ticket', ticketId);
    return ticket;
  }

  private async resolveLimits(tenantId: string, ticketId: string) {
    const ticket = await this.prisma.client.ticket.findFirst({
      where: { id: ticketId, tenantId },
      select: { brandId: true },
    });

    const config = await this.prisma.client.widgetConfig.findFirst({
      where: ticket?.brandId ? { tenantId, brandId: ticket.brandId } : { tenantId },
      select: { maxConsoleEntries: true, maxNetworkEntries: true },
    });

    return {
      maxConsoleEntries: config?.maxConsoleEntries ?? DEFAULT_MAX_CONSOLE_ENTRIES,
      maxNetworkEntries: config?.maxNetworkEntries ?? DEFAULT_MAX_NETWORK_ENTRIES,
    };
  }

  private async resolveRetention(tenantId: string): Promise<Date | null> {
    const settings = await this.prisma.client.tenantSetting.findFirst({
      where: { tenantId },
      select: { diagnosticRetentionDays: true },
    });

    const days = settings?.diagnosticRetentionDays;
    if (!days || days <= 0) return null;

    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

/** Counts console entries at a level, tolerating entries that omit or mistype it. */
function countLevel(entries: readonly Record<string, unknown>[], level: string): number {
  return entries.filter((entry) => {
    const value = entry.level;
    return typeof value === 'string' && value.toLowerCase() === level;
  }).length;
}

/**
 * Counts failed network calls.
 *
 * Accepts either an explicit `failed` flag or an HTTP status of 400+, because the widget
 * cannot always tell the difference: a request aborted by a navigation has no status at
 * all, while a 500 does.
 */
function countNetworkFailures(entries: readonly Record<string, unknown>[]): number {
  return entries.filter((entry) => {
    if (entry.failed === true) return true;
    const status = entry.status;
    return typeof status === 'number' && status >= 400;
  }).length;
}

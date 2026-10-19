import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { TenantPrismaService } from '../../infra/tenancy/tenant-prisma.service';
import { TenantContextService } from '../../infra/tenancy/tenant-context.service';
import { MailService } from '../../infra/mail/mail.service';
import { RedisService } from '../../infra/redis/redis.service';
import { type UpdateScheduledReportDto, type SendNowReportDto } from './scheduled-report.dto';

export interface ScheduledReportConfig {
  reportType: 'today_tickets' | 'last_30_days';
  enabled: boolean;
  emails: string[];
  frequency: 'daily' | 'month_end';
  time: string;
  timezone?: string | null;
  subject: string;
  body: string;
  lastSentAt?: string | null;
  lastTicketCount?: number;
}

const DEFAULT_TEMPLATES: Record<'today_tickets' | 'last_30_days', { subject: string; body: string; reportName: string }> = {
  today_tickets: {
    reportName: "Today's Tickets",
    subject: "[ABI Desk] Daily Report: Today's Tickets - {{date}}",
    body: `Hello Team,

Please find attached the automated tickets report for today ({{date}}).

Report Summary:
- Report: {{reportName}}
- Total Tickets: {{ticketCount}}
- Generated On: {{generatedAt}}

The complete dataset is attached as a CSV file.

Best regards,
ABI Desk Automated Reporting System
donotreply@abi-health.in`,
  },
  last_30_days: {
    reportName: 'Last 30 Days Tickets',
    subject: '[ABI Desk] Summary Report: Last 30 Days Tickets - {{date}}',
    body: `Hello Team,

Please find attached the 30-day tickets summary report ({{date}}).

Report Summary:
- Report: {{reportName}}
- Total Tickets: {{ticketCount}}
- Date Range: Last 30 Days
- Generated On: {{generatedAt}}

The complete dataset is attached as a CSV file.

Best regards,
ABI Desk Automated Reporting System
donotreply@abi-health.in`,
  },
};

@Injectable()
export class ScheduledReportService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: Logger;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: TenantPrismaService,
    private readonly tenantContext: TenantContextService,
    private readonly mailService: MailService,
    private readonly redis: RedisService,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'ScheduledReportService' });
  }

  onModuleInit(): void {
    // Check every 60 seconds if any tenant scheduled report is due
    this.timer = setInterval(() => {
      this.checkAndRunScheduledReports().catch((err) => {
        this.logger.error({ err }, 'Error checking scheduled reports');
      });
    }, 60 * 1000);

    this.logger.info('Scheduled reports runner initialized (monitoring configured report triggers)');
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Retrieves the current schedule configuration for a given report type.
   */
  async getConfig(tenantId: string, reportType: 'today_tickets' | 'last_30_days'): Promise<ScheduledReportConfig> {
    const setting = await this.prisma.client.tenantSetting.findUnique({
      where: { tenantId },
      select: { extra: true },
    });

    const extra = (setting?.extra as Record<string, any>) || {};
    const reportSchedules = extra.reportSchedules || {};
    const saved = reportSchedules[reportType] || {};
    const defaults = DEFAULT_TEMPLATES[reportType];

    return {
      reportType,
      enabled: saved.enabled ?? false,
      emails: Array.isArray(saved.emails) ? saved.emails : [],
      frequency: saved.frequency || (reportType === 'last_30_days' ? 'month_end' : 'daily'),
      time: saved.time || '23:58',
      timezone: saved.timezone || null,
      subject: saved.subject || defaults.subject,
      body: saved.body || defaults.body,
      lastSentAt: saved.lastSentAt || null,
      lastTicketCount: saved.lastTicketCount,
    };
  }

  /**
   * Updates and saves the schedule configuration in TenantSetting.extra.
   */
  async saveConfig(
    tenantId: string,
    reportType: 'today_tickets' | 'last_30_days',
    dto: UpdateScheduledReportDto,
  ): Promise<ScheduledReportConfig> {
    const setting = await this.prisma.client.tenantSetting.findUnique({
      where: { tenantId },
      select: { id: true, extra: true },
    });

    const extra = (setting?.extra as Record<string, any>) || {};
    const reportSchedules = extra.reportSchedules || {};
    const current = reportSchedules[reportType] || {};

    const updated = {
      ...current,
      enabled: dto.enabled,
      emails: dto.emails,
      frequency: dto.frequency || current.frequency || (reportType === 'last_30_days' ? 'month_end' : 'daily'),
      time: dto.time || '23:58',
      timezone: dto.timezone !== undefined ? dto.timezone : current.timezone,
      subject: dto.subject || current.subject || DEFAULT_TEMPLATES[reportType].subject,
      body: dto.body || current.body || DEFAULT_TEMPLATES[reportType].body,
    };

    reportSchedules[reportType] = updated;
    extra.reportSchedules = reportSchedules;

    await this.prisma.client.tenantSetting.upsert({
      where: { tenantId },
      create: {
        tenantId,
        extra,
      },
      update: {
        extra,
      },
    });

    return {
      reportType,
      enabled: updated.enabled,
      emails: updated.emails,
      frequency: updated.frequency,
      time: updated.time,
      timezone: updated.timezone || null,
      subject: updated.subject,
      body: updated.body,
      lastSentAt: updated.lastSentAt || null,
      lastTicketCount: updated.lastTicketCount,
    };
  }

  /**
   * Generates the report CSV and sends it via email (using donotreply@abi-health.in).
   */
  async generateAndSendReport(
    tenantId: string,
    reportType: 'today_tickets' | 'last_30_days',
    overrides?: SendNowReportDto,
  ): Promise<{ success: boolean; count: number; recipients: string[]; sentAt: string }> {
    return this.tenantContext.runWithTenant(tenantId, {}, async () => {
      const config = await this.getConfig(tenantId, reportType);
      const recipients = overrides?.emails?.length ? overrides.emails : config.emails;

      if (!recipients.length) {
        throw new Error('No recipient email addresses provided.');
      }

      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

      // Determine query date boundary
      let createdAfter: Date;
      if (reportType === 'today_tickets') {
        createdAfter = new Date(`${dateStr}T00:00:00.000Z`);
      } else {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        createdAfter = new Date(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T00:00:00.000Z`);
      }

      // Query tickets for this tenant within the time boundary (ALL statuses included)
      const tickets = await this.prisma.client.ticket.findMany({
        where: {
          tenantId,
          createdAt: { gte: createdAfter },
          deletedAt: null,
        },
        include: {
          requester: { select: { fullName: true, email: true } },
          assignee: { select: { fullName: true, email: true } },
          team: { select: { name: true } },
          queue: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10000,
      });

      // Build CSV file content
      const csvContent = this.buildTicketsCsv(tickets);
      const filename = `${reportType === 'today_tickets' ? 'todays-tickets' : 'last-30-days-tickets'}-${dateStr}.csv`;

      // Format subject & body
      const defaults = DEFAULT_TEMPLATES[reportType];
      const subjectTpl = overrides?.subject || config.subject || defaults.subject;
      const bodyTpl = overrides?.body || config.body || defaults.body;

      const replacements: Record<string, string> = {
        '{{date}}': dateStr,
        '{{reportName}}': defaults.reportName,
        '{{ticketCount}}': String(tickets.length),
        '{{generatedAt}}': now.toLocaleString('en-US', { timeZone: 'UTC', dateStyle: 'medium', timeStyle: 'short' }) + ' UTC',
      };

      let subject = subjectTpl;
      let body = bodyTpl;
      for (const [key, val] of Object.entries(replacements)) {
        subject = subject.split(key).join(val);
        body = body.split(key).join(val);
      }

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .container { max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 10px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
    .header { background: #2563eb; color: #ffffff; padding: 20px 24px; font-size: 18px; font-weight: 700; }
    .content { padding: 24px; white-space: pre-line; font-size: 14px; }
    .badge-card { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 14px 18px; margin: 16px 0; }
    .badge-title { font-size: 12px; font-weight: 700; color: #1d4ed8; text-transform: uppercase; letter-spacing: 0.05em; }
    .badge-value { font-size: 22px; font-weight: 800; color: #1e40af; margin-top: 4px; }
    .footer { padding: 16px 24px; background: #f1f5f9; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      📊 ABI Desk Automated Report
    </div>
    <div class="content">
      <div class="badge-card">
        <div class="badge-title">${defaults.reportName} Summary</div>
        <div class="badge-value">${tickets.length.toLocaleString()} Tickets</div>
        <div style="font-size: 12px; color: #3b82f6; margin-top: 2px;">Report Date: ${dateStr}</div>
      </div>
      <div>${body.replace(/\n/g, '<br/>')}</div>
    </div>
    <div class="footer">
      This is an automated report delivered by <strong>ABI Desk</strong> from <code>donotreply@abi-health.in</code>.<br/>
      Attached CSV: <code>${filename}</code>
    </div>
  </div>
</body>
</html>`.trim();

      // Send email to all recipients via donotreply@abi-health.in (mailService.send)
      const sendPromises = recipients.map((email) => {
        return this.mailService.send({
          to: { email },
          subject,
          text: body,
          html,
          tag: 'scheduled-report',
          attachments: [
            {
              filename,
              content: Buffer.from(csvContent, 'utf-8'),
              contentType: 'text/csv; charset=utf-8',
            },
          ],
        });
      });

      await Promise.all(sendPromises);

      // Record lastSentAt timestamp in TenantSetting
      const setting = await this.prisma.client.tenantSetting.findUnique({
        where: { tenantId },
        select: { extra: true },
      });
      const extra = (setting?.extra as Record<string, any>) || {};
      const reportSchedules = extra.reportSchedules || {};
      const current = reportSchedules[reportType] || {};

      reportSchedules[reportType] = {
        ...current,
        lastSentAt: now.toISOString(),
        lastTicketCount: tickets.length,
      };
      extra.reportSchedules = reportSchedules;

      await this.prisma.client.tenantSetting.update({
        where: { tenantId },
        data: { extra },
      });

      this.logger.info(
        { tenantId, reportType, recipientCount: recipients.length, ticketCount: tickets.length },
        'Scheduled report successfully generated and sent',
      );

      return {
        success: true,
        count: tickets.length,
        recipients,
        sentAt: now.toISOString(),
      };
    });
  }

  /**
   * Periodic check running every minute to trigger any due nightly reports.
   * Checks both tenant timezone and server local/UTC time so it runs accurately on any VPS.
   */
  private async checkAndRunScheduledReports(): Promise<void> {
    await this.tenantContext.runWithBypass('background-job', {}, async () => {
      const now = new Date();

      const settings = await this.prisma.client.tenantSetting.findMany({
        select: {
          tenantId: true,
          extra: true,
          tenant: {
            select: { timezone: true },
          },
        },
      });

      for (const s of settings) {
        const extra = (s.extra as Record<string, any>) || {};
        const schedules = extra.reportSchedules || {};

        for (const reportType of ['today_tickets', 'last_30_days'] as const) {
          const item = schedules[reportType];
          if (item && item.enabled && Array.isArray(item.emails) && item.emails.length > 0) {
            const targetTime = item.time || '23:58';
            const tz = item.timezone || (s.tenant?.timezone && s.tenant.timezone !== 'UTC' ? s.tenant.timezone : null) || process.env.APP_TIMEZONE || 'Asia/Kolkata';

            let hours = now.getHours();
            let minutes = now.getMinutes();
            let todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            let isMonthEnd = false;

            try {
              const dtf = new Intl.DateTimeFormat('en-US', {
                timeZone: tz,
                hour: 'numeric',
                minute: 'numeric',
                hour12: false,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
              });
              const parts = dtf.formatToParts(now);
              const map: Record<string, string> = {};
              for (const p of parts) {
                map[p.type] = p.value;
              }
              hours = parseInt(map.hour || '0', 10);
              minutes = parseInt(map.minute || '0', 10);
              todayStr = `${map.year}-${map.month}-${map.day}`;

              // Check if tomorrow in this timezone is the 1st of next month
              const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
              const tomorrowParts = new Intl.DateTimeFormat('en-US', { timeZone: tz, day: 'numeric' }).formatToParts(tomorrow);
              const tomorrowDay = tomorrowParts.find((p) => p.type === 'day')?.value;
              isMonthEnd = tomorrowDay === '1';
            } catch {
              const tomorrow = new Date(now);
              tomorrow.setDate(now.getDate() + 1);
              isMonthEnd = tomorrow.getDate() === 1;
            }

            const currentHHmm = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;

            this.logger.info(
              { tenantId: s.tenantId, reportType, currentHHmm, targetTime, tz, willTrigger: currentHHmm === targetTime },
              'Evaluated report schedule trigger check',
            );

            // Match configured schedule time (HH:mm)
            if (currentHHmm !== targetTime) {
              continue;
            }

            const freq = item.frequency || (reportType === 'last_30_days' ? 'month_end' : 'daily');

            // If frequency is month_end, only trigger on the final day of the month!
            if (freq === 'month_end' && !isMonthEnd) {
              continue;
            }

            const lockKey = `cron:scheduled-report:${s.tenantId}:${reportType}:${todayStr}:${targetTime}`;
            const acquired = await this.redis.client.set(lockKey, '1', 'EX', 120, 'NX');
            if (!acquired) {
              continue;
            }

            this.logger.info(
              { tenantId: s.tenantId, reportType, tz, time: targetTime },
              'Triggering scheduled report',
            );

            try {
              await this.generateAndSendReport(s.tenantId, reportType);
            } catch (err: any) {
              this.logger.error({ err, tenantId: s.tenantId, reportType }, 'Failed to execute scheduled report cron');
            }
          }
        }
      }
    });
  }

  /**
   * Helper to format tickets into CSV with proper escaping and UTF-8 BOM.
   */
  private buildTicketsCsv(tickets: any[]): string {
    const headers = [
      'Ticket Number',
      'Subject',
      'Status',
      'Priority',
      'Support Tier',
      'Channel',
      'Category',
      'Subcategory',
      'Customer Name',
      'Customer Email',
      'Assigned Agent',
      'Assigned Team',
      'Assigned Queue',
      'Created At',
      'Resolved At',
      'Closed At',
    ];

    const escapeCsv = (val: any) => `"${String(val ?? '').replace(/"/g, '""')}"`;

    const rows = tickets.map((t) => [
      escapeCsv(t.number || t.id),
      escapeCsv(t.subject || ''),
      escapeCsv(t.status || ''),
      escapeCsv(t.priority || ''),
      escapeCsv(t.tier || ''),
      escapeCsv(t.channel || ''),
      escapeCsv(t.category || ''),
      escapeCsv(t.subcategory || ''),
      escapeCsv(t.requester?.fullName || ''),
      escapeCsv(t.requester?.email || ''),
      escapeCsv(t.assignee?.fullName || ''),
      escapeCsv(t.team?.name || ''),
      escapeCsv(t.queue?.name || ''),
      escapeCsv(t.createdAt ? new Date(t.createdAt).toISOString() : ''),
      escapeCsv(t.resolvedAt ? new Date(t.resolvedAt).toISOString() : ''),
      escapeCsv(t.closedAt ? new Date(t.closedAt).toISOString() : ''),
    ].join(','));

    return '\uFEFF' + [headers.map(escapeCsv).join(','), ...rows].join('\r\n');
  }
}

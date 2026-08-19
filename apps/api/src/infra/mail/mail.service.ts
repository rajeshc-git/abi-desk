import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { type MailMessage, type MailSendResult } from './mail.types';

/**
 * SMTP delivery.
 *
 * Locally this points at Mailpit, so invitations, magic links and reset mail are
 * inspectable at http://localhost:8025 without sending anything externally.
 *
 * Send failures are logged and swallowed rather than propagated. That is a
 * deliberate trade: if the mail server is briefly unreachable, a password-reset
 * request should still return 202 rather than 500. Returning an error would also
 * leak whether the address existed, since only real accounts trigger a send.
 * Delivery is best-effort here; anything that must not be lost belongs on the
 * queue instead.
 */
@Injectable()
export class MailService implements OnModuleInit, OnModuleDestroy {
  private transporter!: Transporter;
  private readonly logger: Logger;

  constructor(
    private readonly config: AppConfig,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'MailService' });
  }

  onModuleInit(): void {
    const mail = this.config.mail;

    this.transporter = createTransport({
      host: mail.host,
      port: mail.port,
      secure: mail.secure,
      ...(mail.user ? { auth: { user: mail.user, pass: mail.password ?? '' } } : {}),
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    this.logger.info({ host: mail.host, port: mail.port }, 'SMTP transport ready');
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter?.close();
  }

  /**
   * Sends a message. Never throws.
   *
   * @returns the provider result, or null when delivery failed.
   */
  async send(message: MailMessage): Promise<MailSendResult | null> {
    const to = message.to.name
      ? `"${message.to.name.replace(/"/g, '')}" <${message.to.email}>`
      : message.to.email;

    try {
      const info = await this.transporter.sendMail({
        from: this.config.mail.from,
        to,
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        headers: {
          'X-ABIDesk-Tag': message.tag,
          // Transactional mail must never be auto-replied to or bulk-filtered.
          'Auto-Submitted': 'auto-generated',
        },
      });

      this.logger.info(
        { tag: message.tag, messageId: info.messageId, accepted: info.accepted?.length ?? 0 },
        'Mail sent',
      );

      return {
        messageId: info.messageId,
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
      };
    } catch (error: unknown) {
      // The recipient address is deliberately not logged at error level alongside
      // the failure reason, to keep mail addresses out of alerting pipelines.
      this.logger.error({ err: error, tag: message.tag }, 'Mail delivery failed');
      return null;
    }
  }

  /** Confirms the SMTP server is reachable. Used by the readiness probe. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }
}

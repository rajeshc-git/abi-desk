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
  private ticketTransporter!: Transporter;
  private ticketTransporter2!: Transporter;
  private readonly logger: Logger;

  constructor(
    private readonly config: AppConfig,
    @Inject(PINO_LOGGER) rootLogger: Logger,
  ) {
    this.logger = rootLogger.child({ context: 'MailService' });
  }

  onModuleInit(): void {
    const mail = this.config.mail;
    const ticketMail = this.config.ticketMail;
    const ticketMail2 = this.config.ticketMail2;

    // 1. Primary System & Auth Transporter (donotreply@abi-health.in)
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

    this.logger.info({ host: mail.host, port: mail.port, user: mail.user }, 'System SMTP transport ready');

    // 2. Dedicated ServiceDesk / Ticket Transporter 1 (servicedesk@attunelive.com - Inbound Email & Default)
    this.ticketTransporter = createTransport({
      host: ticketMail.host,
      port: ticketMail.port,
      secure: ticketMail.secure,
      ...(ticketMail.user ? { auth: { user: ticketMail.user, pass: ticketMail.password ?? '' } } : {}),
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    this.logger.info(
      { host: ticketMail.host, port: ticketMail.port, user: ticketMail.user },
      'ServiceDesk Ticket SMTP 1 (Email / Default) transport ready',
    );

    // 3. Dedicated ServiceDesk / Ticket Transporter 2 (servicedesk@abi-health.com - Widget Channel)
    this.ticketTransporter2 = createTransport({
      host: ticketMail2.host,
      port: ticketMail2.port,
      secure: ticketMail2.secure,
      ...(ticketMail2.user ? { auth: { user: ticketMail2.user, pass: ticketMail2.password ?? '' } } : {}),
      tls: {
        rejectUnauthorized: false,
        ciphers: 'SSLv3',
      },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
    });

    this.logger.info(
      { host: ticketMail2.host, port: ticketMail2.port, user: ticketMail2.user },
      'ServiceDesk Ticket SMTP 2 (Widget Channel) transport ready',
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.transporter?.close();
    this.ticketTransporter?.close();
    this.ticketTransporter2?.close();
  }

  /**
   * Sends a general system/auth message (OTP, invitations, password reset).
   * Routed via donotreply@abi-health.in. Never throws.
   */
  async send(message: MailMessage): Promise<MailSendResult | null> {
    const to = message.to.name
      ? `"${message.to.name.replace(/"/g, '')}" <${message.to.email}>`
      : message.to.email;

    try {
      const info = await this.transporter.sendMail({
        from: this.config.mail.from,
        to,
        ...(message.cc ? { cc: message.cc } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        headers: {
          'X-ABIDesk-Tag': message.tag,
          'Auto-Submitted': 'auto-generated',
        },
      });

      this.logger.info(
        { tag: message.tag, messageId: info.messageId, accepted: info.accepted?.length ?? 0 },
        'System mail sent',
      );

      return {
        messageId: info.messageId,
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
      };
    } catch (error: unknown) {
      this.logger.error({ err: error, tag: message.tag }, 'System mail delivery failed');
      return null;
    }
  }

  /**
   * Sends a support ticket message (Ticket Creation Acknowledgment & Staff Outbound Replies).
   * Automatically routes via SMTP 2 for Widget tickets, or SMTP 1 for Email/other tickets.
   * Never throws.
   */
  async sendTicketMail(
    message: MailMessage,
    channel?: string,
  ): Promise<MailSendResult | null> {
    const isWidget = channel === 'WIDGET';
    const transporter = isWidget ? this.ticketTransporter2 : this.ticketTransporter;
    const defaultFrom = isWidget ? this.config.ticketMail2.from : this.config.ticketMail.from;

    const to = message.to.name
      ? `"${message.to.name.replace(/"/g, '')}" <${message.to.email}>`
      : message.to.email;

    try {
      const info = await transporter.sendMail({
        from: defaultFrom,
        to,
        ...(message.cc ? { cc: message.cc } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        headers: {
          'X-ABIDesk-Tag': message.tag,
          'Auto-Submitted': 'auto-generated',
        },
      });

      this.logger.info(
        {
          tag: message.tag,
          channel: channel || 'DEFAULT',
          from: defaultFrom,
          messageId: info.messageId,
          accepted: info.accepted?.length ?? 0,
        },
        'ServiceDesk ticket mail sent',
      );

      return {
        messageId: info.messageId,
        accepted: (info.accepted ?? []).map(String),
        rejected: (info.rejected ?? []).map(String),
      };
    } catch (error: unknown) {
      this.logger.error(
        { err: error, tag: message.tag, channel: channel || 'DEFAULT' },
        'ServiceDesk ticket mail delivery failed',
      );
      return null;
    }
  }

  /** Confirms the SMTP server is reachable. Used by the readiness probe. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }
}

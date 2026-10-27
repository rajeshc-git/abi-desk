import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import { type Logger } from 'pino';
import { PINO_LOGGER } from '../../common/logging/logging.module';
import { AppConfig } from '../../config/app-config';
import { type MailAttachment, type MailMessage, type MailSendResult } from './mail.types';
import {
  STICKMAN_RESOLVED_BUFFER,
  STICKMAN_CLOSED_BUFFER,
  STICKMAN_PENDING_BUFFER,
  STICKMAN_WALKING_BUFFER,
  STICKMAN_TOWARDS_BUFFER,
} from './stickman.assets';

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
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
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
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
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
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 30000,
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
        ...(this.prepareAttachments(message) ? { attachments: this.prepareAttachments(message) } : {}),
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
    if (isSystemRobotEmail(message.to.email)) {
      this.logger.warn(
        { to: message.to.email, tag: message.tag },
        'Skipping outbound ticket email to system/robot address to prevent bounce loops',
      );
      return null;
    }

    const isWidget = channel === 'WIDGET';
    const transporter = isWidget ? this.ticketTransporter2 : this.ticketTransporter;
    const defaultFrom = isWidget ? this.config.ticketMail2.from : this.config.ticketMail.from;

    const to = message.to.name
      ? `"${message.to.name.replace(/"/g, '')}" <${message.to.email}>`
      : message.to.email;

    const rawCcList: string[] = message.cc
      ? Array.isArray(message.cc)
        ? message.cc
        : [message.cc]
      : [];
    const filteredCc = rawCcList.filter((c: string) => !isSystemRobotEmail(c));

    try {
      const inReplyToHeader = message.inReplyTo ? formatMessageId(message.inReplyTo) : undefined;
      const referencesHeader = message.references
        ? (Array.isArray(message.references) ? message.references : [message.references])
            .flatMap((ref) => (typeof ref === 'string' ? ref.split(/\s+/) : []))
            .map((ref) => formatMessageId(ref))
            .filter(Boolean)
            .join(' ')
        : inReplyToHeader;

      const info = await transporter.sendMail({
        from: defaultFrom,
        to,
        ...(filteredCc && filteredCc.length > 0 ? { cc: filteredCc } : {}),
        subject: message.subject,
        text: message.text,
        html: message.html,
        ...(message.replyTo ? { replyTo: message.replyTo } : {}),
        ...(inReplyToHeader ? { inReplyTo: inReplyToHeader } : {}),
        ...(referencesHeader ? { references: referencesHeader } : {}),
        ...(this.prepareAttachments(message) ? { attachments: this.prepareAttachments(message) } : {}),
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

  private prepareAttachments(message: MailMessage): MailAttachment[] | undefined {
    const list: MailAttachment[] = message.attachments ? [...message.attachments] : [];
    if (message.html) {
      if (message.html.includes('cid:abidesk-logo') && !list.some((a) => a.cid === 'abidesk-logo')) {
        list.push({
          filename: 'abidesk-logo.png',
          content: ABI_DESK_LOGO_BUFFER,
          cid: 'abidesk-logo',
          contentType: 'image/png',
          contentDisposition: 'inline',
        });
      }
      if (message.html.includes('cid:stickman-resolved') && !list.some((a) => a.cid === 'stickman-resolved')) {
        list.push({
          filename: 'stickman-resolved.gif',
          content: STICKMAN_RESOLVED_BUFFER,
          cid: 'stickman-resolved',
          contentType: 'image/gif',
          contentDisposition: 'inline',
        });
      }
      if (message.html.includes('cid:stickman-closed') && !list.some((a) => a.cid === 'stickman-closed')) {
        list.push({
          filename: 'stickman-closed.gif',
          content: STICKMAN_CLOSED_BUFFER,
          cid: 'stickman-closed',
          contentType: 'image/gif',
          contentDisposition: 'inline',
        });
      }
      if (message.html.includes('cid:stickman-pending') && !list.some((a) => a.cid === 'stickman-pending')) {
        list.push({
          filename: 'stickman-pending.gif',
          content: STICKMAN_PENDING_BUFFER,
          cid: 'stickman-pending',
          contentType: 'image/gif',
          contentDisposition: 'inline',
        });
      }
      if (message.html.includes('cid:stickman-walking') && !list.some((a) => a.cid === 'stickman-walking')) {
        list.push({
          filename: 'stickman-walking.gif',
          content: STICKMAN_WALKING_BUFFER,
          cid: 'stickman-walking',
          contentType: 'image/gif',
          contentDisposition: 'inline',
        });
      }
      if (message.html.includes('cid:stickman-towards') && !list.some((a) => a.cid === 'stickman-towards')) {
        list.push({
          filename: 'stickman-towards.gif',
          content: STICKMAN_TOWARDS_BUFFER,
          cid: 'stickman-towards',
          contentType: 'image/gif',
          contentDisposition: 'inline',
        });
      }
    }
    return list.length > 0 ? list : undefined;
  }

  /** Confirms the SMTP server is reachable. Used by the readiness probe. */
  async verify(): Promise<void> {
    await this.transporter.verify();
  }
}

/**
 * 192x192 PNG buffer of the official ABI Desk four-color logo with center checkmark.
 * Used for high-DPI inline email rendering across Outlook, Gmail, Apple Mail, and mobile clients.
 */
export const ABI_DESK_LOGO_BASE64 =
  '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';

export const ABI_DESK_LOGO_BUFFER = Buffer.from(ABI_DESK_LOGO_BASE64, 'base64');

/**
 * Ensures an RFC 5322 message identifier is enclosed in angle brackets `<...>`.
 */
export function formatMessageId(id: string): string {
  const trimmed = id.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('<') && trimmed.endsWith('>')) {
    return trimmed;
  }
  return `<${trimmed}>`;
}

/**
 * Detects system-generated daemons, Exchange NDR mailboxes, and automated bounce addresses.
 * Used to avoid sending outbound customer notification emails to non-existent system addresses,
 * which would trigger infinite NDR bounce loops.
 */
export function isSystemRobotEmail(email: string | null | undefined): boolean {
  if (!email || typeof email !== 'string') return false;
  const clean = email.trim().toLowerCase();
  return (
    clean.startsWith('microsoftexchange') ||
    clean.startsWith('mailer-daemon@') ||
    clean === 'mailer-daemon' ||
    clean.startsWith('postmaster@')
  );
}


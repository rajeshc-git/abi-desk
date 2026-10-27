export interface MailRecipient {
  email: string;
  name?: string;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
  cid?: string;
  contentDisposition?: 'attachment' | 'inline';
}

export interface MailMessage {
  to: MailRecipient;
  subject: string;
  /** Plain-text body. Always sent - never rely on HTML alone. */
  text: string;
  html: string;
  /** Overrides the configured default, used for per-brand support addresses. */
  replyTo?: string;
  /** Optional CC email recipient(s). */
  cc?: string[] | string;
  /**
   * Groups related messages so a provider can thread them and so the delivery log
   * is queryable, e.g. `auth.magic_link`.
   */
  tag: string;
  /** Optional file attachments (Buffer payloads). */
  attachments?: MailAttachment[];
  /** In-Reply-To header for RFC 5322 email threading. */
  inReplyTo?: string;
  /** References header for RFC 5322 email threading. */
  references?: string[] | string;
}

export interface MailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}


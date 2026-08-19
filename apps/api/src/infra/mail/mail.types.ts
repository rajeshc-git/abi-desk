export interface MailRecipient {
  email: string;
  name?: string;
}

export interface MailMessage {
  to: MailRecipient;
  subject: string;
  /** Plain-text body. Always sent - never rely on HTML alone. */
  text: string;
  html: string;
  /** Overrides the configured default, used for per-brand support addresses. */
  replyTo?: string;
  /**
   * Groups related messages so a provider can thread them and so the delivery log
   * is queryable, e.g. `auth.magic_link`.
   */
  tag: string;
}

export interface MailSendResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
}

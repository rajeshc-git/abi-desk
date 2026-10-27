import { type MailMessage } from './mail.types';

/**
 * Transactional email bodies.
 *
 * Hand-written rather than templated through a rendering engine: there are five of
 * them, they must all degrade to readable plain text, and a template engine would
 * add a dependency plus a class of injection bug for no benefit at this size.
 *
 * Every message ships `text` as well as `html`. Corporate mail clients strip HTML
 * aggressively, and a password reset that arrives blank is a support ticket.
 */

const BRAND = 'ABI Desk';

/** Minimal inline-styled shell. Inline styles because email clients drop <style>. */
function layout(heading: string, bodyHtml: string, footer?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">
  <table role="presentation" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
    <tr><td style="padding:28px 32px 8px;">
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
        <tr>
          <td style="vertical-align:middle;padding-right:9px;">
            <img src="cid:abidesk-logo" width="26" height="26" alt="ABI Desk" style="display:block;width:26px;height:26px;border-radius:5px;border:0;outline:none;" />
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:17px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:24px;">
              ABI <span style="color:#2563eb;background:#eff6ff;padding:2px 6px;border-radius:4px;font-size:13.5px;font-weight:700;letter-spacing:0.02em;">DESK</span>
            </span>
          </td>
        </tr>
      </table>
      <h1 style="margin:12px 0 0;font-size:20px;line-height:1.35;font-weight:600;">${escapeHtml(heading)}</h1>
    </td></tr>
    <tr><td style="padding:12px 32px 28px;font-size:15px;line-height:1.6;color:#33415a;">
      ${bodyHtml}
    </td></tr>
  </table>
  ${footer ? `<p style="max-width:560px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#64748b;text-align:center;">${escapeHtml(footer)}</p>` : ''}
</body>
</html>`;
}

function button(url: string, label: string): string {
  // `noopener noreferrer` on a mail link costs nothing and avoids leaking the
  // token through a referrer header if the client renders in a browser frame.
  return `<p style="margin:24px 0;">
    <a href="${escapeAttribute(url)}" rel="noopener noreferrer"
       style="display:inline-block;padding:11px 22px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px;">${escapeHtml(label)}</a>
  </p>
  <p style="margin:0;font-size:13px;color:#64748b;">If the button does not work, paste this into your browser:<br>
    <span style="word-break:break-all;color:#2563eb;">${escapeHtml(url)}</span>
  </p>`;
}

/** Escapes text destined for HTML element content. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Formats rich text or plain text content for safe, robust rendering in email HTML.
 * If the input contains HTML tags (such as <b>, <strong>, <i>, <em>, <u>, <p>, <div>, <h1-6>, <table>, etc.),
 * it removes unsafe elements (<script>, <style>, event handlers) and standardizes formatting.
 * If the input is plain text, it safely escapes HTML entities and converts newlines to <br />.
 */
export function formatRichTextForEmail(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';

  // Check if string contains any HTML tag (e.g. <b>, <strong>, <i>, <u>, <p>, <div>, <h1-6>, <br>, <table>, <a>, etc.)
  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    let cleaned = trimmed
      .replace(/<!DOCTYPE[^>]*>/gi, '')
      .replace(/<\/?(html|head|body)[^>]*>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<link[^>]*>/gi, '')
      .replace(/<meta[^>]*>/gi, '')
      .replace(/<title[\s\S]*?<\/title>/gi, '')
      .replace(/\s*on\w+\s*=\s*(["'][^"']*["']|[^\s>]+)/gi, '')
      .trim();

    // Clean up heading tags to render cleanly with email-safe inline styles
    cleaned = cleaned
      .replace(/<h[1-6]([^>]*)>/gi, '<div$1 style="margin: 6px 0; font-size: 15px; font-weight: bold; color: #0f172a;">')
      .replace(/<\/h[1-6]>/gi, '</div>');

    // Ensure copied tables have clean inline borders and spacing across Outlook and Gmail
    if (/<table[^>]*>/i.test(cleaned)) {
      cleaned = cleaned
        .replace(/<table(?![^>]*style=)[^>]*>/gi, '<table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; border: 1px solid #cbd5e1; margin: 6px 0; width: auto; max-width: 100%; font-size: 13px; line-height: 1.35; font-family: inherit;">')
        .replace(/<table([^>]*style=["'])([^"']*)(["'][^>]*)>/gi, '<table$1border-collapse: collapse; border: 1px solid #cbd5e1; margin: 6px 0; width: auto; max-width: 100%; font-size: 13px; line-height: 1.35; font-family: inherit; $2$3 border="1" cellpadding="5" cellspacing="0">')
        .replace(/<td(?![^>]*style=)[^>]*>/gi, '<td style="border: 1px solid #cbd5e1; padding: 4px 8px; font-family: inherit; font-size: 13px; line-height: 1.35;">')
        .replace(/<th(?![^>]*style=)[^>]*>/gi, '<th style="border: 1px solid #cbd5e1; padding: 4px 8px; font-family: inherit; background-color: #f8fafc; font-weight: 600; font-size: 13px; line-height: 1.35; white-space: nowrap; text-align: left;">');
    }

    return cleaned;
  }

  return escapeHtml(trimmed).replace(/\r\n|\r|\n/g, '<br />');
}

/**
 * Converts programmatic uppercase enum status (e.g. AWAITING_CUSTOMER_CONFIRMATION, PENDING_CUSTOMER)
 * into a human-readable label without underscores for customer-facing emails.
 */
export function formatHumanStatusLabel(status: string | null | undefined): string {
  if (!status) return '';
  const clean = status.trim().toUpperCase();
  switch (clean) {
    case 'AWAITING_CUSTOMER_CONFIRMATION':
      return 'Awaiting Customer Confirmation';
    case 'PENDING_CUSTOMER':
      return 'Pending Customer';
    case 'RESOLVED':
      return 'Resolved';
    case 'CLOSED':
      return 'Closed';
    case 'REOPENED':
      return 'Reopened';
    case 'RECEIVED':
      return 'Received';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'ON_HOLD':
      return 'On Hold';
    case 'CANCELLED':
      return 'Cancelled';
    default:
      return clean
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

/** Escapes text destined for an HTML attribute value. */
function escapeAttribute(value: string): string {
  return escapeHtml(value);
}

function expiryPhrase(minutes: number): string {
  if (minutes % 60 === 0 && minutes >= 60) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
  return `${minutes} minute${minutes === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

export function magicLinkEmail(options: {
  email: string;
  url: string;
  expiresInMinutes: number;
  brandName: string;
}): MailMessage {
  const expiry = expiryPhrase(options.expiresInMinutes);
  const heading = 'Your sign-in link';

  return {
    to: { email: options.email },
    subject: `${options.brandName} support: your sign-in link`,
    tag: 'auth.magic_link',
    text: [
      `${heading}`,
      '',
      `Use the link below to sign in and track your ${options.brandName} support requests.`,
      '',
      options.url,
      '',
      `This link expires in ${expiry} and can only be used once.`,
      'If you did not request it, you can safely ignore this email.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;">Use the link below to sign in and track your ${escapeHtml(options.brandName)} support requests.</p>
       ${button(options.url, 'Sign in')}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">This link expires in ${escapeHtml(expiry)} and can only be used once.</p>`,
      'If you did not request this email, you can safely ignore it.',
    ),
  };
}

export function passwordResetEmail(options: {
  email: string;
  fullName: string;
  url: string;
  expiresInMinutes: number;
}): MailMessage {
  const expiry = expiryPhrase(options.expiresInMinutes);
  const heading = 'Reset your password';

  return {
    to: { email: options.email, name: options.fullName },
    subject: `${BRAND}: reset your password`,
    tag: 'auth.password_reset',
    text: [
      `Hi ${options.fullName},`,
      '',
      'Someone asked to reset the password for your ABI Desk account.',
      '',
      options.url,
      '',
      `This link expires in ${expiry} and can only be used once.`,
      'Resetting your password signs you out of every device.',
      '',
      'If this was not you, no action is needed - your password has not changed.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;">Hi ${escapeHtml(options.fullName)}, someone asked to reset the password for your ${escapeHtml(BRAND)} account.</p>
       ${button(options.url, 'Choose a new password')}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">This link expires in ${escapeHtml(expiry)} and can only be used once. Resetting your password signs you out of every device.</p>`,
      'If this was not you, no action is needed - your password has not changed.',
    ),
  };
}

export function invitationEmail(options: {
  email: string;
  inviterName: string;
  tenantName: string;
  roleName: string;
  url: string;
  expiresInDays: number;
  message?: string;
}): MailMessage {
  const heading = `Join ${options.tenantName} on ${BRAND}`;

  return {
    to: { email: options.email },
    subject: `${options.inviterName} invited you to ${options.tenantName} support`,
    tag: 'auth.invitation',
    text: [
      heading,
      '',
      `${options.inviterName} invited you to join ${options.tenantName} as ${options.roleName}.`,
      ...(options.message ? ['', `"${options.message}"`] : []),
      '',
      options.url,
      '',
      `This invitation expires in ${options.expiresInDays} day${options.expiresInDays === 1 ? '' : 's'}.`,
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;">${escapeHtml(options.inviterName)} invited you to join
        <strong>${escapeHtml(options.tenantName)}</strong> as <strong>${escapeHtml(options.roleName)}</strong>.</p>
       ${options.message ? `<blockquote style="margin:18px 0;padding:12px 16px;border-left:3px solid #cbd5e1;background:#f8fafc;color:#475569;font-size:14px;">${escapeHtml(options.message)}</blockquote>` : ''}
       ${button(options.url, 'Accept invitation')}
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">This invitation expires in ${options.expiresInDays} day${options.expiresInDays === 1 ? '' : 's'}.</p>`,
    ),
  };
}

export function passwordChangedEmail(options: {
  email: string;
  fullName: string;
  changedAt: Date;
  ipAddress?: string;
}): MailMessage {
  const heading = 'Your password was changed';
  const when = options.changedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  const from = options.ipAddress ? ` from ${options.ipAddress}` : '';

  return {
    to: { email: options.email, name: options.fullName },
    subject: `${BRAND}: your password was changed`,
    tag: 'auth.password_changed',
    // Notification, not an action - deliberately contains no link, so it cannot be
    // repurposed as a phishing template.
    text: [
      `Hi ${options.fullName},`,
      '',
      `Your ABI Desk password was changed on ${when}${from}.`,
      'Every other session has been signed out.',
      '',
      'If this was not you, contact your administrator immediately.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;">Hi ${escapeHtml(options.fullName)}, your ${escapeHtml(BRAND)} password was changed on
        <strong>${escapeHtml(when)}</strong>${from ? ` from <strong>${escapeHtml(options.ipAddress ?? '')}</strong>` : ''}.</p>
       <p style="margin:14px 0 0;">Every other session has been signed out.</p>`,
      'If this was not you, contact your administrator immediately.',
    ),
  };
}

export function suspiciousRefreshEmail(options: {
  email: string;
  fullName: string;
  detectedAt: Date;
  ipAddress?: string;
}): MailMessage {
  const heading = 'We signed you out as a precaution';
  const when = options.detectedAt.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';

  return {
    to: { email: options.email, name: options.fullName },
    subject: `${BRAND}: unusual sign-in activity`,
    tag: 'auth.token_reuse',
    text: [
      `Hi ${options.fullName},`,
      '',
      `At ${when} an already-used sign-in token was presented for your account${options.ipAddress ? ` from ${options.ipAddress}` : ''}.`,
      'That usually means a token was copied, so we signed out every session on this account.',
      '',
      'Sign in again to continue. If you did not expect this, change your password.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;">Hi ${escapeHtml(options.fullName)}, at <strong>${escapeHtml(when)}</strong> an already-used sign-in token was presented for your account${options.ipAddress ? ` from <strong>${escapeHtml(options.ipAddress)}</strong>` : ''}.</p>
       <p style="margin:14px 0 0;">That usually means a token was copied, so we signed out every session on this account as a precaution.</p>`,
      'Sign in again to continue. If you did not expect this, change your password.',
    ),
  };
}

export function welcomeRegistrationEmail(options: {
  email: string;
  fullName: string;
  companyName: string;
  loginUrl: string;
}): MailMessage {
  const heading = `Welcome to ABI Desk, ${options.fullName}!`;

  return {
    to: { email: options.email, name: options.fullName },
    subject: `Welcome to ABI Desk - ${options.companyName} Organization Created`,
    tag: 'auth.welcome_registration',
    text: [
      `Hi ${options.fullName},`,
      '',
      `Your organization "${options.companyName}" has been registered successfully on ABI Desk.`,
      'You are configured as the Primary Tenant Administrator.',
      '',
      `Sign in to your console: ${options.loginUrl}`,
      '',
      'From your console you can invite teammates, customize your brand, configure SLA policies, and embed support widgets.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;font-size:16px;">Hi <strong>${escapeHtml(options.fullName)}</strong>,</p>
       <p style="margin:14px 0 0;">Congratulations! Your organization <strong>${escapeHtml(options.companyName)}</strong> has been registered successfully on <strong>${escapeHtml(BRAND)}</strong>.</p>
       <p style="margin:14px 0 0;">Your account has been granted full <strong>Tenant Administrator</strong> authority.</p>
       ${button(options.loginUrl, 'Open Support Console')}
       <div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569;">
         <strong>Next Steps:</strong>
         <ul style="margin:8px 0 0;padding-left:20px;">
           <li>Invite your support team under <em>Admin Center &rarr; Staff Directory</em></li>
           <li>Customize your brand colors and support queues</li>
           <li>Copy your embeddable widget snippet for your customer websites</li>
         </ul>
       </div>`,
      'Security notice: If you did not register this account, please ignore this email.',
    ),
  };
}

export function registrationOtpEmail(options: {
  email: string;
  fullName: string;
  companyName: string;
  otp: string;
  expiresInMinutes: number;
}): MailMessage {
  const expiry = expiryPhrase(options.expiresInMinutes);
  const heading = 'Verify your email address';

  return {
    to: { email: options.email, name: options.fullName },
    subject: `ABI Desk: Verification code for ${options.companyName}`,
    tag: 'auth.registration_otp',
    text: [
      `Hi ${options.fullName},`,
      '',
      `Thank you for registering your organization "${options.companyName}" on ABI Desk.`,
      '',
      `Your verification code is: ${options.otp}`,
      '',
      `This code expires in ${expiry}.`,
      'If you did not request this code, you can safely ignore this email.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;font-size:16px;">Hi <strong>${escapeHtml(options.fullName)}</strong>,</p>
       <p style="margin:14px 0 0;">Thank you for registering your organization <strong>${escapeHtml(options.companyName)}</strong> on <strong>${escapeHtml(BRAND)}</strong>.</p>
       <p style="margin:20px 0;font-size:24px;font-weight:bold;letter-spacing:4px;text-align:center;color:#2563eb;">
         ${escapeHtml(options.otp)}
       </p>
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">This verification code expires in ${escapeHtml(expiry)}.</p>`,
      'If you did not request this code, you can safely ignore this email.',
    ),
  };
}

export function widgetOtpEmail(options: {
  email: string;
  otp: string;
  brandName: string;
}): MailMessage {
  const heading = 'Verify your email address';

  return {
    to: { email: options.email },
    subject: `${options.brandName} support: verification code`,
    tag: 'auth.widget_otp',
    text: [
      `Your verification code is: ${options.otp}`,
      '',
      `This code will expire in 5 minutes.`,
      'If you did not request this code, you can safely ignore this email.',
    ].join('\n'),
    html: layout(
      heading,
      `<p style="margin:0;font-size:16px;">Hi,</p>
       <p style="margin:14px 0 0;">Here is your verification code to access support on <strong>${escapeHtml(options.brandName)}</strong>:</p>
       <p style="margin:24px 0;font-size:32px;font-weight:bold;letter-spacing:6px;text-align:center;color:#2563eb;background:#f8fafc;padding:16px;border-radius:8px;border:1px dashed #e2e8f0;width:fit-content;margin-left:auto;margin-right:auto;">
         ${escapeHtml(options.otp)}
       </p>
       <p style="margin:20px 0 0;font-size:13px;color:#64748b;">This verification code expires in 5 minutes.</p>`,
      'If you did not request this code, you can safely ignore this email.',
    ),
  };
}

export interface TicketNotificationEmailOptions {
  title: string;
  recipientName: string;
  message: string;
  noteFromTeam?: string | null;
  ticketNumber: string;
  ticketSubject: string;
  statusLabel: string;
  statusType?: 'resolved' | 'closed' | 'pending' | 'received' | 'reopened' | 'default';
  updateTimestamp?: string;
  subFooterNote: string;
  updateToken?: string;
}

export function renderTicketNotificationEmail(options: TicketNotificationEmailOptions): string {
  const {
    title,
    recipientName,
    message,
    noteFromTeam,
    ticketNumber,
    ticketSubject,
    statusLabel,
    statusType = 'default',
    updateTimestamp,
    subFooterNote,
    updateToken,
  } = options;

  let badgeBg = '#e0f2fe';
  let badgeText = '#0369a1';
  let badgeBorder = '#bae6fd';

  if (statusType === 'resolved') {
    badgeBg = '#dcfce7';
    badgeText = '#15803d';
    badgeBorder = '#bbf7d0';
  } else if (statusType === 'closed') {
    badgeBg = '#f1f5f9';
    badgeText = '#475569';
    badgeBorder = '#cbd5e1';
  } else if (statusType === 'pending') {
    badgeBg = '#fef3c7';
    badgeText = '#b45309';
    badgeBorder = '#fde68a';
  }

  // Stepper state calculations
  let activeStep = 1;
  let stickmanCid = 'cid:stickman-walking';
  let step1Label = 'Received';
  let step2Label = 'In Progress';
  let step3Label = 'Resolved';
  let connector1Color = '#e2e8f0';
  let connector2Color = '#e2e8f0';
  let node1Html = '';
  let node2Html = '';
  let node3Html = '';

  if (statusType === 'pending') {
    activeStep = 2;
    stickmanCid = 'cid:stickman-pending';
    step2Label = 'Awaiting Your Input';
    connector1Color = '#f59e0b';
    connector2Color = '#e2e8f0';
    node1Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node2Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#d97706;border:2px solid #fde68a;color:#ffffff;font-size:11px;line-height:18px;text-align:center;font-weight:bold;">!</div>';
    node3Html = '<div style="width:18px;height:18px;border-radius:50%;background-color:#f1f5f9;border:1.5px solid #cbd5e1;"></div>';
  } else if (statusType === 'resolved') {
    activeStep = 3;
    stickmanCid = 'cid:stickman-resolved';
    step2Label = 'In Progress';
    step3Label = 'Resolved';
    connector1Color = '#16a34a';
    connector2Color = '#16a34a';
    node1Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node2Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node3Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;border:2px solid #86efac;color:#ffffff;font-size:11px;line-height:18px;text-align:center;font-weight:bold;">&#10003;</div>';
  } else if (statusType === 'closed') {
    activeStep = 3;
    stickmanCid = 'cid:stickman-closed';
    step2Label = 'Resolved';
    step3Label = 'Closed';
    connector1Color = '#16a34a';
    connector2Color = '#475569';
    node1Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node2Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node3Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#475569;border:2px solid #94a3b8;color:#ffffff;font-size:11px;line-height:18px;text-align:center;font-weight:bold;">&#10003;</div>';
  } else if (statusType === 'reopened') {
    activeStep = 2;
    stickmanCid = 'cid:stickman-walking';
    step2Label = 'In Progress';
    step3Label = 'Resolution';
    connector1Color = '#2563eb';
    connector2Color = '#e2e8f0';
    node1Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node2Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#2563eb;border:2px solid #93c5fd;color:#ffffff;font-size:11px;line-height:18px;text-align:center;font-weight:bold;">&bull;</div>';
    node3Html = '<div style="width:18px;height:18px;border-radius:50%;background-color:#f1f5f9;border:1.5px solid #cbd5e1;"></div>';
  } else {
    // received or default acknowledgment
    activeStep = 1;
    stickmanCid = 'cid:stickman-towards';
    step1Label = 'Received';
    step2Label = 'In Progress';
    step3Label = 'Resolved';
    connector1Color = '#16a34a'; // solid green line
    connector2Color = '#e2e8f0';
    node1Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;color:#ffffff;font-size:11px;line-height:20px;text-align:center;font-weight:bold;">&#10003;</div>';
    node2Html = '<div style="width:20px;height:20px;border-radius:50%;background-color:#16a34a;border:2px solid #86efac;color:#ffffff;font-size:11px;line-height:18px;text-align:center;font-weight:bold;">&bull;</div>';
    node3Html = '<div style="width:18px;height:18px;border-radius:50%;background-color:#f1f5f9;border:1.5px solid #cbd5e1;"></div>';
  }

  const hasNoteContent = Boolean(
    noteFromTeam &&
      noteFromTeam
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .trim().length > 0,
  );
  const formattedNote = hasNoteContent ? formatRichTextForEmail(noteFromTeam) : '';

  return `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; max-width: 580px; margin: 0 auto; padding: 26px 24px; border: 1px solid #e2e8f0; border-radius: 10px; background-color: #ffffff; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
  <!-- Brand Header -->
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin-bottom:20px;padding-bottom:14px;border-bottom:1px solid #f1f5f9;">
    <tr>
      <td style="vertical-align:middle;">
        <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="vertical-align:middle;padding-right:9px;">
              <img src="cid:abidesk-logo" width="26" height="26" alt="ABI Desk" style="display:block;width:26px;height:26px;border-radius:5px;border:0;outline:none;" />
            </td>
            <td style="vertical-align:middle;">
              <span style="font-size:17px;font-weight:800;letter-spacing:-0.03em;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;line-height:24px;">
                ABI <span style="color:#2563eb;background:#eff6ff;padding:2px 6px;border-radius:4px;font-size:13.5px;font-weight:700;letter-spacing:0.02em;">DESK</span>
              </span>
            </td>
          </tr>
        </table>
      </td>
      <td align="right" style="vertical-align:middle;">
        <span style="font-size:11.5px;font-weight:600;color:#64748b;letter-spacing:0.02em;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">Support Center</span>
      </td>
    </tr>
  </table>

  <!-- Main Card Content -->
  <div style="margin-bottom: 14px;">
    <h2 style="margin: 0; color: #0f172a; font-size: 19px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.35;">
      ${escapeHtml(title)}
    </h2>
  </div>

  <p style="font-size: 14.5px; line-height: 1.6; color: #334155; margin: 0 0 14px 0;">
    Hello <strong>${escapeHtml(recipientName)}</strong>,
  </p>
  <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 18px 0;">
    ${message}
  </p>

  ${
    hasNoteContent
      ? `
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #3b82f6; padding: 12px 16px; margin: 0 0 18px 0; border-radius: 0 6px 6px 0;">
    <p style="margin: 0; font-size: 11px; color: #64748b; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;">Note from Support Team</p>
    <div style="margin: 6px 0 0 0; font-size: 13.5px; line-height: 1.5; color: #1e293b;">${formattedNote}</div>
  </div>
  `
      : ''
  }

  <!-- Modern Progress Stepper with Animated Stickman Character -->
  <div style="background: linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 9px; padding: 10px 16px 14px 16px; margin: 18px 0 20px 0;">
    <!-- Row 1: Stickman Animation -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        ${
          statusType === 'received' || statusType === 'default'
            ? `
        <td width="67%" align="center" style="vertical-align:bottom;height:42px;padding:0;">
          <img src="cid:stickman-towards" width="160" height="42" alt="In Progress" style="display:inline-block;width:160px;height:42px;border:0;outline:none;" />
        </td>
        <td width="33%" align="center" style="vertical-align:bottom;height:42px;padding:0;"></td>
        `
            : `
        <td width="33%" align="center" style="vertical-align:bottom;height:42px;padding:0;">
          ${activeStep === 1 ? `<img src="${stickmanCid}" width="40" height="40" alt="Status" style="display:inline-block;width:40px;height:40px;border:0;outline:none;" />` : ''}
        </td>
        <td width="34%" align="center" style="vertical-align:bottom;height:42px;padding:0;">
          ${activeStep === 2 ? `<img src="${stickmanCid}" width="40" height="40" alt="Status" style="display:inline-block;width:40px;height:40px;border:0;outline:none;" />` : ''}
        </td>
        <td width="33%" align="center" style="vertical-align:bottom;height:42px;padding:0;">
          ${activeStep === 3 ? `<img src="${stickmanCid}" width="40" height="40" alt="Status" style="display:inline-block;width:40px;height:40px;border:0;outline:none;" />` : ''}
        </td>
        `
        }
      </tr>
    </table>

    <!-- Row 2: Milestone Nodes & Connecting Tracks -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;margin: 2px 0 4px 0;">
      <tr>
        <td width="16%" style="padding:0;"></td>
        <td width="20" align="center" style="vertical-align:middle;padding:0;width:20px;">
          ${node1Html}
        </td>
        <td style="vertical-align:middle;padding:0;">
          <div style="height:3px;background-color:${connector1Color};border-radius:2px;"></div>
        </td>
        <td width="20" align="center" style="vertical-align:middle;padding:0;width:20px;">
          ${node2Html}
        </td>
        <td style="vertical-align:middle;padding:0;">
          <div style="height:3px;background-color:${connector2Color};border-radius:2px;"></div>
        </td>
        <td width="20" align="center" style="vertical-align:middle;padding:0;width:20px;">
          ${node3Html}
        </td>
        <td width="16%" style="padding:0;"></td>
      </tr>
    </table>

    <!-- Row 3: Milestone Labels -->
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;">
      <tr>
        <td width="33%" align="center" style="vertical-align:top;padding:4px 2px 0 2px;">
          <span style="font-size:11.5px;font-weight:${statusType === 'received' ? '600' : activeStep === 1 ? '700' : '500'};color:${statusType === 'received' ? '#475569' : activeStep === 1 ? '#0f172a' : '#64748b'};display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${step1Label}</span>
        </td>
        <td width="34%" align="center" style="vertical-align:top;padding:4px 2px 0 2px;">
          <span style="font-size:11.5px;font-weight:${statusType === 'received' ? '700' : activeStep === 2 ? '700' : '500'};color:${statusType === 'received' ? '#0f172a' : activeStep === 2 ? '#0f172a' : '#64748b'};display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${step2Label}</span>
        </td>
        <td width="33%" align="center" style="vertical-align:top;padding:4px 2px 0 2px;">
          <span style="font-size:11.5px;font-weight:${activeStep === 3 ? '700' : '500'};color:${activeStep === 3 ? '#0f172a' : '#64748b'};display:block;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">${step3Label}</span>
        </td>
      </tr>
    </table>
  </div>

  <!-- Ticket Status Box -->
  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; padding: 14px 16px; border-radius: 8px;">
    <p style="margin: 0 0 8px 0; font-size: 13px; color: #475569; line-height: 24px;">
      <strong style="color: #0f172a; margin-right: 4px;">Ticket:</strong>
      <code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; font-weight: 700; color: #0f172a; background-color: #ffffff; border: 1px solid #cbd5e1; padding: 3px 8px; border-radius: 5px; user-select: all; -webkit-user-select: all;">#${escapeHtml(ticketNumber)}</code>
    </p>
    <p style="margin: 0 0 10px 0; font-size: 13px; color: #475569;">
      <strong style="color: #0f172a;">Status:</strong> 
      <span style="display: inline-block; padding: 2px 8px; border-radius: 4px; background: ${badgeBg}; color: ${badgeText}; border: 1px solid ${badgeBorder}; font-weight: 700; font-size: 11.5px;">${escapeHtml(formatHumanStatusLabel(statusLabel))}</span>
      ${updateTimestamp ? `<span style="font-size: 11.5px; color: #64748b; margin-left: 6px;">(${escapeHtml(updateTimestamp)})</span>` : ''}
    </p>
    <p style="margin: 0; padding-top: 10px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #64748b; line-height: 1.4;">
      ${escapeHtml(subFooterNote)}
    </p>
  </div>

  ${updateToken ? `<span style="display:none;font-size:0;line-height:0;color:transparent;opacity:0;">[${escapeHtml(updateToken)}]</span>` : ''}
</div>
`.trim();
}

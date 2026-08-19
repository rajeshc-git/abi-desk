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
          <td style="vertical-align:middle;padding-right:10px;">
            <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
              <tr>
                <td style="padding:0 2px 2px 0;"><div style="width:11px;height:11px;background-color:#ef4444;border-radius:3px;"></div></td>
                <td style="padding:0 0 2px 2px;"><div style="width:11px;height:11px;background-color:#10b981;border-radius:3px;"></div></td>
              </tr>
              <tr>
                <td style="padding:2px 2px 0 0;"><div style="width:11px;height:11px;background-color:#3b82f6;border-radius:3px;"></div></td>
                <td style="padding:2px 0 0 2px;"><div style="width:11px;height:11px;background-color:#f59e0b;border-radius:3px;"></div></td>
              </tr>
            </table>
          </td>
          <td style="vertical-align:middle;">
            <span style="font-size:18px;font-weight:700;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:22px;">${escapeHtml(BRAND)}</span>
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

import { Resend } from 'resend';

const DEFAULT_FROM = 'Provenance <noreply@provenance.guru>';

/**
 * Check if email is configured (Resend API key is set).
 */
export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Resend is not configured. Set RESEND_API_KEY to enable emails.');
  }
  return new Resend(apiKey);
}

function getFromAddress(): string {
  return process.env.RESEND_FROM || DEFAULT_FROM;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using Resend.
 * Returns silently if Resend is not configured (email is optional).
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!isEmailConfigured()) {
    console.log(
      '[Email] Not configured. Skipping send. Set RESEND_API_KEY to enable emails.',
    );
    return;
  }

  try {
    console.log('[Email] Sending email to', options.to, options.subject);
    const resend = getResendClient();
    const from = getFromAddress();
    const { data, error } = await resend.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    });

    if (error) {
      console.error('[Email] Send failed', error);
      return;
    }
    console.log('[Email] Sent successfully', data?.id);
  } catch (error) {
    console.error('[Email] Send error', error);
    // Don't throw - email sending is optional and shouldn't break the app
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const subject = 'Welcome to Provenance!';
  const html = getWelcomeEmailTemplate(name);

  await sendEmail({
    to: email,
    subject,
    html,
  });
}

/**
 * Send certification email when artwork is created
 */
export async function sendCertificationEmail(
  email: string,
  name: string,
  artworkTitle: string,
  certificateNumber: string,
  artworkUrl: string,
): Promise<void> {
  const subject = `Your artwork "${artworkTitle}" has been certified`;
  const html = getCertificationEmailTemplate(name, artworkTitle, certificateNumber, artworkUrl);

  await sendEmail({
    to: email,
    subject,
    html,
  });
}

export interface NotificationEmailParams {
  title: string;
  body: string;
  ctaUrl?: string;
  ctaLabel?: string;
}

/**
 * Send a notification email (alerts, one-off updates)
 */
export async function sendNotificationEmail(
  email: string,
  name: string,
  subject: string,
  params: NotificationEmailParams,
): Promise<void> {
  const html = getNotificationEmailTemplate(name, params.title, params.body, params.ctaUrl, params.ctaLabel);
  await sendEmail({ to: email, subject, html });
}

export interface SummaryItem {
  title: string;
  description?: string;
}

/**
 * Send a summary email (periodic digest of items)
 */
export async function sendSummaryEmail(
  email: string,
  name: string,
  subject: string,
  items: SummaryItem[],
  period?: string,
): Promise<void> {
  const html = getSummaryEmailTemplate(name, items, period);
  await sendEmail({ to: email, subject, html });
}

export interface UpdateEmailParams {
  title: string;
  body: string;
  link?: string;
  linkLabel?: string;
}

/**
 * Send an update email (product/news updates)
 */
export async function sendUpdateEmail(
  email: string,
  name: string,
  subject: string,
  params: UpdateEmailParams,
): Promise<void> {
  const html = getUpdateEmailTemplate(name, params.title, params.body, params.link, params.linkLabel);
  await sendEmail({ to: email, subject, html });
}

/**
 * Welcome email template
 */
function getWelcomeEmailTemplate(name: string): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Provenance</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      Welcome to Provenance!
    </h1>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${displayName},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Thank you for joining Provenance! We're excited to have you as part of our community of artists and collectors.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      With Provenance, you can:
    </p>
    
    <ul style="font-size: 16px; margin-bottom: 30px; color: #4b5563; padding-left: 20px;">
      <li style="margin-bottom: 10px;">Create and manage your artwork portfolio</li>
      <li style="margin-bottom: 10px;">Generate digital certificates of authenticity</li>
      <li style="margin-bottom: 10px;">Track the provenance of your pieces</li>
      <li style="margin-bottom: 10px;">Connect with collectors and other artists</li>
    </ul>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${siteUrl}/artworks/add" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Get Started
      </a>
    </div>
    
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      If you have any questions, feel free to reach out to us. We're here to help!
    </p>
    
    <p style="font-size: 14px; margin-top: 10px; color: #6b7280;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Certification email template
 */
function getCertificationEmailTemplate(
  name: string,
  artworkTitle: string,
  certificateNumber: string,
  artworkUrl: string,
): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Artwork Has Been Certified</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      Your Artwork Has Been Certified! 🎨
    </h1>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${displayName},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Great news! Your artwork <strong>"${artworkTitle}"</strong> has been successfully uploaded and certified on Provenance.
    </p>
    
    <div style="background-color: #f9fafb; border-left: 4px solid #7f1d1d; padding: 20px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #6b7280; margin-bottom: 8px;">
        <strong>Certificate Number:</strong>
      </p>
      <p style="margin: 0; font-size: 20px; color: #7f1d1d; font-weight: 600; font-family: monospace;">
        ${certificateNumber}
      </p>
    </div>
    
    <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
      Your digital certificate of authenticity has been generated and is now part of the permanent record on Provenance. This certificate helps establish the provenance and authenticity of your artwork.
    </p>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${artworkUrl}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Your Artwork
      </a>
    </div>
    
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      You can share this certificate with collectors, galleries, or anyone interested in verifying the authenticity of your work.
    </p>
    
    <p style="font-size: 14px; margin-top: 10px; color: #6b7280;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Notification email template
 */
function getNotificationEmailTemplate(
  name: string,
  title: string,
  body: string,
  ctaUrl?: string,
  ctaLabel?: string,
): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const url = ctaUrl || siteUrl;
  const label = ctaLabel || 'View';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      ${escapeHtml(title)}
    </h1>
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${escapeHtml(displayName)},
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      ${escapeHtml(body)}
    </p>
    ${ctaUrl || ctaLabel ? `
    <div style="text-align: center; margin: 40px 0;">
      <a href="${escapeHtml(url)}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        ${escapeHtml(label)}
      </a>
    </div>
    ` : ''}
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Summary email template
 */
function getSummaryEmailTemplate(
  name: string,
  items: SummaryItem[],
  period?: string,
): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const periodLabel = period || 'Summary';

  const itemsHtml = items
    .map(
      (item) => `
    <li style="margin-bottom: 16px;">
      <strong style="color: #7f1d1d;">${escapeHtml(item.title)}</strong>
      ${item.description ? `<br><span style="font-size: 14px; color: #6b7280;">${escapeHtml(item.description)}</span>` : ''}
    </li>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your ${escapeHtml(periodLabel)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      Your ${escapeHtml(periodLabel)}
    </h1>
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${escapeHtml(displayName)},
    </p>
    <p style="font-size: 16px; margin-bottom: 24px; color: #4b5563;">
      Here's what's been happening on Provenance:
    </p>
    <ul style="font-size: 16px; margin-bottom: 30px; color: #4b5563; padding-left: 20px; list-style: none;">
      ${itemsHtml}
    </ul>
    <div style="text-align: center; margin: 40px 0;">
      <a href="${siteUrl}/portal" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Open Portal
      </a>
    </div>
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Update email template
 */
function getUpdateEmailTemplate(
  name: string,
  title: string,
  body: string,
  link?: string,
  linkLabel?: string,
): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
  const url = link || siteUrl;
  const label = linkLabel || 'Learn more';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      ${escapeHtml(title)}
    </h1>
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${escapeHtml(displayName)},
    </p>
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      ${escapeHtml(body)}
    </p>
    <div style="text-align: center; margin: 40px 0;">
      <a href="${escapeHtml(url)}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        ${escapeHtml(label)}
      </a>
    </div>
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Escape HTML to prevent XSS in templates
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Strip HTML tags to create plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}


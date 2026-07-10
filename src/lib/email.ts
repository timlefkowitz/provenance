import { Resend } from 'resend';
import {
  getCertificationEmailSubject,
  getArtworkFeaturedEmailSubject,
  getInstitutionThanksEmailSubject,
  getInviteEmailSubject,
  getWelcomeEmailSubject,
  renderArtworkFeaturedEmailHtml,
  renderCertificationEmailHtml,
  renderInstitutionThanksEmailHtml,
  renderInviteEmailHtml,
  renderNotificationEmailHtml,
  renderSummaryEmailHtml,
  renderUpdateEmailHtml,
  renderWelcomeEmailHtml,
} from '~/lib/email-templates-store';
import type { SummaryItem } from '~/lib/email-defaults';
import {
  buildBulletproofButtonTable,
  buildEmailHtml,
  escapeHtml,
} from '~/lib/email-layout';
import { getPresetThemeDefaults } from '~/lib/email-layout-presets';

import { asUntyped } from '~/lib/supabase-untyped';
export type { SummaryItem } from '~/lib/email-defaults';

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
 * Send one email via Resend and return success or error (for admin test sends).
 * Does not no-op when unconfigured — callers should surface the error.
 */
export async function sendTransactionalEmailStrict(
  options: SendEmailOptions,
): Promise<{ ok: true } | { ok: false; error: string }> {
  console.log('[Email] sendTransactionalEmailStrict started', options.subject);
  if (!isEmailConfigured()) {
    console.error('[Email] sendTransactionalEmailStrict: RESEND_API_KEY missing');
    return { ok: false, error: 'Resend is not configured. Set RESEND_API_KEY to send email.' };
  }

  try {
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
      console.error('[Email] sendTransactionalEmailStrict Resend error', error);
      return { ok: false, error: error.message || 'Resend rejected the send' };
    }
    console.log('[Email] sendTransactionalEmailStrict sent', data?.id);
    return { ok: true };
  } catch (err) {
    console.error('[Email] sendTransactionalEmailStrict failed', err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to send email',
    };
  }
}

/**
 * Send welcome email to new users (body + theme from DB when configured).
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const [subject, html] = await Promise.all([
    getWelcomeEmailSubject(),
    renderWelcomeEmailHtml(name),
  ]);

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
  const [subject, html] = await Promise.all([
    getCertificationEmailSubject(artworkTitle),
    renderCertificationEmailHtml(name, artworkTitle, certificateNumber, artworkUrl),
  ]);

  await sendEmail({
    to: email,
    subject,
    html,
  });
}

/**
 * Send featured email to an artist when their artwork is added to the homepage queue
 */
export async function sendArtworkFeaturedEmail(
  email: string,
  artistName: string,
  artworkTitle: string,
  artworkUrl: string,
): Promise<void> {
  const [subject, html] = await Promise.all([
    getArtworkFeaturedEmailSubject(),
    renderArtworkFeaturedEmailHtml(artistName, artworkTitle, artworkUrl),
  ]);

  await sendEmail({ to: email, subject, html });
}

/**
 * Send the institution thank-you email (admin-triggered, not auto-sent on signup).
 */
export async function sendInstitutionThanksEmail(email: string, name: string): Promise<void> {
  const [subject, html] = await Promise.all([
    getInstitutionThanksEmailSubject(),
    renderInstitutionThanksEmailHtml(name),
  ]);

  await sendEmail({
    to: email,
    subject,
    html,
  });
}

/**
 * Send the invite marketing email (admin-triggered outreach to prospects).
 */
export async function sendInviteEmail(email: string, name: string): Promise<void> {
  const [subject, html] = await Promise.all([
    getInviteEmailSubject(),
    renderInviteEmailHtml(name),
  ]);

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
  const html = await renderNotificationEmailHtml(
    name,
    params.title,
    params.body,
    params.ctaUrl,
    params.ctaLabel,
  );
  await sendEmail({ to: email, subject, html });
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
  const html = await renderSummaryEmailHtml(name, items, period);
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
  const html = await renderUpdateEmailHtml(
    name,
    params.title,
    params.body,
    params.link,
    params.linkLabel,
  );
  await sendEmail({ to: email, subject, html });
}

/**
 * Send a certificate claim / share invite email to a non-registered email address.
 * Used by the viral loop: any certificate owner can invite someone to claim the work.
 */
export async function sendCertificateInviteEmail(
  toEmail: string,
  params: {
    senderName: string;
    artworkTitle: string;
    artistName?: string | null;
    certificateUrl: string;
    personalMessage?: string | null;
  },
): Promise<void> {
  const subject = `${params.senderName} shared a certificate with you`;
  const theme = getPresetThemeDefaults('gallery');
  const { ink, wine, inkMuted, surfaceMuted, fontFamily, fontFamilyHeading } = theme;

  const artwork = escapeHtml(params.artworkTitle || 'an artwork');
  const sender = escapeHtml(params.senderName);
  const byLine = params.artistName
    ? ` by <em style="font-style:italic;">${escapeHtml(params.artistName)}</em>`
    : '';

  const messageBlock = params.personalMessage
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0;border-collapse:collapse;">
        <tr>
          <td width="3" bgcolor="${wine}" style="width:3px;background-color:${wine};font-size:1px;">&nbsp;</td>
          <td bgcolor="${surfaceMuted}" style="padding:16px 20px;background-color:${surfaceMuted};">
            <p style="margin:0;font-family:${fontFamily};font-size:15px;line-height:1.65;color:${inkMuted};font-style:italic;">"${escapeHtml(params.personalMessage)}"</p>
          </td>
        </tr>
      </table>`
    : '';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';

  const innerHtml = `
<h1 style="margin:0 0 20px;font-family:${fontFamilyHeading};font-size:26px;font-weight:700;color:${ink};line-height:1.25;">A certificate has been shared with you</h1>
<p style="margin:0 0 16px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">
  ${sender} has shared a Provenance certificate for <strong style="font-weight:600;color:${wine};">${artwork}</strong>${byLine} with you.
</p>
${messageBlock}
<p style="margin:0 0 8px;font-family:${fontFamily};font-size:16px;line-height:1.75;color:${ink};">
  View the verified certificate and — if you are the artist or owner — claim it as yours.
</p>
${buildBulletproofButtonTable(params.certificateUrl, 'View Certificate', theme)}
<p style="margin:20px 0 0;font-family:${fontFamily};font-size:13px;line-height:1.6;color:${inkMuted};">
  Don't have an account? <a href="${siteUrl}/lp/artist" target="_blank" rel="noopener noreferrer" style="color:${wine};text-decoration:none;font-weight:500;">Create your free certificate</a>
</p>`;

  const html = buildEmailHtml(subject, `<div>${innerHtml}</div>`, theme);
  await sendEmail({ to: toEmail, subject, html });
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

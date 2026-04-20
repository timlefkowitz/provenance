import { Resend } from 'resend';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? 'Provenance <noreply@provenance.art>';

function buildResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('[Email] RESEND_API_KEY is not set');
  }
  return new Resend(apiKey);
}

interface EmailSettings {
  parchment: string;
  ink: string;
  wine: string;
  ink_subtitle: string;
  ink_muted: string;
  masthead_title: string;
  masthead_subtitle: string;
}

interface EmailTemplate {
  subject: string;
  body_markdown: string;
}

/** Minimal markdown-to-HTML that covers bold, line-breaks, and paragraphs. */
function markdownToHtml(md: string): string {
  return md
    .split('\n\n')
    .map((paragraph) => {
      const inner = paragraph
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n/g, '<br/>');
      return `<p style="margin:0 0 16px 0;">${inner}</p>`;
    })
    .join('');
}

function replacePlaceholders(
  text: string,
  values: Record<string, string>,
): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
}

function buildHtml(
  bodyHtml: string,
  settings: EmailSettings,
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${settings.masthead_title}</title>
</head>
<body style="margin:0;padding:0;background:${settings.parchment};font-family:Georgia,'Times New Roman',serif;color:${settings.ink};">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:${settings.parchment};border:1px solid ${settings.wine}30;">
          <!-- Masthead -->
          <tr>
            <td align="center" style="padding:32px 40px 24px;border-bottom:3px double ${settings.wine};">
              <h1 style="margin:0;font-family:Georgia,serif;font-size:32px;letter-spacing:0.2em;color:${settings.wine};text-transform:uppercase;">
                ${settings.masthead_title}
              </h1>
              <p style="margin:6px 0 0;font-size:11px;letter-spacing:0.15em;color:${settings.ink_subtitle};text-transform:uppercase;">
                ${settings.masthead_subtitle}
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px 40px;font-size:16px;line-height:1.7;color:${settings.ink};">
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:20px 40px 32px;border-top:1px solid ${settings.wine}30;">
              <p style="margin:0;font-size:12px;color:${settings.ink_muted};">
                © ${new Date().getFullYear()} ${settings.masthead_title}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendTemplatedEmail(params: {
  to: string;
  templateKey: string;
  placeholders: Record<string, string>;
}): Promise<void> {
  const { to, templateKey, placeholders } = params;

  console.log(`[Email] sendTemplatedEmail: template=${templateKey} to=${to}`);

  const admin = getSupabaseServerAdminClient();

  const [templateResult, settingsResult] = await Promise.all([
    admin
      .from('email_templates')
      .select('subject, body_markdown')
      .eq('template_key', templateKey)
      .single(),
    admin.from('email_settings').select('*').limit(1).single(),
  ]);

  if (templateResult.error || !templateResult.data) {
    console.error('[Email] Template not found:', templateKey, templateResult.error);
    throw new Error(`Email template "${templateKey}" not found`);
  }

  if (settingsResult.error || !settingsResult.data) {
    console.error('[Email] Settings not found:', settingsResult.error);
    throw new Error('Email settings not configured');
  }

  const template = templateResult.data as EmailTemplate;
  const settings = settingsResult.data as unknown as EmailSettings;

  const subject = replacePlaceholders(template.subject, placeholders);
  const bodyMarkdown = replacePlaceholders(template.body_markdown, placeholders);
  const bodyHtml = markdownToHtml(bodyMarkdown);
  const html = buildHtml(bodyHtml, settings);

  const resend = buildResendClient();

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    html,
  });

  if (error) {
    console.error('[Email] Resend send failed:', error);
    throw new Error(`Failed to send email: ${error.message}`);
  }

  console.log(`[Email] Email sent successfully: template=${templateKey} to=${to}`);
}

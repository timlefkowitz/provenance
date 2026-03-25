/**
 * One-off: send welcome email via Resend using default template (no Supabase).
 * Usage: pnpm with-env npx tsx scripts/send-welcome-email.ts <email> [name]
 */
import { Resend } from 'resend';
import { DEFAULT_EMAIL_MARKDOWN, DEFAULT_EMAIL_SUBJECTS } from '../src/lib/email-defaults';
import { renderMarkdownToEmailHtml } from '../src/lib/email-markdown';
import { buildEmailHtml, escapeHtml, type EmailTheme } from '../src/lib/email-layout';

const EMAIL_THEME: EmailTheme = {
  parchment: '#F5F1E8',
  ink: '#111111',
  wine: '#4A2F25',
  inkSubtitle: '#2a2a2a',
  inkMuted: '#555555',
  mastheadTitle: 'PROVENANCE',
  mastheadSubtitle: 'PRESERVING CULTURAL HERITAGE',
  fontFamily:
    '"Gotham", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
};

function interpolateWelcome(md: string, displayName: string, siteUrl: string): string {
  let out = md;
  out = out.split('{{siteUrl}}').join(siteUrl);
  out = out.split('{{name}}').join(escapeHtml(displayName));
  return out;
}

const email = process.argv[2];
const displayName = process.argv[3] ?? 'there';

if (!email?.includes('@')) {
  console.error('Usage: pnpm with-env npx tsx scripts/send-welcome-email.ts <email> [name]');
  process.exit(1);
}

const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('[Email] RESEND_API_KEY is not set in .env.local');
  process.exit(1);
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.guru';
const md = interpolateWelcome(DEFAULT_EMAIL_MARKDOWN.welcome, displayName, siteUrl);
const inner = `<div>${renderMarkdownToEmailHtml(md, EMAIL_THEME)}</div>`;
const html = buildEmailHtml('Welcome to Provenance', inner, EMAIL_THEME);
const subject = DEFAULT_EMAIL_SUBJECTS.welcome;

console.log('[Email] Sending welcome email', { to: email, subject });

const resend = new Resend(apiKey);
const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';
const { data, error } = await resend.emails.send({
  from,
  to: email,
  subject,
  html,
});

if (error) {
  console.error('[Email] Send failed', error);
  process.exit(1);
}

console.log('[Email] Sent', data?.id);

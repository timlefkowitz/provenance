/**
 * One-off announcement emails: App Store launch + Sight Unseen open call.
 *
 *   tsx announcements.ts preview                      → writes HTML previews to ./out
 *   tsx announcements.ts test <app|opencall> <email>  → sends one copy to <email>
 *   tsx announcements.ts send <app|opencall> --confirm [--limit N]
 *
 * `send` logs each delivered address to ./out/sent-<campaign>.log and skips
 * anything already in it, so a run cut short by the Resend daily cap can resume.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  buildBulletproofButtonTable,
  buildEmailHtml,
  escapeHtml,
  type EmailTheme,
} from '../../src/lib/email-layout';
import { mergeEmailSettingsIntoTheme } from '../../src/lib/email-layout-presets';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const SITE = 'https://www.provenance.guru';
const APP_STORE_URL = 'https://apps.apple.com/us/app/provenance-guru/id6806489385';
const OPEN_CALL_URL = `${SITE}/open-calls/sight-unseen`;
const CONTACT = 'dev@provenance.guru';

type Campaign = 'app' | 'opencall';
type Recipient = { email: string; name: string };

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function loadTheme(): Promise<EmailTheme> {
  const { data } = await db
    .from('email_settings')
    .select('layout_preset, masthead_title, masthead_subtitle')
    .limit(1)
    .maybeSingle();
  return mergeEmailSettingsIntoTheme(data ?? {});
}

// ── Shared pieces ──────────────────────────────────────────────────────────

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.includes('@') ? first : 'there';
}

function eyebrow(text: string, t: EmailTheme): string {
  return `<p style="margin:0 0 14px;font-family:${t.fontFamily};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${t.wine};">${text}</p>`;
}

function h1(text: string, t: EmailTheme, size = 30): string {
  return `<h1 style="margin:0 0 18px;font-family:${t.fontFamilyHeading};font-size:${size}px;font-weight:700;line-height:1.2;color:${t.ink};">${text}</h1>`;
}

function p(html: string, t: EmailTheme, extra = ''): string {
  return `<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:16px;line-height:1.75;color:${t.ink};${extra}">${html}</p>`;
}

function rule(t: EmailTheme): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;border-collapse:collapse;"><tr><td height="1" bgcolor="${t.cardBorder}" style="height:1px;line-height:1px;font-size:1px;background-color:${t.cardBorder};">&nbsp;</td></tr></table>`;
}

/** Numbered feature rows: small accent numeral, bold lead, muted line. */
function featureList(items: [string, string][], t: EmailTheme): string {
  const rows = items
    .map(
      ([lead, line], i) => `
  <tr>
    <td width="36" valign="top" style="padding:12px 0;font-family:${t.fontFamilyHeading};font-size:15px;font-weight:700;color:${t.wine};">${String(i + 1).padStart(2, '0')}</td>
    <td valign="top" style="padding:12px 0;border-bottom:1px solid ${t.cardBorder};font-family:${t.fontFamily};font-size:15px;line-height:1.6;color:${t.ink};">
      <strong style="font-weight:600;">${lead}</strong><br>
      <span style="color:${t.inkMuted};">${line}</span>
    </td>
  </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px;border-collapse:collapse;">${rows}</table>`;
}

/** Two-column label/value block on a tinted panel with an accent rule. */
function detailsPanel(rows: [string, string][], t: EmailTheme): string {
  const body = rows
    .map(
      ([label, value]) => `
      <tr>
        <td valign="top" width="96" style="padding:7px 0;font-family:${t.fontFamily};font-size:11px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${t.inkMuted};">${label}</td>
        <td valign="top" style="padding:7px 0;font-family:${t.fontFamily};font-size:15px;line-height:1.5;color:${t.ink};">${value}</td>
      </tr>`,
    )
    .join('');
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:24px 0;border-collapse:collapse;">
  <tr>
    <td width="3" bgcolor="${t.wine}" style="width:3px;background-color:${t.wine};font-size:1px;">&nbsp;</td>
    <td bgcolor="${t.surfaceMuted}" style="padding:18px 22px;background-color:${t.surfaceMuted};">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">${body}</table>
    </td>
  </tr>
</table>`;
}

function signOff(t: EmailTheme): string {
  return `${p('Thank you for being here early,', t, 'margin-top:28px;')}
<p style="margin:0;font-family:${t.fontFamilyHeading};font-size:17px;font-style:italic;color:${t.ink};">Tim</p>
<p style="margin:2px 0 0;font-family:${t.fontFamily};font-size:13px;color:${t.inkMuted};">Founder, Provenance</p>`;
}

function optOutNote(t: EmailTheme): string {
  return `<p style="margin:28px 0 0;font-family:${t.fontFamily};font-size:12px;line-height:1.6;color:${t.inkMuted};">Prefer not to receive announcements? Email <a href="mailto:${CONTACT}?subject=Unsubscribe" style="color:${t.wine};text-decoration:none;">${CONTACT}</a> and we will take you off the list.</p>`;
}

function preheader(text: string): string {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">${escapeHtml(text)}&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;&#8203;&nbsp;</div>`;
}

// ── Email 1: App Store ─────────────────────────────────────────────────────

const APP_SUBJECT = 'Provenance is now on the App Store';

function appStoreEmail(r: Recipient, t: EmailTheme): string {
  const inner = `
${preheader('Free on iPhone and iPad. Sign in with the account you already have.')}
${eyebrow('Now on iPhone &amp; iPad', t)}
${h1('Your collection,<br>in your pocket.', t, 32)}
${p(`Hi ${escapeHtml(firstName(r.name))},`, t)}
${p(`Provenance is now on the App Store, and it is free to download. Your certificates, artworks and collection come with you. Sign in with the account you already use on provenance.guru.`, t)}
${buildBulletproofButtonTable(APP_STORE_URL, 'Download the app', t)}
<p style="margin:6px 0 0;text-align:center;font-family:${t.fontFamily};font-size:12px;color:${t.inkMuted};">Search &ldquo;Provenance Guru&rdquo; in the App Store</p>
${rule(t)}
${eyebrow('Made for the phone', t)}
${featureList(
  [
    ['Scan any certificate', 'Point your camera at a Provenance QR code to verify a work in seconds.'],
    ['Certify from the studio', 'Photograph a new piece and issue its Certificate of Authenticity on the spot.'],
    ['Share in one tap', 'Send certificates through Messages, Mail or AirDrop with the iOS share sheet.'],
    ['Stay in the loop', 'Get notified when there are new messages, submissions and activity on your work.'],
    ['Locked with Face ID', 'Turn on App Lock in Settings to keep your records private.'],
  ],
  t,
)}
${signOff(t)}
${optOutNote(t)}`;
  return buildEmailHtml(APP_SUBJECT, `<div>${inner}</div>`, t);
}

// ── Email 2: Sight Unseen open call ────────────────────────────────────────

const OPENCALL_SUBJECT = 'Open call: Sight Unseen (submissions close Oct 27)';

function openCallEmail(r: Recipient, t: EmailTheme): string {
  const inner = `
${preheader('A show where every work stays hidden until it is acquired. Submit up to five works by October 27.')}
${eyebrow('Open Call &middot; Exhibition', t)}
<h1 style="margin:0 0 10px;font-family:${t.fontFamilyHeading};font-size:40px;font-weight:700;line-height:1.1;letter-spacing:-0.01em;color:${t.ink};">Sight Unseen</h1>
<p style="margin:0 0 26px;font-family:${t.fontFamilyHeading};font-size:18px;font-style:italic;line-height:1.5;color:${t.inkMuted};">Every work stays hidden until it is acquired.</p>
${p(`Hi ${escapeHtml(firstName(r.name))},`, t)}
${p(`We are inviting artists to submit to <strong style="font-weight:600;color:${t.wine};">Sight Unseen</strong>, an exhibition that turns the usual gallery visit around.`, t)}
${p(`No work in the show is visible until it finds its collector. Visitors move through it guided only by each piece&rsquo;s verified record: its metadata, the artist&rsquo;s lineage and their process notes, all held on Provenance. Without a first glance to go on, collectors commit to the story, the history and the craft behind a work before they ever see it.`, t)}
${detailsPanel(
  [
    ['Submit by', '<strong style="font-weight:600;">Tuesday, October 27, 2026</strong>'],
    ['Exhibition', 'November 5&ndash;20, 2026'],
    ['Works', 'Up to 5 per artist'],
    ['Curator', 'Timothy Lefkowitz'],
  ],
  t,
)}
${eyebrow('How to submit', t)}
${featureList(
  [
    ['Open the call', 'Sign in, or create a free artist account, from the open call page.'],
    ['Add your work', 'Upload new pieces or choose works that already have a Certificate of Authenticity.'],
    ['Tell the story', 'Your titles, materials and process notes are the show. Write them with care.'],
  ],
  t,
)}
${buildBulletproofButtonTable(OPEN_CALL_URL, 'View the open call', t)}
${signOff(t)}
${optOutNote(t)}`;
  return buildEmailHtml(OPENCALL_SUBJECT, `<div>${inner}</div>`, t);
}

const CAMPAIGNS: Record<Campaign, { subject: string; render: (r: Recipient, t: EmailTheme) => string }> = {
  app: { subject: APP_SUBJECT, render: appStoreEmail },
  opencall: { subject: OPENCALL_SUBJECT, render: openCallEmail },
};

// ── Recipients ─────────────────────────────────────────────────────────────

async function loadRecipients(): Promise<Recipient[]> {
  const { data, error } = await db.from('accounts').select('id, name, email').not('email', 'is', null);
  if (error) throw error;
  const { data: optOuts } = await db.from('email_preferences').select('user_id').eq('digest_opt_out', true);
  const blocked = new Set((optOuts ?? []).map((r) => r.user_id as string));

  const seen = new Set<string>();
  const out: Recipient[] = [];
  for (const a of data ?? []) {
    const email = String(a.email).trim().toLowerCase();
    if (!email.includes('@') || seen.has(email) || blocked.has(a.id)) continue;
    // App Review demo accounts and other internal addresses.
    if (/^appreview/.test(email) || /@(example\.com|test\.com)$/.test(email)) continue;
    seen.add(email);
    out.push({ email, name: (a.name as string | null) ?? '' });
  }
  return out;
}

// ── CLI ────────────────────────────────────────────────────────────────────

async function main() {
  const [mode, arg1, arg2] = process.argv.slice(2);
  const theme = await loadTheme();
  mkdirSync(OUT, { recursive: true });

  if (mode === 'preview') {
    const sample = { email: 'preview@provenance.guru', name: 'Alex Rivera' };
    for (const [key, c] of Object.entries(CAMPAIGNS)) {
      writeFileSync(join(OUT, `${key}.html`), c.render(sample, theme));
    }
    const recipients = await loadRecipients();
    writeFileSync(join(OUT, 'recipients.txt'), recipients.map((r) => r.email).join('\n'));
    console.log(`Wrote previews to ${OUT}. ${recipients.length} eligible recipients.`);
    return;
  }

  const campaign = CAMPAIGNS[arg1 as Campaign];
  if (!campaign) throw new Error('Campaign must be "app" or "opencall"');
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';

  const sendOne = async (r: Recipient) => {
    const { error } = await resend.emails.send({
      from,
      to: r.email,
      replyTo: CONTACT,
      subject: campaign.subject,
      html: campaign.render(r, theme),
    });
    if (error) throw new Error(`${r.email}: ${error.message}`);
  };

  if (mode === 'test') {
    if (!arg2) throw new Error('Pass a test address');
    await sendOne({ email: arg2, name: 'Tim' });
    console.log(`Test "${campaign.subject}" sent to ${arg2}`);
    return;
  }

  if (mode === 'send') {
    if (!process.argv.includes('--confirm')) throw new Error('Refusing to send without --confirm');
    const limitIdx = process.argv.indexOf('--limit');
    const limit = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : Infinity;
    const logPath = join(OUT, `sent-${arg1}.log`);
    const already = new Set(existsSync(logPath) ? readFileSync(logPath, 'utf8').split('\n').filter(Boolean) : []);
    const queue = (await loadRecipients()).filter((r) => !already.has(r.email)).slice(0, limit);
    console.log(`Sending "${campaign.subject}" to ${queue.length} (${already.size} already sent)`);
    let ok = 0;
    for (const r of queue) {
      try {
        await sendOne(r);
        appendFileSync(logPath, `${r.email}\n`);
        ok++;
      } catch (err) {
        console.error('FAILED', (err as Error).message);
        if (/limit|quota/i.test((err as Error).message)) break;
      }
      await new Promise((res) => setTimeout(res, 600)); // stay under Resend's 2 req/s
    }
    console.log(`Done: ${ok}/${queue.length} sent`);
    return;
  }

  throw new Error('Usage: preview | test <campaign> <email> | send <campaign> --confirm [--limit N]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

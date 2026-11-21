/**
 * One-off: three Texas opportunities (Palm Park art call, HCCC residency,
 * San Antonio artist grants) plus two bonus picks, sent to every user.
 *
 *   tsx texas-opportunities.ts preview          → writes ./out/texas-opportunities.html, prints recipient count
 *   tsx texas-opportunities.ts test <email>     → sends one copy to <email>
 *   tsx texas-opportunities.ts send --confirm [--limit N]
 *
 * `send` logs each delivered address to ./out/sent-texas-opportunities.log and skips those on re-run.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildEmailHtml, escapeHtml, type EmailTheme } from '../../src/lib/email-layout';
import { mergeEmailSettingsIntoTheme } from '../../src/lib/email-layout-presets';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const LOG = join(OUT, 'sent-texas-opportunities.log');
const SITE = 'https://www.provenance.guru';
const CONTACT = 'dev@provenance.guru';
const SUBJECT = 'Three Texas opportunities: a public art call, a paid residency, and city grants';

type Opportunity = {
  kicker: string;
  title: string;
  where: string;
  facts: [string, string][];
  why?: string;
  url: string;
  urlLabel: string;
};

/** Checked on each program's official site on 2026-11-16. */
const MAIN: Opportunity[] = [
  {
    kicker: 'Public art call',
    title: 'Waterloo Greenway – Palm Park Art',
    where: 'Austin, TX',
    facts: [
      ['What', 'A call for artists and makers with ties to Texas to create permanent work for Palm Park downtown, including one large wall (80–100 ft), a fit for 2D, mural, mosaic and mixed-media artists.'],
      ['Help', 'Free application help, in person and online.'],
      ['Who', 'Artists and makers with ties to Texas; Austin artists especially welcome.'],
      ['Deadline', 'December 7, 2026'],
    ],
    why: 'This first round is a qualifications call. Finalists get a stipend to develop their proposals, so you don’t design a full project to apply.',
    url: 'https://waterloogreenway.org/palm-park-art/',
    urlLabel: 'waterloogreenway.org/palm-park-art',
  },
  {
    kicker: 'Residency',
    title: 'Houston Center for Contemporary Craft – Artist Residency',
    where: 'Houston, TX (Museum District)',
    facts: [
      ['What', 'A 3- to 12-month residency (6 and 9 months preferred) for artists working in wood, glass, metal, fiber and clay.'],
      ['You get', '$1,000 monthly stipend (includes a small housing/materials allowance) and 24/7 access to a 200 sq ft studio.'],
      ['Who', 'Artists eligible to work in the U.S.'],
      ['Applications', 'Open December 1, 2026 – February 1, 2027 (2027–2028 cycle)'],
    ],
    url: 'https://crafthouston.org/artist-residency/apply-to-program/',
    urlLabel: 'crafthouston.org/artist-residency',
  },
  {
    kicker: 'Grant',
    title: 'City of San Antonio – Artist Grants',
    where: 'San Antonio, TX',
    facts: [
      ['What', 'Annual funding for San Antonio artists to create and present new work, applying on their own or as a collective.'],
      ['Award', '$7,500 or $15,000'],
      ['Who', 'Professional artists based in San Antonio city limits.'],
      ['Timeline', 'The next call opens January 2027, starting with an Intent to Apply on the city’s GO Smart portal.'],
    ],
    url: 'https://www.sa.gov/Directory/Departments/Arts/Grants/Artist-Grants',
    urlLabel: 'sa.gov – Artist Grants',
  },
];

const BONUS: { title: string; text: string; url: string }[] = [
  {
    title: 'Glassell School of Art – Core Residency Program (Houston)',
    text: 'A 23-month residency for emerging visual artists and critical writers: $100,000 ($50,000 a year) plus a health-care stipend. Deadline January 8, 2027.',
    url: 'https://www.mfah.org/events/core-residency-program-info-session',
  },
  {
    title: 'Artpace Texas Open Call (San Antonio)',
    text: 'Fee-free and only for artists living and working in Texas. The 2028 call has closed; the last window ran July–August, so watch for the next one next summer.',
    url: 'https://artpace.org/about/international-artist-in-residence/texas-open-call/',
  },
];

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function loadTheme(): Promise<EmailTheme> {
  const { data } = await db
    .from('email_settings')
    .select('layout_preset, masthead_title, masthead_subtitle')
    .limit(1)
    .maybeSingle();
  return mergeEmailSettingsIntoTheme(data ?? {});
}

// ── Rendering ──────────────────────────────────────────────────────────────

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.includes('@') ? first : 'there';
}

function card(o: Opportunity, n: number, t: EmailTheme): string {
  const rows = o.facts
    .map(
      ([k, v]) => `
      <tr>
        <td valign="top" width="96" style="width:96px;padding:5px 12px 5px 0;font-family:${t.fontFamily};font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${t.inkMuted};">${escapeHtml(k)}</td>
        <td valign="top" style="padding:5px 0;font-family:${t.fontFamily};font-size:15px;line-height:1.55;color:${t.ink};">${escapeHtml(v)}</td>
      </tr>`,
    )
    .join('');
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;border-collapse:collapse;">
  <tr>
    <td width="3" bgcolor="${t.wine}" style="width:3px;background-color:${t.wine};font-size:1px;">&nbsp;</td>
    <td bgcolor="${t.surfaceMuted}" style="padding:20px 22px;background-color:${t.surfaceMuted};">
      <p style="margin:0 0 8px;font-family:${t.fontFamily};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${t.wine};">${n} &middot; ${escapeHtml(o.kicker)}</p>
      <p style="margin:0 0 4px;font-family:${t.fontFamilyHeading};font-size:20px;font-weight:700;line-height:1.3;color:${t.ink};">${escapeHtml(o.title)}</p>
      <p style="margin:0 0 12px;font-family:${t.fontFamily};font-size:14px;font-weight:600;color:${t.inkMuted};">${escapeHtml(o.where)}</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">${rows}
      </table>
      ${o.why ? `<p style="margin:12px 0 0;font-family:${t.fontFamily};font-size:15px;line-height:1.6;color:${t.ink};"><strong>Why it’s great:</strong> ${escapeHtml(o.why)}</p>` : ''}
      <p style="margin:14px 0 0;font-family:${t.fontFamily};font-size:15px;"><a href="${escapeHtml(o.url)}" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;font-weight:600;">${escapeHtml(o.urlLabel)} &rarr;</a></p>
    </td>
  </tr>
</table>`;
}

function bonus(t: EmailTheme): string {
  const rows = BONUS.map(
    (b) => `
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid ${t.cardBorder};">
      <p style="margin:0;font-family:${t.fontFamily};font-size:16px;font-weight:600;"><a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;">${escapeHtml(b.title)}</a></p>
      <p style="margin:4px 0 0;font-family:${t.fontFamily};font-size:14px;line-height:1.55;color:${t.inkMuted};">${escapeHtml(b.text)}</p>
    </td>
  </tr>`,
  ).join('');
  return `
<h3 style="margin:28px 0 4px;font-family:${t.fontFamilyHeading};font-size:17px;font-weight:600;color:${t.ink};line-height:1.4;">Also on our radar</h3>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:1px solid ${t.cardBorder};">${rows}
</table>`;
}

function render(name: string, t: EmailTheme): string {
  const body = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">Palm Park art call (due Dec 7), a $1,000/month craft residency in Houston, and San Antonio artist grants.&#8203;&nbsp;&#8203;&nbsp;</div>
<h2 style="margin:0 0 16px;font-family:${t.fontFamilyHeading};font-size:24px;font-weight:700;color:${t.ink};line-height:1.25;">Three Texas opportunities</h2>
<p style="margin:0 0 24px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Hi ${escapeHtml(firstName(name))}, here are three opportunities in Texas worth a look: a public art call in Austin closing December 7, a paid residency in Houston, and city grants in San Antonio.</p>
${MAIN.map((o, i) => card(o, i + 1, t)).join('')}
${bonus(t)}
<p style="margin:16px 0 0;font-family:${t.fontFamily};font-size:14px;line-height:1.6;"><a href="${SITE}/grants" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;font-weight:500;">Find more grants on Provenance &rarr;</a></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 20px;border-collapse:collapse;"><tr><td height="1" bgcolor="${t.cardBorder}" style="height:1px;line-height:1px;font-size:1px;background-color:${t.cardBorder};">&nbsp;</td></tr></table>
<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:13px;line-height:1.6;color:${t.inkMuted};">Details were checked on each program’s site on November 16. Always confirm fees, deadlines and eligibility on the official site before applying.</p>
<p style="margin:0 0 4px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Best,</p>
<p style="margin:0;font-family:${t.fontFamilyHeading};font-size:17px;font-style:italic;color:${t.ink};">Tim</p>
<p style="margin:2px 0 0;font-family:${t.fontFamily};font-size:13px;color:${t.inkMuted};">Founder, Provenance</p>
<p style="margin:28px 0 0;font-family:${t.fontFamily};font-size:12px;line-height:1.6;color:${t.inkMuted};">Prefer not to receive these? Email <a href="mailto:${CONTACT}?subject=Unsubscribe" style="color:${t.wine};text-decoration:none;">${CONTACT}</a> and we will take you off the list.</p>`;
  return buildEmailHtml(SUBJECT, `<div>${body}</div>`, t);
}

// ── Recipients ─────────────────────────────────────────────────────────────

async function loadAccounts(): Promise<{ email: string; name: string }[]> {
  const { data, error } = await db.from('accounts').select('id, name, email').not('email', 'is', null);
  if (error) throw error;
  const { data: optOuts, error: optErr } = await db.from('email_preferences').select('user_id').eq('digest_opt_out', true);
  if (optErr) throw new Error(`Cannot read opt-outs, refusing to continue: ${optErr.message}`);
  const blocked = new Set((optOuts ?? []).map((r) => r.user_id as string));

  const seen = new Set<string>();
  const out: { email: string; name: string }[] = [];
  for (const a of data ?? []) {
    const email = String(a.email).trim().toLowerCase();
    if (!email.includes('@') || seen.has(email) || blocked.has(a.id)) continue;
    if (/^appreview/.test(email) || /@(example\.com|test\.com)$/.test(email)) continue;
    seen.add(email);
    out.push({ email, name: (a.name as string | null) ?? '' });
  }
  return out;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function argNum(flag: string): number {
  const i = process.argv.indexOf(flag);
  return i > 0 ? Number(process.argv[i + 1]) : Infinity;
}

async function main() {
  const [mode, arg1] = process.argv.slice(2);
  const theme = await loadTheme();
  mkdirSync(OUT, { recursive: true });

  if (mode === 'preview') {
    writeFileSync(join(OUT, 'texas-opportunities.html'), render('Alex Rivera', theme));
    const all = await loadAccounts();
    console.log(`${all.length} recipients. Preview: ${join(OUT, 'texas-opportunities.html')}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';
  const sendOne = async (email: string, name: string) => {
    const { error } = await resend.emails.send({ from, to: email, replyTo: CONTACT, subject: SUBJECT, html: render(name, theme) });
    if (error) throw new Error(`${email}: ${error.message}`);
  };

  if (mode === 'test') {
    if (!arg1) throw new Error('Pass a test address');
    await sendOne(arg1, 'Tim');
    console.log(`Test sent to ${arg1}`);
    return;
  }

  if (mode === 'send') {
    if (!process.argv.includes('--confirm')) throw new Error('Refusing to send without --confirm');
    const already = new Set(existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : []);
    const queue = (await loadAccounts()).filter((r) => !already.has(r.email)).slice(0, argNum('--limit'));
    console.log(`Sending "${SUBJECT}" to ${queue.length} (${already.size} already sent)`);
    let ok = 0;
    for (const r of queue) {
      try {
        await sendOne(r.email, r.name);
        appendFileSync(LOG, `${r.email}\n`);
        ok++;
      } catch (err) {
        console.error('FAILED', (err as Error).message);
        if (/limit|quota/i.test((err as Error).message)) break;
      }
      await new Promise((res) => setTimeout(res, 600)); // Resend: 2 req/s
    }
    console.log(`Done: ${ok}/${queue.length} sent`);
    return;
  }

  throw new Error('Usage: preview | test <email> | send --confirm [--limit N]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

/**
 * One-off personal email to Mateo (Messican_Art, account e8cf3744-…): press search result,
 * a nudge to set up his artist profile with a bio, and the three Texas opportunities
 * from the 2026-11-16 email.
 *
 *   tsx messican-art.ts preview           → writes ./out/messican-art.html
 *   tsx messican-art.ts test <email>      → sends one copy to <email>
 *   tsx messican-art.ts send --confirm    → sends to Mateo (once; logged to ./out/sent-messican-art.log)
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { buildBulletproofButtonTable, buildEmailHtml, escapeHtml, type EmailTheme } from '../../src/lib/email-layout';
import { mergeEmailSettingsIntoTheme } from '../../src/lib/email-layout-presets';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const LOG = join(OUT, 'sent-messican-art.log');
const SITE = 'https://www.provenance.guru';
const CONTACT = 'dev@provenance.guru';
const USER_ID = 'e8cf3744-3dd8-4e35-83df-55ff666ce65d';
const SUBJECT = 'Mateo, your Provenance profile + three Texas opportunities';

/** Drafted from the About text on messicanart.com, for him to edit. */
const BIO_DRAFT =
  'Matthew Thomas Hernandez, known as Mateo, is a Texas artist based in San Antonio. He works across painting, drawing and digital art, and is best known for his Klouds, a tribal-style drawing series he numbers rather than titles so each viewer sees what their own eyes and mind want to see.';

type Opportunity = {
  kicker: string;
  title: string;
  where: string;
  facts: [string, string][];
  why?: string;
  url: string;
  urlLabel: string;
};

/** Same three as texas-opportunities.ts (checked on each official site 2026-11-16). */
const MAIN: Opportunity[] = [
  {
    kicker: 'Grant · in your city',
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
  {
    kicker: 'Public art call',
    title: 'Waterloo Greenway – Palm Park Art',
    where: 'Austin, TX',
    facts: [
      ['What', 'A call for artists and makers with ties to Texas to create permanent work for Palm Park downtown, including one large wall (80–100 ft), a fit for 2D, mural, mosaic and mixed-media artists.'],
      ['Help', 'Free application help, in person and online.'],
      ['Who', 'Artists and makers with ties to Texas.'],
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
];

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function loadTheme(): Promise<EmailTheme> {
  const { data } = await db.from('email_settings').select('layout_preset, masthead_title, masthead_subtitle').limit(1).maybeSingle();
  return mergeEmailSettingsIntoTheme(data ?? {});
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

function render(t: EmailTheme): string {
  const p = (html: string, mb = 16) =>
    `<p style="margin:0 0 ${mb}px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">${html}</p>`;
  const h3 = (s: string) =>
    `<h3 style="margin:28px 0 10px;font-family:${t.fontFamilyHeading};font-size:19px;font-weight:700;color:${t.ink};line-height:1.35;">${s}</h3>`;
  const body = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">A bio for your page, any press you want listed, and San Antonio artist grants opening in January.&#8203;&nbsp;&#8203;&nbsp;</div>
<h2 style="margin:0 0 16px;font-family:${t.fontFamilyHeading};font-size:24px;font-weight:700;color:${t.ink};line-height:1.25;">Hi Mateo</h2>
${p('Thanks for being on Provenance. I wanted to send you a few things for your page, plus three Texas opportunities, one of them right in San Antonio.')}
${h3('Press')}
${p('We searched the web for articles, interviews and reviews about you under Messican_Art and Matthew Thomas Hernandez, and didn’t find any yet. If you’ve been written up anywhere, like a newspaper, a blog, an interview or a show listing, just reply with the links and we’ll add them to the Press section of your profile.')}
${h3('Your bio')}
${p('Your Provenance page doesn’t have a bio yet, because your artist profile hasn’t been set up. That profile is where your bio, press, location and medium live, and it’s what collectors and galleries see first. Here’s a starting point we drafted from the About text on messicanart.com. Paste it in and make it your own:')}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 20px;border-collapse:collapse;">
  <tr>
    <td width="3" bgcolor="${t.cardBorder}" style="width:3px;background-color:${t.cardBorder};font-size:1px;">&nbsp;</td>
    <td style="padding:4px 0 4px 18px;font-family:${t.fontFamily};font-size:15px;line-height:1.7;font-style:italic;color:${t.ink};">${escapeHtml(BIO_DRAFT)}</td>
  </tr>
</table>
<div style="margin:0 0 8px;">${buildBulletproofButtonTable(`${SITE}/profiles/new?role=artist`, 'Set up my artist profile', t)}</div>
${h3('Three Texas opportunities')}
${MAIN.map((o, i) => card(o, i + 1, t)).join('')}
<p style="margin:4px 0 0;font-family:${t.fontFamily};font-size:14px;line-height:1.6;"><a href="${SITE}/grants" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;font-weight:500;">Find more grants on Provenance &rarr;</a></p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 20px;border-collapse:collapse;"><tr><td height="1" bgcolor="${t.cardBorder}" style="height:1px;line-height:1px;font-size:1px;background-color:${t.cardBorder};">&nbsp;</td></tr></table>
<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:13px;line-height:1.6;color:${t.inkMuted};">Opportunity details were checked on each program’s site on November 16. Always confirm fees, deadlines and eligibility on the official site before applying.</p>
<p style="margin:0 0 4px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Best,</p>
<p style="margin:0;font-family:${t.fontFamilyHeading};font-size:17px;font-style:italic;color:${t.ink};">Tim</p>
<p style="margin:2px 0 0;font-family:${t.fontFamily};font-size:13px;color:${t.inkMuted};">Founder, Provenance</p>
<p style="margin:28px 0 0;font-family:${t.fontFamily};font-size:12px;line-height:1.6;color:${t.inkMuted};">Prefer not to receive these? Email <a href="mailto:${CONTACT}?subject=Unsubscribe" style="color:${t.wine};text-decoration:none;">${CONTACT}</a> and we will take you off the list.</p>`;
  return buildEmailHtml(SUBJECT, `<div>${body}</div>`, t);
}

async function main() {
  const [mode, arg1] = process.argv.slice(2);
  const theme = await loadTheme();
  mkdirSync(OUT, { recursive: true });
  const html = render(theme);

  if (mode === 'preview') {
    writeFileSync(join(OUT, 'messican-art.html'), html);
    console.log(`Preview: ${join(OUT, 'messican-art.html')}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';
  const sendTo = async (to: string) => {
    const { error } = await resend.emails.send({ from, to, replyTo: CONTACT, subject: SUBJECT, html });
    if (error) throw new Error(`${to}: ${error.message}`);
  };

  if (mode === 'test') {
    if (!arg1) throw new Error('Pass a test address');
    await sendTo(arg1);
    console.log(`Test sent to ${arg1}`);
    return;
  }

  if (mode === 'send') {
    if (!process.argv.includes('--confirm')) throw new Error('Refusing to send without --confirm');
    if (existsSync(LOG) && readFileSync(LOG, 'utf8').trim()) throw new Error(`Already sent (see ${LOG})`);
    const { data: optOut, error: optErr } = await db.from('email_preferences').select('user_id').eq('user_id', USER_ID).eq('digest_opt_out', true);
    if (optErr) throw new Error(`Cannot read opt-outs, refusing to continue: ${optErr.message}`);
    if (optOut?.length) throw new Error('Recipient has opted out of digests');
    const { data: acct, error } = await db.from('accounts').select('email').eq('id', USER_ID).single();
    if (error || !acct?.email) throw new Error(`No email for ${USER_ID}`);
    await sendTo(acct.email);
    appendFileSync(LOG, `${acct.email}\n`);
    console.log(`Sent to ${acct.email}`);
    return;
  }

  throw new Error('Usage: preview | test <email> | send --confirm');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

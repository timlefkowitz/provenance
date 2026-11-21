/**
 * One-off: personalised grants + open calls email, with the Art Canon Nov 14
 * showcase pinned to the top for everyone.
 *
 *   tsx grants-showcase.ts build [--limit N]   → builds each recipient's list (AI grants for
 *                                                consented artists), caches to ./out, writes previews
 *   tsx grants-showcase.ts test <email>        → sends one cached (or generic) copy to <email>
 *   tsx grants-showcase.ts send --confirm [--limit N]
 *
 * `build` is the only step that calls OpenAI; `send` reads the cache, so what was
 * previewed is what goes out. `send` logs each delivered address to
 * ./out/sent-grants-showcase.log and skips those on re-run.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';
import {
  buildBulletproofButtonTable,
  buildEmailHtml,
  escapeHtml,
  type EmailTheme,
} from '../../src/lib/email-layout';
import { mergeEmailSettingsIntoTheme } from '../../src/lib/email-layout-presets';
import {
  buildArtistDigest,
  loadDigestArtists,
  loadOpenCallCandidates,
  type ArtistDigest,
  type DigestItem,
} from '../../src/lib/weekly-digest';
import type { UntypedSupabaseClient } from '../../src/lib/supabase-untyped';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const CACHE = join(OUT, 'grants-showcase.json');
const LOG = join(OUT, 'sent-grants-showcase.log');
const SITE = 'https://www.provenance.guru';
const CONTACT = 'dev@provenance.guru';
const AI_CONSENT_POLICY_VERSION = '2026-09-28'; // keep in sync with src/lib/ai-consent.ts

const ART_CANON_URL = 'https://www.instagram.com/artcanon_/';
const SUBJECT = 'Showcase opportunity Nov 14, plus grants picked for you';

/** Checked on each program's official site on 2026-11-10. Shown to everyone, after Art Canon. */
const CURATED: DigestItem[] = [
  {
    title: 'Hopper Prize — Fall 2026 grants',
    deadline: '2026-11-17',
    detail: '$4,500 and $1,000 grants · any medium, worldwide, 18+ · $40 fee',
    url: 'https://www.hopperprize.org/',
  },
  {
    title: 'Anderson Center at Tower View — 2027 Artist Residencies',
    deadline: '2027-01-12',
    detail: 'Free 2–4 week residency with studio and meals · all disciplines, worldwide',
    url: 'https://www.andersoncenter.org/residency-program/',
  },
  {
    title: 'City of San Antonio Artist Grants',
    deadline: null,
    detail: 'Opens January 2027 · $7,500 and $15,000 · for San Antonio-based artists',
    url: 'https://www.sa.gov/Directory/Departments/Arts/Grants/Artist-Grants',
  },
  {
    title: 'Pollock-Krasner Foundation Grant',
    deadline: null,
    detail: 'Rolling · up to $50,000 · painting, sculpture, works on paper; established exhibition history',
    url: 'https://pkf.org/apply/',
  },
];

/** AI picks we know are wrong (not art funders, or programs we could not find). */
const AI_BLOCKLIST = [/spencer foundation/i, /san antonio artist foundation/i, /valley art association/i];

/**
 * AI-matched grants: drop known-bad names and anything already in CURATED, and
 * strip the AI-guessed deadlines, which are often wrong.
 */
function cleanAiGrants(items: DigestItem[]): DigestItem[] {
  const key = (s: string) => s.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z]/g, '').slice(0, 14);
  const curated = new Set(CURATED.map((c) => key(c.title)));
  return items
    .filter((g) => !AI_BLOCKLIST.some((re) => re.test(g.title)) && !curated.has(key(g.title)))
    .map((g) => ({ ...g, deadline: null }));
}

type Recipient = {
  id: string;
  email: string;
  name: string;
  context: string; // "medium · location" when known
  digest: ArtistDigest;
};

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const admin = db as unknown as UntypedSupabaseClient;

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

function formatDeadline(deadline: string | null): string {
  if (!deadline) return '';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function featured(t: EmailTheme): string {
  return `
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 8px;border-collapse:collapse;">
  <tr>
    <td width="3" bgcolor="${t.wine}" style="width:3px;background-color:${t.wine};font-size:1px;">&nbsp;</td>
    <td bgcolor="${t.surfaceMuted}" style="padding:20px 22px;background-color:${t.surfaceMuted};">
      <p style="margin:0 0 8px;font-family:${t.fontFamily};font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${t.wine};">Featured &middot; Showcase</p>
      <p style="margin:0 0 6px;font-family:${t.fontFamilyHeading};font-size:22px;font-weight:700;line-height:1.25;color:${t.ink};">Art Canon &mdash; Art Everywhere Project</p>
      <p style="margin:0 0 12px;font-family:${t.fontFamily};font-size:14px;font-weight:600;color:${t.inkMuted};">Friday, November 14 &middot; Limited space</p>
      <p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:15px;line-height:1.65;color:${t.ink};">Art Canon is looking for artists to feature in a showcase on November 14. Space is limited, so if you would like your work in it, send them a DM on Instagram soon.</p>
      ${buildBulletproofButtonTable(ART_CANON_URL, 'DM @artcanon_ on Instagram', t)}
    </td>
  </tr>
</table>`;
}

function section(title: string, items: DigestItem[], href: string, label: string, t: EmailTheme): string {
  if (!items.length) return '';
  const rows = items
    .map((item) => {
      const name = escapeHtml(item.title);
      const link = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;">${name}</a>`
        : name;
      const meta = [item.deadline ? `Deadline ${formatDeadline(item.deadline)}` : '', item.detail ?? '']
        .filter(Boolean)
        .map(escapeHtml)
        .join(' &middot; ');
      return `
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid ${t.cardBorder};">
      <p style="margin:0;font-family:${t.fontFamily};font-size:16px;font-weight:600;color:${t.wine};">${link}</p>
      ${meta ? `<p style="margin:4px 0 0;font-family:${t.fontFamily};font-size:14px;line-height:1.55;color:${t.inkMuted};">${meta}</p>` : ''}
    </td>
  </tr>`;
    })
    .join('');
  return `
<h3 style="margin:28px 0 4px;font-family:${t.fontFamilyHeading};font-size:17px;font-weight:600;color:${t.ink};line-height:1.4;">${title}</h3>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:1px solid ${t.cardBorder};">${rows}
</table>
<p style="margin:12px 0 0;font-family:${t.fontFamily};font-size:14px;line-height:1.6;"><a href="${href}" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;font-weight:500;">${label} &rarr;</a></p>`;
}

function render(r: Recipient, t: EmailTheme): string {
  const intro = r.context
    ? `Hi ${escapeHtml(firstName(r.name))}, here are a few opportunities picked for your practice (${escapeHtml(r.context)}), starting with a showcase this Friday.`
    : `Hi ${escapeHtml(firstName(r.name))}, here are a few opportunities worth a look, starting with a showcase this Friday.`;
  const matched = cleanAiGrants(r.digest.grants);
  const hasGrants = matched.length > 0;
  const body = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">Art Canon is featuring artists on Nov 14. DM them on Instagram, plus grants and open calls for you.&#8203;&nbsp;&#8203;&nbsp;</div>
<h2 style="margin:0 0 16px;font-family:${t.fontFamilyHeading};font-size:24px;font-weight:700;color:${t.ink};line-height:1.25;">Opportunities for you</h2>
<p style="margin:0 0 20px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">${intro}</p>
${featured(t)}
${section('Open now', CURATED, `${SITE}/grants`, 'Find more grants', t)}
${section('More matched to your profile', matched, `${SITE}/grants`, 'Open Grants Assistant', t)}
${section('Open calls', r.digest.openCalls, `${SITE}/open-calls/browse`, 'Browse all open calls', t)}
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0 20px;border-collapse:collapse;"><tr><td height="1" bgcolor="${t.cardBorder}" style="height:1px;line-height:1px;font-size:1px;background-color:${t.cardBorder};">&nbsp;</td></tr></table>
<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:13px;line-height:1.6;color:${t.inkMuted};">&ldquo;Open now&rdquo; details were checked on each program&rsquo;s site on November 10.${hasGrants ? ' Profile matches are suggested with AI, so confirm deadlines and eligibility on the official site before applying.' : ' Always confirm the details on the official site before applying.'}</p>
<p style="margin:0 0 4px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Best,</p>
<p style="margin:0;font-family:${t.fontFamilyHeading};font-size:17px;font-style:italic;color:${t.ink};">Tim</p>
<p style="margin:2px 0 0;font-family:${t.fontFamily};font-size:13px;color:${t.inkMuted};">Founder, Provenance</p>
<p style="margin:28px 0 0;font-family:${t.fontFamily};font-size:12px;line-height:1.6;color:${t.inkMuted};">Prefer not to receive these? Email <a href="mailto:${CONTACT}?subject=Unsubscribe" style="color:${t.wine};text-decoration:none;">${CONTACT}</a> and we will take you off the list.</p>`;
  return buildEmailHtml(SUBJECT, `<div>${body}</div>`, t);
}

// ── Recipients ─────────────────────────────────────────────────────────────

async function loadAccounts(): Promise<{ id: string; email: string; name: string }[]> {
  const { data, error } = await db.from('accounts').select('id, name, email').not('email', 'is', null);
  if (error) throw error;
  const { data: optOuts, error: optErr } = await db.from('email_preferences').select('user_id').eq('digest_opt_out', true);
  if (optErr) throw new Error(`Cannot read opt-outs, refusing to continue: ${optErr.message}`);
  const blocked = new Set((optOuts ?? []).map((r) => r.user_id as string));

  const seen = new Set<string>();
  const out: { id: string; email: string; name: string }[] = [];
  for (const a of data ?? []) {
    const email = String(a.email).trim().toLowerCase();
    if (!email.includes('@') || seen.has(email) || blocked.has(a.id)) continue;
    if (/^appreview/.test(email) || /@(example\.com|test\.com)$/.test(email)) continue;
    seen.add(email);
    out.push({ id: a.id as string, email, name: (a.name as string | null) ?? '' });
  }
  return out;
}

async function aiConsented(ids: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await db
      .from('ai_data_consents')
      .select('user_id')
      .in('user_id', ids.slice(i, i + 200))
      .eq('consented', true)
      .eq('policy_version', AI_CONSENT_POLICY_VERSION);
    for (const r of data ?? []) out.add(r.user_id as string);
  }
  return out;
}

async function build(limit: number): Promise<Recipient[]> {
  const accounts = (await loadAccounts()).slice(0, limit);
  const ids = accounts.map((a) => a.id);
  const now = new Date();
  const [artists, openCallCandidates, consented] = await Promise.all([
    loadDigestArtists(admin, ids),
    loadOpenCallCandidates(admin, now),
    aiConsented(ids),
  ]);
  const key = process.env.OPENAI_API_KEY?.trim();
  const openai = key ? new OpenAI({ apiKey: key }) : null;

  const out: Recipient[] = [];
  const CONCURRENCY = 5;
  for (let i = 0; i < accounts.length; i += CONCURRENCY) {
    const batch = await Promise.all(
      accounts.slice(i, i + CONCURRENCY).map(async (a) => {
        const artist = artists.get(a.id);
        const digest = await buildArtistDigest({
          admin,
          openai: consented.has(a.id) ? openai : null,
          artist,
          userId: a.id,
          openCallCandidates,
          siteUrl: SITE,
          now,
        });
        const context = [artist?.medium, artist?.location].filter(Boolean).join(' · ');
        return { ...a, name: a.name || artist?.name || '', context, digest };
      }),
    );
    out.push(...batch);
    console.log(`built ${out.length}/${accounts.length}`);
  }
  return out;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function argNum(flag: string): number {
  const i = process.argv.indexOf(flag);
  return i > 0 ? Number(process.argv[i + 1]) : Infinity;
}

function readCache(): Recipient[] {
  if (!existsSync(CACHE)) throw new Error('No cache yet. Run `build` first.');
  return JSON.parse(readFileSync(CACHE, 'utf8')) as Recipient[];
}

async function main() {
  const [mode, arg1] = process.argv.slice(2);
  const theme = await loadTheme();
  mkdirSync(OUT, { recursive: true });

  if (mode === 'build' || mode === 'preview') {
    const recipients = mode === 'build' ? await build(argNum('--limit')) : readCache();
    if (mode === 'build') writeFileSync(CACHE, JSON.stringify(recipients, null, 2));
    // Previews: richest personalised one, and a bare (no-profile) one.
    const rich = [...recipients].sort(
      (a, b) => b.digest.grants.length + b.digest.openCalls.length - (a.digest.grants.length + a.digest.openCalls.length),
    )[0];
    const bare = recipients.find((r) => !r.digest.grants.length && !r.context);
    const sample = (r: Recipient): Recipient => ({ ...r, email: 'preview@provenance.guru', name: 'Alex Rivera' });
    if (rich) writeFileSync(join(OUT, 'grants-showcase-artist.html'), render(sample(rich), theme));
    if (bare) writeFileSync(join(OUT, 'grants-showcase-generic.html'), render(sample(bare), theme));
    const withGrants = recipients.filter((r) => r.digest.grants.length).length;
    const withCalls = recipients.filter((r) => r.digest.openCalls.length).length;
    console.log(`${recipients.length} recipients · ${withGrants} with grants · ${withCalls} with open calls. Cache: ${CACHE}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';
  const sendOne = async (r: Recipient) => {
    const { error } = await resend.emails.send({ from, to: r.email, replyTo: CONTACT, subject: SUBJECT, html: render(r, theme) });
    if (error) throw new Error(`${r.email}: ${error.message}`);
  };

  if (mode === 'test') {
    if (!arg1) throw new Error('Pass a test address');
    const cached = existsSync(CACHE) ? readCache() : [];
    const mine = cached.find((r) => r.email === arg1.toLowerCase());
    const base = mine ?? [...cached].sort((a, b) => b.digest.grants.length - a.digest.grants.length)[0];
    await sendOne({
      id: 'test',
      email: arg1,
      name: mine?.name || 'Tim',
      context: base?.context ?? '',
      digest: base?.digest ?? { grants: [], openCalls: [] },
    });
    console.log(`Test sent to ${arg1}${mine ? ' (their own list)' : ' (sample list)'}`);
    return;
  }

  if (mode === 'send') {
    if (!process.argv.includes('--confirm')) throw new Error('Refusing to send without --confirm');
    const already = new Set(existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : []);
    const queue = readCache().filter((r) => !already.has(r.email)).slice(0, argNum('--limit'));
    console.log(`Sending "${SUBJECT}" to ${queue.length} (${already.size} already sent)`);
    let ok = 0;
    for (const r of queue) {
      try {
        await sendOne(r);
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

  throw new Error('Usage: build [--limit N] | test <email> | send --confirm [--limit N]');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

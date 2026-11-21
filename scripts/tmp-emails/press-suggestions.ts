/**
 * One-off: search the web for press about every artist with an account and send
 * what we find to the artist as a profile suggestion (press_add) they can accept
 * at /profiles/suggestions. Artists without an artist profile get a minimal one
 * (same insert as onboarding) so the suggestion has somewhere to land.
 *
 *   tsx press-suggestions.ts build [--limit N]        → searches + verifies each link, caches to ./out,
 *                                                       writes ./out/press-review.md for a human check
 *   tsx press-suggestions.ts drop <url> [<url>...]     → remove links from the cache after review
 *   tsx press-suggestions.ts preview                   → writes ./out/press-suggestions-email.html
 *   tsx press-suggestions.ts test <email>              → emails one sample to <email> (no DB writes)
 *   tsx press-suggestions.ts send --from <your-email> --confirm [--limit N]
 *
 * Only `build` calls OpenAI and fetches pages; `send` uses the cache, so what was
 * reviewed is what goes out. `send` logs each user id to ./out/sent-press-suggestions.log
 * and skips those on re-run. In-app suggestion + notification go to everyone with
 * results; the email skips users who opted out of digests.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Resend } from 'resend';
import { buildBulletproofButtonTable, buildEmailHtml, escapeHtml, type EmailTheme } from '../../src/lib/email-layout';
import { mergeEmailSettingsIntoTheme } from '../../src/lib/email-layout-presets';
import { normalizeNewsPublicationUrl, type NewsPublicationInput } from '../../src/lib/news-publications';
import { parseJsonLoose } from '../../src/lib/ai/parse-json-loose';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'out');
const CACHE = join(OUT, 'press-suggestions.json');
const REVIEW = join(OUT, 'press-review.md');
const LOG = join(OUT, 'sent-press-suggestions.log');
const SITE = 'https://www.provenance.guru';
const CONTACT = 'dev@provenance.guru';
const SUBJECT = 'We found press about your work';
// gpt-4o-search-preview (used by find-press-articles.ts) is retired; Responses API + web_search tool instead.
const MODEL = 'gpt-5.1';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Article = NewsPublicationInput & { note?: string };
type Dropped = { url: string; title: string; reason: string };
type Artist = {
  userId: string;
  email: string | null;
  name: string;
  profileId: string | null; // null → profile gets created on send
  location: string | null;
  medium: string | null;
  website: string | null;
  existingPress: string[]; // normalized urls
  articles: Article[];
  dropped: Dropped[];
  skipped?: string;
};

// ── Artists ────────────────────────────────────────────────────────────────

async function loadArtists(): Promise<Artist[]> {
  const { data: accounts, error } = await db.from('accounts').select('id, name, email, public_data');
  if (error) throw error;
  const { data: profiles, error: pErr } = await db
    .from('user_profiles')
    .select('id, user_id, name, location, medium, website, news_publications, updated_at')
    .eq('role', 'artist')
    .not('user_id', 'is', null)
    .order('updated_at', { ascending: false });
  if (pErr) throw pErr;

  // One profile per user: the most recently updated artist profile.
  const profileByUser = new Map<string, Record<string, unknown>>();
  for (const p of profiles ?? []) if (!profileByUser.has(p.user_id)) profileByUser.set(p.user_id, p);

  const out: Artist[] = [];
  for (const a of accounts ?? []) {
    const role = (a.public_data as { role?: string } | null)?.role;
    const p = profileByUser.get(a.id);
    if (role !== 'artist' && !p) continue;
    const email = a.email ? String(a.email).trim().toLowerCase() : null;
    if (email && (/^appreview/.test(email) || /@(example\.com|test\.com)$/.test(email))) continue;
    const press = Array.isArray(p?.news_publications) ? (p!.news_publications as NewsPublicationInput[]) : [];
    out.push({
      userId: a.id,
      email,
      name: String((p?.name as string) || a.name || '').trim(),
      profileId: (p?.id as string) ?? null,
      location: (p?.location as string) || null,
      medium: (p?.medium as string) || null,
      website: (p?.website as string) || null,
      existingPress: press.map((x) => normalizeNewsPublicationUrl(x.url)).filter(Boolean),
      articles: [],
      dropped: [],
    });
  }
  return out;
}

// ── Search ─────────────────────────────────────────────────────────────────

async function search(openai: OpenAI, a: Artist): Promise<Article[]> {
  const hints = [
    a.location && `based in ${a.location}`,
    a.medium && `works in ${a.medium}`,
    a.website && `website ${a.website}`,
  ]
    .filter(Boolean)
    .join('; ');
  const prompt = `Search the web for real press articles, interviews, exhibition reviews, and news coverage about the visual artist named "${a.name}"${hints ? ` (${hints})` : ''}.

Other people may share this name. Only include coverage that is clearly about this visual artist.

Respond with ONE JSON object and nothing else. Do not include prose, citations, or markdown fences. The JSON object must have a single key "articles" whose value is an array of up to 10 items. Each item must have:
- "title": the article headline (string)
- "url": the direct URL to the article, must start with https (string)
- "publication_name": the name of the publication or website (string, optional)
- "date": publication date in YYYY-MM-DD or year only (string, optional, omit if unknown)
- "note": one short sentence on why this is about this artist (string)

Do not include social media posts, the artist's own website, shops, or directory listings. Only include real articles with actual URLs you found via web search. If you find none, return {"articles": []}.`;
  const response = await openai.responses.create({
    model: MODEL,
    tools: [{ type: 'web_search' } as never],
    instructions:
      'You are a research assistant that searches the web and returns ONLY a single valid JSON object matching the user instructions. Output must be parseable by JSON.parse.',
    input: prompt,
  });
  const parsed = parseJsonLoose(response.output_text ?? '') as { articles?: unknown } | null;
  const list = Array.isArray(parsed?.articles) ? parsed!.articles : [];
  return list
    .filter((r): r is Record<string, string> => !!r && typeof r === 'object')
    .filter((r) => typeof r.title === 'string' && typeof r.url === 'string' && r.url.startsWith('http'))
    .map((r) => ({
      title: r.title.trim().slice(0, 300),
      url: r.url.trim().replace(/[?&]utm_[^&]+/g, ''),
      ...(r.publication_name ? { publication_name: String(r.publication_name).slice(0, 200) } : {}),
      ...(r.date ? { date: String(r.date).slice(0, 20) } : {}),
      ...(r.note ? { note: String(r.note).slice(0, 300) } : {}),
    }));
}

// ── Verification ───────────────────────────────────────────────────────────

const SOCIAL = /(^|\.)(instagram|facebook|tiktok|twitter|x|threads|pinterest|linkedin|youtube|etsy|amazon|ebay)\.com$/i;
const ART_TERMS = /\b(artist|artists|artwork|exhibit|exhibition|gallery|galleries|painting|paintings|painter|sculpture|mural|museum|installation|curator|printmaking|ceramics|photographer|studio)\b/i;

function host(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8217;|&rsquo;/g, "'")
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

async function verify(a: Artist, art: Article): Promise<string | null> {
  const h = host(art.url);
  if (!h) return 'bad url';
  if (SOCIAL.test(h)) return 'social media / shop';
  if (a.website && host(a.website) === h) return "artist's own site";
  if (h === 'provenance.guru') return 'our own site';
  if (a.existingPress.includes(normalizeNewsPublicationUrl(art.url))) return 'already on profile';
  let res: Response;
  try {
    res = await fetch(art.url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch (e) {
    return `fetch failed (${(e as Error).name})`;
  }
  if (!res.ok) return `HTTP ${res.status}`;
  const text = pageText(await res.text());
  const fullName = a.name.toLowerCase().replace(/\s+/g, ' ');
  if (!text.includes(fullName)) return 'page does not mention the full name';
  if (!ART_TERMS.test(text)) return 'page is not about art';
  return null;
}

async function build(limit: number): Promise<Artist[]> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error('OPENAI_API_KEY not set');
  const openai = new OpenAI({ apiKey: key });
  const artists = (await loadArtists()).slice(0, limit);
  console.log(`${artists.length} artists`);

  const CONCURRENCY = 4;
  let done = 0;
  for (let i = 0; i < artists.length; i += CONCURRENCY) {
    await Promise.all(
      artists.slice(i, i + CONCURRENCY).map(async (a) => {
        // A single word ("HENDERSON") or a handle can't be told apart from strangers on the web.
        if (a.name.split(/\s+/).length < 2 || /\d/.test(a.name) || a.name.includes('@')) {
          a.skipped = 'name too ambiguous to search';
          return;
        }
        try {
          const found = await search(openai, a);
          const seen = new Set<string>();
          for (const art of found) {
            const norm = normalizeNewsPublicationUrl(art.url);
            if (seen.has(norm)) continue;
            seen.add(norm);
            const reason = await verify(a, art);
            if (reason) a.dropped.push({ url: art.url, title: art.title, reason });
            else a.articles.push(art);
          }
        } catch (e) {
          a.skipped = `search failed: ${(e as Error).message}`;
        }
      }),
    );
    done = Math.min(i + CONCURRENCY, artists.length);
    console.log(`searched ${done}/${artists.length}`);
  }
  return artists;
}

function writeReview(artists: Artist[]): void {
  const withHits = artists.filter((a) => a.articles.length);
  const lines = [
    `# Press suggestions review (${new Date().toISOString().slice(0, 10)})`,
    '',
    `${artists.length} artists searched · ${withHits.length} with verified articles · ${withHits.reduce((n, a) => n + a.articles.length, 0)} articles total · ${withHits.filter((a) => !a.profileId).length} need a profile created`,
    '',
    'Remove a wrong link with: `npx tsx --env-file=.env.local scripts/tmp-emails/press-suggestions.ts drop <url>`',
    '',
  ];
  for (const a of [...artists].sort((x, y) => y.articles.length - x.articles.length)) {
    const ctx = [a.location, a.medium].filter(Boolean).join(' · ');
    lines.push(`## ${a.name || '(no name)'}${ctx ? ` — ${ctx}` : ''}${a.profileId ? '' : ' _(no profile yet)_'}`);
    if (a.skipped) lines.push(`_Skipped: ${a.skipped}_`);
    for (const art of a.articles) {
      lines.push(`- ✅ [${art.title}](${art.url})${art.publication_name ? ` — ${art.publication_name}` : ''}${art.date ? ` (${art.date})` : ''}`);
      if (art.note) lines.push(`  - ${art.note}`);
    }
    for (const d of a.dropped) lines.push(`- ❌ ${d.title} — ${d.reason} — ${d.url}`);
    if (!a.skipped && !a.articles.length && !a.dropped.length) lines.push('_Nothing found._');
    lines.push('');
  }
  writeFileSync(REVIEW, lines.join('\n'));
}

// ── Email ──────────────────────────────────────────────────────────────────

async function loadTheme(): Promise<EmailTheme> {
  const { data } = await db.from('email_settings').select('layout_preset, masthead_title, masthead_subtitle').limit(1).maybeSingle();
  return mergeEmailSettingsIntoTheme(data ?? {});
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? '';
  return first && !first.includes('@') ? first : 'there';
}

function render(a: Artist, t: EmailTheme): string {
  const rows = a.articles
    .map((art) => {
      const meta = [art.publication_name, art.date].filter(Boolean).map((s) => escapeHtml(String(s))).join(' &middot; ');
      return `
  <tr>
    <td style="padding:14px 0;border-bottom:1px solid ${t.cardBorder};">
      <p style="margin:0;font-family:${t.fontFamily};font-size:16px;font-weight:600;"><a href="${escapeHtml(art.url)}" target="_blank" rel="noopener noreferrer" style="color:${t.wine};text-decoration:none;">${escapeHtml(art.title)}</a></p>
      ${meta ? `<p style="margin:4px 0 0;font-family:${t.fontFamily};font-size:14px;color:${t.inkMuted};">${meta}</p>` : ''}
    </td>
  </tr>`;
    })
    .join('');
  const n = a.articles.length;
  const body = `
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:transparent;">${n} ${n === 1 ? 'article' : 'articles'} ready to add to your Provenance profile.&#8203;&nbsp;&#8203;&nbsp;</div>
<h2 style="margin:0 0 16px;font-family:${t.fontFamilyHeading};font-size:24px;font-weight:700;color:${t.ink};line-height:1.25;">Press about your work</h2>
<p style="margin:0 0 20px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Hi ${escapeHtml(firstName(a.name))}, we looked for press coverage of your work and found ${n === 1 ? 'an article' : `${n} articles`} you can add to the Press section of your profile. Pick the ones that are really about you and they&rsquo;ll show on your page.</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;border-top:1px solid ${t.cardBorder};">${rows}
</table>
<div style="margin:24px 0;">${buildBulletproofButtonTable(`${SITE}/profiles/suggestions`, 'Review and add to my profile', t)}</div>
<p style="margin:0 0 16px;font-family:${t.fontFamily};font-size:13px;line-height:1.6;color:${t.inkMuted};">These were found with an automated web search, so a few may be about someone else with your name. Nothing is added until you choose it.</p>
<p style="margin:0 0 4px;font-family:${t.fontFamily};font-size:16px;line-height:1.7;color:${t.ink};">Best,</p>
<p style="margin:0;font-family:${t.fontFamilyHeading};font-size:17px;font-style:italic;color:${t.ink};">Tim</p>
<p style="margin:2px 0 0;font-family:${t.fontFamily};font-size:13px;color:${t.inkMuted};">Founder, Provenance</p>
<p style="margin:28px 0 0;font-family:${t.fontFamily};font-size:12px;line-height:1.6;color:${t.inkMuted};">Prefer not to receive these? Email <a href="mailto:${CONTACT}?subject=Unsubscribe" style="color:${t.wine};text-decoration:none;">${CONTACT}</a> and we will take you off the list.</p>`;
  return buildEmailHtml(SUBJECT, `<div>${body}</div>`, t);
}

// ── Send ───────────────────────────────────────────────────────────────────

async function ensureProfile(a: Artist): Promise<string> {
  if (a.profileId) return a.profileId;
  const { data: existing } = await db
    .from('user_profiles')
    .select('id')
    .eq('user_id', a.userId)
    .eq('role', 'artist')
    .limit(1)
    .maybeSingle();
  if (existing) return existing.id as string;
  // Same minimal insert as onboarding (src/app/api/onboarding/upload-cv/route.ts).
  const { data, error } = await db
    .from('user_profiles')
    .insert({ user_id: a.userId, role: 'artist', name: a.name || 'Artist', is_active: true })
    .select('id')
    .single();
  if (error || !data) throw new Error(`profile create failed: ${error?.message}`);
  console.log(`  created artist profile ${data.id} for ${a.name}`);
  return data.id as string;
}

async function saveSuggestion(a: Artist, profileId: string, fromUserId: string): Promise<string> {
  const pressAdd: NewsPublicationInput[] = a.articles.map(({ note: _n, ...p }) => p);
  const message = 'We searched the web for press about your work. Choose the articles that are about you to add them to your Press section.';
  // Merge into an open non-exhibition suggestion if there is one.
  const { data: open } = await db
    .from('artist_profile_suggestions')
    .select('id, update_fields')
    .eq('profile_id', profileId)
    .is('exhibition_id', null)
    .eq('status', 'pending')
    .maybeSingle();
  if (open) {
    const fields = (open.update_fields ?? {}) as { press_add?: NewsPublicationInput[] };
    const have = new Set((fields.press_add ?? []).map((p) => normalizeNewsPublicationUrl(p.url)));
    const merged = [...(fields.press_add ?? []), ...pressAdd.filter((p) => !have.has(normalizeNewsPublicationUrl(p.url)))];
    const { error } = await db
      .from('artist_profile_suggestions')
      .update({ update_fields: { ...fields, press_add: merged }, updated_at: new Date().toISOString() })
      .eq('id', open.id);
    if (error) throw new Error(`suggestion update failed: ${error.message}`);
    return open.id as string;
  }
  const { data, error } = await db
    .from('artist_profile_suggestions')
    .insert({ profile_id: profileId, exhibition_id: null, requested_by: fromUserId, update_fields: { press_add: pressAdd }, message })
    .select('id')
    .single();
  if (error || !data) throw new Error(`suggestion insert failed: ${error?.message}`);
  return data.id as string;
}

// ── CLI ────────────────────────────────────────────────────────────────────

function argVal(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}
const argNum = (flag: string) => (argVal(flag) ? Number(argVal(flag)) : Infinity);

function readCache(): Artist[] {
  if (!existsSync(CACHE)) throw new Error('No cache yet. Run `build` first.');
  return JSON.parse(readFileSync(CACHE, 'utf8')) as Artist[];
}

async function main() {
  const [mode, ...rest] = process.argv.slice(2);
  mkdirSync(OUT, { recursive: true });

  if (mode === 'build') {
    const artists = await build(argNum('--limit'));
    writeFileSync(CACHE, JSON.stringify(artists, null, 2));
    writeReview(artists);
    const hits = artists.filter((a) => a.articles.length);
    console.log(`${hits.length}/${artists.length} artists with verified press. Review: ${REVIEW}`);
    return;
  }

  if (mode === 'drop') {
    const urls = new Set(rest.filter((u) => u.startsWith('http')).map(normalizeNewsPublicationUrl));
    const artists = readCache();
    let n = 0;
    for (const a of artists) {
      const keep = a.articles.filter((art) => !urls.has(normalizeNewsPublicationUrl(art.url)));
      for (const art of a.articles) if (!keep.includes(art)) a.dropped.push({ url: art.url, title: art.title, reason: 'removed in review' });
      n += a.articles.length - keep.length;
      a.articles = keep;
    }
    writeFileSync(CACHE, JSON.stringify(artists, null, 2));
    writeReview(artists);
    console.log(`Removed ${n} link(s). Review updated: ${REVIEW}`);
    return;
  }

  const theme = await loadTheme();

  if (mode === 'preview') {
    const sample = [...readCache()].sort((a, b) => b.articles.length - a.articles.length)[0];
    if (!sample?.articles.length) throw new Error('No artist with articles in the cache');
    writeFileSync(join(OUT, 'press-suggestions-email.html'), render(sample, theme));
    console.log(`Preview for ${sample.name}: ${join(OUT, 'press-suggestions-email.html')}`);
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || 'Provenance <noreply@provenance.guru>';
  const sendEmail = async (to: string, a: Artist) => {
    const { error } = await resend.emails.send({ from, to, replyTo: CONTACT, subject: SUBJECT, html: render(a, theme) });
    if (error) throw new Error(`${to}: ${error.message}`);
  };

  if (mode === 'test') {
    const to = rest[0];
    if (!to) throw new Error('Pass a test address');
    const sample = [...readCache()].sort((a, b) => b.articles.length - a.articles.length)[0];
    if (!sample?.articles.length) throw new Error('No artist with articles in the cache');
    await sendEmail(to, { ...sample, name: 'Tim' });
    console.log(`Test sent to ${to} (articles from ${sample.name})`);
    return;
  }

  if (mode === 'send') {
    if (!process.argv.includes('--confirm')) throw new Error('Refusing to send without --confirm');
    const fromEmail = argVal('--from')?.toLowerCase();
    if (!fromEmail) throw new Error('Pass --from <your account email> (shown to artists as who suggested it)');
    const { data: me } = await db.from('accounts').select('id, name').eq('email', fromEmail).maybeSingle();
    if (!me) throw new Error(`No account for ${fromEmail}`);

    const { data: optOuts, error: optErr } = await db.from('email_preferences').select('user_id').eq('digest_opt_out', true);
    if (optErr) throw new Error(`Cannot read opt-outs, refusing to continue: ${optErr.message}`);
    const noEmail = new Set((optOuts ?? []).map((r) => r.user_id as string));

    const already = new Set(existsSync(LOG) ? readFileSync(LOG, 'utf8').split('\n').filter(Boolean) : []);
    const cache = readCache();
    // A second account with the same name as an artist who already has a profile is a duplicate
    // signup: don't create a second public profile for the same person.
    const namesWithProfile = new Set(cache.filter((a) => a.profileId).map((a) => a.name.toLowerCase()));
    const queue = cache
      .filter((a) => a.profileId || !namesWithProfile.has(a.name.toLowerCase()))
      .filter((a) => a.articles.length && !already.has(a.userId))
      .slice(0, argNum('--limit'));
    console.log(`Sending press suggestions to ${queue.length} artists (${already.size} already done) as ${me.name}`);

    let ok = 0;
    for (const a of queue) {
      try {
        const profileId = await ensureProfile(a);
        const suggestionId = await saveSuggestion(a, profileId, me.id as string);
        const n = a.articles.length;
        const { error: nErr } = await db.from('notifications').insert({
          user_id: a.userId,
          type: 'artist_profile_suggestion',
          title: 'Press found for your profile',
          message: `We found ${n} ${n === 1 ? 'article' : 'articles'} about your work. Choose which to add to your Press section.`,
          related_user_id: me.id,
          metadata: { suggestion_id: suggestionId, profile_id: profileId },
        });
        if (nErr) console.error(`  notification failed for ${a.name}: ${nErr.message}`);
        if (a.email && !noEmail.has(a.userId)) await sendEmail(a.email, a);
        appendFileSync(LOG, `${a.userId}\n`);
        ok++;
        console.log(`  ✓ ${a.name}: ${n} article(s)${a.email && !noEmail.has(a.userId) ? ', emailed' : ', in-app only'}`);
        await new Promise((r) => setTimeout(r, 600)); // Resend rate limit
      } catch (e) {
        console.error(`  ✗ ${a.name}: ${(e as Error).message}`);
      }
    }
    console.log(`Done: ${ok}/${queue.length}. Log: ${LOG}`);
    return;
  }

  throw new Error('Mode must be build | drop | preview | test | send');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

import OpenAI from 'openai';
import type { ArtistCvJson } from '~/lib/grants';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

/**
 * Personalised content for the weekly grants / open-calls digest.
 *
 * - Open calls come from the platform DB, filtered to the artist's location and
 *   ranked by medium match.
 * - Grants and residencies come from the LLM, prompted with the artist's CV,
 *   location and medium. New finds are saved to `artist_grants` so they also
 *   appear on /grants and are not repeated in later digests.
 */

export type DigestItem = {
  title: string;
  deadline: string | null;
  detail: string | null;
  url: string | null;
};

export type DigestArtist = {
  userId: string;
  profileId: string;
  name: string;
  location: string | null;
  medium: string | null;
  cv: ArtistCvJson | null;
};

export type OpenCallCandidate = {
  slug: string;
  submission_closing_date: string | null;
  medium: string | null;
  eligible_locations: string[] | null;
  external_url: string | null;
  exhibition: { title: string; description: string | null } | null;
};

export type LlmGrant = {
  name?: unknown;
  description?: unknown;
  deadline?: unknown;
  amount?: unknown;
  eligible_locations?: unknown;
  url?: unknown;
  discipline?: unknown;
  type?: unknown;
};

export type CleanGrant = {
  name: string;
  description: string | null;
  deadline: string | null;
  amount: string | null;
  eligible_locations: string[];
  url: string | null;
  discipline: string[];
  type: 'grant' | 'residency';
};

const MAX_ITEMS_PER_SECTION = 5;
const GRANTS_MODEL = 'gpt-4o-mini';
const DIGEST_GRANT_SOURCE = 'weekly_digest';
const REPEAT_WINDOW_DAYS = 90;

// ─── Pure helpers ─────────────────────────────────────────────────────────────

/** Accepts only absolute http(s) URLs; LLM output must never reach an href unchecked. */
export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === 'string' && v.trim() !== '').map((v) => v.trim())
    : [];
}

function asTrimmedString(value: unknown, max: number): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;
}

/**
 * Validate and clean raw LLM grants: drop nameless entries, malformed or past
 * deadlines, unsafe URLs, anything in `excludeNames`, and duplicates.
 */
export function sanitizeLlmGrants(
  raw: LlmGrant[],
  now: Date,
  excludeNames: Iterable<string> = [],
): CleanGrant[] {
  const seen = new Set<string>();
  for (const n of excludeNames) seen.add(n.trim().toLowerCase());
  const today = now.toISOString().slice(0, 10);

  const out: CleanGrant[] = [];
  for (const g of raw) {
    const name = asTrimmedString(g.name, 200);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    let deadline: string | null = null;
    if (typeof g.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(g.deadline.trim())) {
      deadline = g.deadline.trim();
      if (Number.isNaN(Date.parse(deadline)) || deadline < today) continue;
    }

    seen.add(key);
    out.push({
      name,
      description: asTrimmedString(g.description, 500),
      deadline,
      amount: asTrimmedString(g.amount, 80),
      eligible_locations: asStringArray(g.eligible_locations),
      url: safeHttpUrl(g.url),
      discipline: asStringArray(g.discipline),
      type: g.type === 'residency' ? 'residency' : 'grant',
    });
  }
  return out;
}

function locationMatches(eligible: string[] | null, artistLocation: string | null): boolean {
  const locs = eligible ?? [];
  if (locs.length === 0) return true; // no restriction
  if (!artistLocation?.trim()) return false;
  const artist = artistLocation.trim().toLowerCase();
  return locs.some((loc) => {
    const l = loc.toLowerCase();
    return l.includes(artist) || artist.includes(l);
  });
}

/** Open calls the artist can apply to, medium matches first, then soonest deadline. */
export function selectOpenCallsForArtist(
  candidates: OpenCallCandidate[],
  artist: Pick<DigestArtist, 'location' | 'medium'>,
  siteUrl: string,
  limit = MAX_ITEMS_PER_SECTION,
): DigestItem[] {
  const medium = artist.medium?.trim().toLowerCase() ?? '';
  const eligible = candidates.filter(
    (oc) => oc.exhibition?.title && locationMatches(oc.eligible_locations, artist.location),
  );

  const mediumMatch = (oc: OpenCallCandidate) =>
    Boolean(medium && oc.medium && medium.includes(oc.medium.trim().toLowerCase())) ? 0 : 1;
  const closing = (oc: OpenCallCandidate) => oc.submission_closing_date ?? '9999-12-31';

  return eligible
    .sort((a, b) => mediumMatch(a) - mediumMatch(b) || closing(a).localeCompare(closing(b)))
    .slice(0, limit)
    .map((oc) => ({
      title: oc.exhibition!.title,
      deadline: oc.submission_closing_date,
      detail: oc.medium,
      url: safeHttpUrl(oc.external_url) ?? `${siteUrl}/open-calls/${oc.slug}`,
    }));
}

export function grantToDigestItem(g: {
  name: string;
  deadline: string | null;
  amount: string | null;
  url: string | null;
}): DigestItem {
  return { title: g.name, deadline: g.deadline, detail: g.amount, url: safeHttpUrl(g.url) };
}

function summariseCv(artist: DigestArtist): string {
  const cv = artist.cv;
  const lines = [
    `Name: ${artist.name}`,
    `Location: ${artist.location ?? cv?.location ?? 'unknown'}`,
    `Medium: ${artist.medium ?? cv?.medium ?? 'unknown'}`,
  ];
  if (cv?.disciplines?.length) lines.push(`Disciplines: ${cv.disciplines.join(', ')}`);
  if (cv?.education?.length) {
    lines.push(
      `Education: ${cv.education
        .slice(0, 3)
        .map((e) => [e.degree, e.institution, e.year].filter(Boolean).join(' '))
        .join('; ')}`,
    );
  }
  if (cv?.exhibitions?.length) {
    lines.push(
      `Selected exhibitions: ${cv.exhibitions
        .slice(0, 5)
        .map((e) => [e.name, e.venue, e.year].filter(Boolean).join(', '))
        .join('; ')}`,
    );
  }
  if (typeof cv?.summary === 'string' && cv.summary) lines.push(`Summary: ${cv.summary.slice(0, 600)}`);
  return lines.join('\n');
}

// ─── LLM ──────────────────────────────────────────────────────────────────────

const RECOMMEND_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'recommend_grants',
    description: 'Return grants and residencies that fit this artist.',
    parameters: {
      type: 'object',
      properties: {
        grants: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Official program name' },
              type: { type: 'string', enum: ['grant', 'residency'] },
              description: { type: 'string', description: 'One sentence on what it offers and who it is for' },
              deadline: { type: 'string', description: 'Next deadline YYYY-MM-DD. Omit if not certain.' },
              amount: { type: 'string', description: 'Award amount, e.g. $5,000. Omit if unknown.' },
              eligible_locations: { type: 'array', items: { type: 'string' } },
              url: { type: 'string', description: 'Official program URL. Omit if not certain.' },
              discipline: { type: 'array', items: { type: 'string' } },
            },
            required: ['name', 'type'],
          },
        },
      },
      required: ['grants'],
    },
  },
};

/** Ask the LLM for grants/residencies tailored to one artist. Returns [] on any failure. */
export async function recommendGrantsForArtist(
  openai: OpenAI,
  artist: DigestArtist,
  excludeNames: string[],
  now: Date,
): Promise<CleanGrant[]> {
  const system = [
    'You find grants and artist residencies for visual artists.',
    `Today is ${now.toISOString().slice(0, 10)}.`,
    'Recommend up to 8 real, established programs the artist is eligible for based on their location, medium and career stage, favouring ones with an application window open now or in the next few months.',
    'Only include programs you are confident exist. If you are not certain of a deadline or URL, omit that field rather than guessing.',
    excludeNames.length ? `Do not include any of these (already sent): ${excludeNames.slice(0, 40).join('; ')}` : null,
    'Call recommend_grants with your answer.',
  ]
    .filter(Boolean)
    .join('\n');

  try {
    const completion = await openai.chat.completions.create({
      model: GRANTS_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Artist:\n${summariseCv(artist)}` },
      ],
      tools: [RECOMMEND_TOOL],
      tool_choice: { type: 'function', function: { name: 'recommend_grants' } },
    });
    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== 'function') return [];
    const parsed = JSON.parse(call.function.arguments) as { grants?: LlmGrant[] };
    return sanitizeLlmGrants(Array.isArray(parsed.grants) ? parsed.grants : [], now, excludeNames);
  } catch (err) {
    console.error('[weekly-digest] grant recommendation failed', { userId: artist.userId, err });
    return [];
  }
}

// ─── DB access ────────────────────────────────────────────────────────────────

/** Artist profile context (location, medium, CV) for each user id. */
export async function loadDigestArtists(
  admin: UntypedSupabaseClient,
  userIds: string[],
): Promise<Map<string, DigestArtist>> {
  const { data, error } = await admin
    .from('user_profiles')
    .select('id, user_id, name, location, medium, artist_cv_json')
    .eq('role', 'artist')
    .in('user_id', userIds)
    .order('created_at', { ascending: true });

  if (error) console.error('[weekly-digest] artist profile query failed', error);

  const byUser = new Map<string, DigestArtist>();
  for (const p of (data ?? []) as Array<Record<string, unknown>>) {
    const userId = p.user_id as string;
    if (byUser.has(userId)) continue; // first (oldest) artist profile wins
    byUser.set(userId, {
      userId,
      profileId: p.id as string,
      name: (p.name as string) ?? '',
      location: (p.location as string | null) ?? null,
      medium: (p.medium as string | null) ?? null,
      cv: (p.artist_cv_json as ArtistCvJson | null) ?? null,
    });
  }
  return byUser;
}

/** Currently open exhibition-style open calls; fetched once and filtered per artist. */
export async function loadOpenCallCandidates(
  admin: UntypedSupabaseClient,
  now: Date,
): Promise<OpenCallCandidate[]> {
  const today = now.toISOString().slice(0, 10);
  const { data, error } = await admin
    .from('open_calls')
    .select(
      'slug, submission_closing_date, medium, eligible_locations, external_url, exhibition:exhibition_id (title, description)',
    )
    .in('call_type', ['exhibition', 'art'])
    .or(`submission_closing_date.gte.${today},submission_closing_date.is.null`)
    .order('submission_closing_date', { ascending: true, nullsFirst: false })
    .limit(200);

  if (error) {
    console.error('[weekly-digest] open calls query failed', error);
    return [];
  }
  return (data ?? []) as unknown as OpenCallCandidate[];
}

/** Names already recommended by earlier digests, so each week brings something new. */
async function loadPreviouslySentNames(admin: UntypedSupabaseClient, userId: string, now: Date): Promise<string[]> {
  const since = new Date(now.getTime() - REPEAT_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await admin
    .from('artist_grants')
    .select('name')
    .eq('user_id', userId)
    .eq('source', DIGEST_GRANT_SOURCE)
    .gte('created_at', since);
  return ((data ?? []) as { name: string }[]).map((r) => r.name);
}

/** Upcoming grants already on file for the user (or curated / community) to top up a thin LLM result. */
async function loadStoredUpcomingGrants(
  admin: UntypedSupabaseClient,
  userId: string,
  now: Date,
  limit: number,
): Promise<DigestItem[]> {
  const { data } = await admin
    .from('artist_grants')
    .select('name, deadline, amount, url')
    .or(`user_id.eq.${userId},user_id.is.null,is_community.eq.true`)
    .gte('deadline', now.toISOString().slice(0, 10))
    .order('deadline', { ascending: true })
    .limit(limit);
  return ((data ?? []) as Parameters<typeof grantToDigestItem>[0][]).map(grantToDigestItem);
}

async function saveDigestGrants(
  admin: UntypedSupabaseClient,
  artist: DigestArtist,
  grants: CleanGrant[],
): Promise<void> {
  if (!grants.length) return;
  const { error } = await admin.from('artist_grants').insert(
    grants.map((g) => ({ ...g, user_id: artist.userId, artist_profile_id: artist.profileId, source: DIGEST_GRANT_SOURCE })),
  );
  if (error) console.error('[weekly-digest] saving digest grants failed', { userId: artist.userId, error });
}

// ─── Orchestration ────────────────────────────────────────────────────────────

export type ArtistDigest = { openCalls: DigestItem[]; grants: DigestItem[] };

/** Build one artist's digest content. Empty result means nothing worth emailing. */
export async function buildArtistDigest(params: {
  admin: UntypedSupabaseClient;
  openai: OpenAI | null;
  artist: DigestArtist | undefined;
  userId: string;
  openCallCandidates: OpenCallCandidate[];
  siteUrl: string;
  now: Date;
}): Promise<ArtistDigest> {
  const { admin, openai, artist, userId, openCallCandidates, siteUrl, now } = params;

  const openCalls = selectOpenCallsForArtist(
    openCallCandidates,
    { location: artist?.location ?? null, medium: artist?.medium ?? null },
    siteUrl,
  );

  let grants: DigestItem[] = [];
  if (openai && artist) {
    const previous = await loadPreviouslySentNames(admin, userId, now);
    const fresh = (await recommendGrantsForArtist(openai, artist, previous, now)).slice(0, MAX_ITEMS_PER_SECTION);
    await saveDigestGrants(admin, artist, fresh);
    grants = fresh.map(grantToDigestItem);
  }

  if (grants.length < MAX_ITEMS_PER_SECTION) {
    const stored = await loadStoredUpcomingGrants(admin, userId, now, MAX_ITEMS_PER_SECTION * 2);
    const have = new Set(grants.map((g) => g.title.toLowerCase()));
    for (const item of stored) {
      if (grants.length >= MAX_ITEMS_PER_SECTION) break;
      if (!have.has(item.title.toLowerCase())) grants.push(item);
    }
  }

  return { openCalls, grants };
}

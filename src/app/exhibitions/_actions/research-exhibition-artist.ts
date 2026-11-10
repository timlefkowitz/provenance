'use server';

import OpenAI from 'openai';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AI_CONSENT_REQUIRED_MESSAGE, hasAiConsent } from '~/lib/ai-consent';
import { canUseArtistResearch } from '~/lib/ai/feature-access';
import { checkRateLimit } from '~/lib/rate-limit';
import { formatTombstone } from '~/lib/artist-details/fields';
import {
  buildArtistResearchPrompt,
  parseArtistResearchResponse,
  type FindingKind,
} from '~/lib/artist-research/parse-artist-research';
import { applyFindingsToShowCopy } from '~/lib/artist-research/apply-findings';
import { requireExhibitionManager } from '../_helpers/require-exhibition-manager';
import { loadExhibitionArtists } from '../_helpers/load-exhibition-artists';

/** Chat Completions web-search model (same as find-press-articles). */
const ARTIST_RESEARCH_MODEL = 'gpt-4o-search-preview';

export type StoredFinding = {
  id: string;
  kind: FindingKind;
  payload: Record<string, unknown>;
  source_url: string;
  source_title: string | null;
  status: 'suggested' | 'accepted' | 'dismissed';
  created_at: string;
};

type Result<T> = ({ success: true } & T) | { success: false; error: string };

const FINDING_COLUMNS = 'id, kind, payload, source_url, source_title, status, created_at';

/** Findings saved for one artist in this show (newest first). */
export async function getArtistResearchFindings(input: {
  exhibitionId: string;
  artistKey: string;
}): Promise<Result<{ findings: StoredFinding[] }>> {
  const auth = await requireExhibitionManager(input.exhibitionId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { data, error } = await auth.ctx.admin
    .from('artist_research_findings')
    .select(FINDING_COLUMNS)
    .eq('exhibition_id', input.exhibitionId)
    .eq('artist_key', input.artistKey)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[ArtistResearch] load findings failed', error);
    return { success: false, error: 'Could not load earlier findings.' };
  }
  return { success: true, findings: (data || []) as StoredFinding[] };
}

/**
 * "Find information": search the web for public, career-only facts about an
 * artist in this show, each with a source link. Results are saved as
 * suggestions only the show's managers can see until they accept them.
 */
export async function researchExhibitionArtist(input: {
  exhibitionId: string;
  artistKey: string;
}): Promise<Result<{ findings: StoredFinding[]; added: number }>> {
  const auth = await requireExhibitionManager(input.exhibitionId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { admin, userId } = auth.ctx;

  const access = await canUseArtistResearch(userId);
  if (!access.allowed) return { success: false, error: access.reason };
  if (!(await hasAiConsent(userId))) return { success: false, error: AI_CONSENT_REQUIRED_MESSAGE };

  const allowed = await checkRateLimit(
    { headers: await headers() },
    { keyPrefix: `artist-research:${userId}`, maxPerWindow: 10, windowMs: 10 * 60_000 },
  );
  if (!allowed) return { success: false, error: 'Too many searches. Wait a few minutes and try again.' };

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    console.error('[ArtistResearch] OPENAI_API_KEY not set');
    return { success: false, error: 'Artist research is not configured.' };
  }

  // Only artists actually in this show can be researched.
  const artists = await loadExhibitionArtists(admin, input.exhibitionId);
  const artist = artists.find((a) => a.key === input.artistKey);
  if (!artist) return { success: false, error: 'That artist is not in this exhibition.' };

  const tomb = formatTombstone(artist.effective);
  const prompt = buildArtistResearchPrompt({
    name: artist.name,
    medium: artist.medium,
    location: artist.location,
    website: artist.effective.website,
    knownFacts: [tomb],
  });

  let content = '';
  try {
    console.log('[ArtistResearch] searching', { exhibitionId: input.exhibitionId, artistKey: input.artistKey, model: ARTIST_RESEARCH_MODEL });
    const openai = new OpenAI({ apiKey });
    // gpt-4o-search-preview doesn't support JSON mode; parse defensively.
    const completion = await openai.chat.completions.create({
      model: ARTIST_RESEARCH_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an art-historical research assistant. You search the web and return ONLY a single valid JSON object matching the instructions. Never include markdown, code fences, prose, or commentary.',
        },
        { role: 'user', content: prompt },
      ],
    });
    content = completion.choices[0]?.message?.content ?? '';
  } catch (e) {
    console.error('[ArtistResearch] search failed', e);
    return { success: false, error: 'The search failed. Try again in a moment.' };
  }

  const parsed = parseArtistResearchResponse(content);
  if (!parsed.length && content.trim()) {
    console.warn('[ArtistResearch] no usable findings', content.slice(0, 300));
  }

  // Skip findings already saved for this artist (any status).
  const { data: existing } = await admin
    .from('artist_research_findings')
    .select('kind, source_url, payload')
    .eq('exhibition_id', input.exhibitionId)
    .eq('artist_key', input.artistKey);
  const seen = new Set(
    ((existing || []) as { kind: string; source_url: string; payload: { title?: string; field?: string } }[]).map(
      (f) => `${f.kind}|${f.source_url}|${f.payload?.title ?? f.payload?.field ?? ''}`.toLowerCase(),
    ),
  );
  const fresh = parsed.filter((f) => {
    const p = f.payload as { title?: string; field?: string };
    return !seen.has(`${f.kind}|${f.source_url}|${p.title ?? p.field ?? ''}`.toLowerCase());
  });

  if (fresh.length) {
    const { error } = await admin.from('artist_research_findings').insert(
      fresh.map((f) => ({
        exhibition_id: input.exhibitionId,
        artist_key: input.artistKey,
        artist_profile_id: artist.profileId,
        kind: f.kind,
        payload: f.payload,
        source_url: f.source_url,
        source_title: f.source_title,
        model: ARTIST_RESEARCH_MODEL,
        requested_by: userId,
      })),
    );
    if (error) {
      console.error('[ArtistResearch] insert failed', error);
      return { success: false, error: 'Could not save what was found.' };
    }
  }
  console.log('[ArtistResearch] done', { found: parsed.length, added: fresh.length });

  const list = await getArtistResearchFindings(input);
  if (!list.success) return list;
  revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
  return { success: true, findings: list.findings, added: fresh.length };
}

/**
 * Accept findings (folding them into the show copy) or dismiss them.
 */
export async function reviewArtistResearchFindings(input: {
  exhibitionId: string;
  artistKey: string;
  findingIds: string[];
  decision: 'accept' | 'dismiss';
}): Promise<Result<{ changed: string[] }>> {
  const auth = await requireExhibitionManager(input.exhibitionId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { admin, userId } = auth.ctx;
  const ids = [...new Set(input.findingIds)].slice(0, 200);
  if (!ids.length) return { success: false, error: 'Choose at least one finding.' };

  const { data: rows } = await admin
    .from('artist_research_findings')
    .select('id, kind, payload, source_url')
    .eq('exhibition_id', input.exhibitionId)
    .eq('artist_key', input.artistKey)
    .in('id', ids);
  const findings = (rows || []) as { id: string; kind: FindingKind; payload: Record<string, unknown>; source_url: string }[];
  if (!findings.length) return { success: false, error: 'Those findings were not found.' };

  const now = new Date().toISOString();
  const { error: statusError } = await admin
    .from('artist_research_findings')
    .update(
      input.decision === 'accept'
        ? { status: 'accepted', accepted_by: userId, accepted_at: now, updated_at: now }
        : { status: 'dismissed', updated_at: now },
    )
    .in(
      'id',
      findings.map((f) => f.id),
    );
  if (statusError) {
    console.error('[ArtistResearch] status update failed', statusError);
    return { success: false, error: 'Could not update the findings.' };
  }
  if (input.decision === 'dismiss') {
    revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
    return { success: true, changed: [] };
  }

  const artists = await loadExhibitionArtists(admin, input.exhibitionId);
  const artist = artists.find((a) => a.key === input.artistKey);
  if (!artist) return { success: false, error: 'That artist is not in this exhibition.' };

  // Decide against what the labels show now (show copy over profile), but
  // only write the fields that changed, so untouched fields keep following
  // the artist's profile.
  const { next, changed } = applyFindingsToShowCopy(artist.effective, findings as never);
  if (!changed.length) {
    revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
    return { success: true, changed };
  }
  const patch: Record<string, unknown> = {};
  for (const key of changed) patch[key] = next[key as keyof typeof next];
  const { error } = await admin.from('exhibition_artist_details').upsert(
    {
      exhibition_id: input.exhibitionId,
      artist_key: input.artistKey,
      artist_profile_id: artist.profileId,
      artist_account_id: artist.accountId,
      display_name: artist.name,
      ...patch,
      updated_by: userId,
      updated_at: now,
    },
    { onConflict: 'exhibition_id,artist_key' },
  );
  if (error) {
    console.error('[ArtistResearch] show copy update failed', error);
    return { success: false, error: 'Accepted, but could not update the artist details.' };
  }
  console.log('[ArtistResearch] accepted findings', { count: findings.length, changed });
  revalidatePath(`/exhibitions/${input.exhibitionId}/curate`);
  revalidatePath(`/exhibitions/${input.exhibitionId}`);
  return { success: true, changed };
}

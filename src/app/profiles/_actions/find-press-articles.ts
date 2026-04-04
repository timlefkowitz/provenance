'use server';

import OpenAI from 'openai';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';
import { tavilySearch } from '~/lib/tavily-search';
import { isGalleryMember } from '~/app/profiles/_actions/gallery-members';
import type { NewsPublicationInput } from '~/lib/news-publications';

export type PressArticleSuggestion = NewsPublicationInput;

async function canEditProfilePress(userId: string, profile: {
  user_id: string | null;
  role: string;
}, profileId: string): Promise<boolean> {
  if (profile.user_id === userId) return true;
  if (profile.role === USER_ROLES.GALLERY) {
    return isGalleryMember(userId, profileId);
  }
  return false;
}

/**
 * Search the web (Tavily) and use GPT-4o-mini to filter results relevant to this profile.
 */
export async function findPressArticles(profileId: string): Promise<{
  articles: PressArticleSuggestion[];
  error: string | null;
}> {
  console.log('[Press] findPressArticles started', { profileId });

  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return { articles: [], error: 'You must be signed in' };
    }

    // user_profiles not in generated DB types
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;
    const { data: profile, error: fetchError } = await sb
      .from('user_profiles')
      .select('id, user_id, role, name, location, website')
      .eq('id', profileId)
      .eq('is_active', true)
      .single();

    if (fetchError || !profile) {
      console.error('[Press] findPressArticles profile not found', fetchError);
      return { articles: [], error: 'Profile not found' };
    }

    if (profile.role !== USER_ROLES.GALLERY && profile.role !== USER_ROLES.ARTIST) {
      return { articles: [], error: 'Press discovery is only available for gallery and artist profiles' };
    }

    if (!profile.user_id) {
      return { articles: [], error: 'This profile cannot use press discovery until it is claimed' };
    }

    const allowed = await canEditProfilePress(user.id, profile, profileId);
    if (!allowed) {
      return { articles: [], error: 'You do not have permission to update this profile' };
    }

    const name = (profile.name || '').trim();
    if (!name) {
      return { articles: [], error: 'Profile name is required to search' };
    }

    const location = (profile.location || '').trim();
    const website = (profile.website || '').trim();
    const entityKind = profile.role === USER_ROLES.GALLERY ? 'art gallery' : 'visual artist';

    const queryParts = [`"${name}"`, entityKind, 'news OR exhibition OR interview OR review'];
    if (location) queryParts.push(location);
    const searchQuery = queryParts.filter(Boolean).join(' ');

    const { results: rawResults, error: searchError } = await tavilySearch(searchQuery, 12);
    if (searchError) {
      return { articles: [], error: searchError };
    }
    if (rawResults.length === 0) {
      console.log('[Press] findPressArticles no raw results');
      return { articles: [], error: null };
    }

    const apiKey = typeof process.env.OPENAI_API_KEY === 'string' ? process.env.OPENAI_API_KEY.trim() : undefined;
    if (!apiKey) {
      console.error('[Press] findPressArticles OPENAI_API_KEY not set');
      return { articles: [], error: 'OpenAI is not configured' };
    }

    const payload = rawResults.map((r, i) => ({
      index: i,
      title: r.title,
      url: r.url,
      snippet: r.content.slice(0, 600),
    }));

    const system = `You filter web search results for press and articles about a specific ${entityKind}.
You will receive JSON with candidate results (title, url, snippet).
Return ONLY valid JSON with shape: {"articles":[{"title":"string","url":"string","publication_name":"string or empty","date":"string or empty"}]}
Rules:
- Include only items that clearly refer to the same entity as the profile (same name or unmistakable alias; for a gallery, the article should be about that gallery).
- Use only URLs from the provided candidates. Copy URLs exactly.
- publication_name: infer from site/domain or snippet if obvious, else "".
- date: extract if mentioned in snippet, else "".
- Omit duplicate URLs. Maximum 8 articles.
- If none qualify, return {"articles":[]}.`;

    const userMsg = `Profile:
- Name: ${name}
- Kind: ${entityKind}
- Location: ${location || '(unknown)'}
- Website: ${website || '(none)'}

Candidates:
${JSON.stringify(payload)}`;

    console.log('[Press] findPressArticles calling OpenAI (gpt-4o-mini)');
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userMsg },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      console.error('[Press] findPressArticles empty OpenAI response');
      return { articles: [], error: 'No response from OpenAI' };
    }

    let parsed: { articles?: PressArticleSuggestion[] };
    try {
      parsed = JSON.parse(content) as { articles?: PressArticleSuggestion[] };
    } catch (e) {
      console.error('[Press] findPressArticles JSON parse failed', e);
      return { articles: [], error: 'Invalid response from assistant' };
    }

    const allowedUrls = new Set(rawResults.map((r) => r.url));
    const articles = (parsed.articles || [])
      .filter((a) => a && typeof a.url === 'string' && typeof a.title === 'string')
      .filter((a) => allowedUrls.has(a.url.trim()))
      .map((a) => ({
        title: a.title.trim(),
        url: a.url.trim(),
        publication_name: a.publication_name?.trim() || undefined,
        date: a.date?.trim() || undefined,
      }))
      .filter((a) => a.title && a.url);

    console.log('[Press] findPressArticles success', { count: articles.length });
    return { articles, error: null };
  } catch (err) {
    console.error('[Press] findPressArticles failed', err);
    return {
      articles: [],
      error: err instanceof Error ? err.message : 'Failed to find articles',
    };
  }
}

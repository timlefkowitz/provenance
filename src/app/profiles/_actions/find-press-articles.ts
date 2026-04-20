'use server';

import OpenAI from 'openai';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { NewsPublicationInput } from '~/lib/news-publications';

export type PressArticleSuggestion = NewsPublicationInput;

/** Chat Completions web-search model (see OpenAI web search docs; Responses API uses different model IDs). */
const PRESS_SEARCH_MODEL = 'gpt-4o-search-preview';

type RawArticle = {
  title: string;
  url: string;
  publication_name?: string;
  date?: string;
};

export async function findPressArticles(profileId: string): Promise<{
  articles: PressArticleSuggestion[];
  error: string | null;
}> {
  console.log('[Press] findPressArticles started', { profileId });

  const rawKey = process.env.OPENAI_API_KEY;
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;
  if (!apiKey) {
    console.error('[Press] OPENAI_API_KEY not set');
    return { articles: [], error: 'Article discovery is not configured.' };
  }

  const supabase = getSupabaseServerClient();
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('name, role, location')
    .eq('id', profileId)
    .single();

  if (profileError || !profile) {
    console.error('[Press] Failed to fetch profile for article search', profileError);
    return { articles: [], error: 'Could not load profile for article search.' };
  }

  const { name, role, location } = profile as { name: string; role: string; location: string | null };
  const roleLabel =
    role === 'artist' ? 'artist' : role === 'gallery' ? 'art gallery' : 'art institution';
  const locationHint = location ? ` based in ${location}` : '';

  const userPrompt = `Search the web for real press articles, interviews, exhibition reviews, and news coverage about the ${roleLabel} named "${name}"${locationHint}.

Return a JSON object with a single key "articles" whose value is an array of up to 10 items. Each item must have:
- "title": the article headline
- "url": the direct URL to the article (https)
- "publication_name": the name of the publication or website
- "date": publication date in YYYY-MM-DD or year only (omit if unknown)

Only include real, verifiable articles with actual URLs.`;

  try {
    console.log('[Press] Calling OpenAI Chat Completions (web search model)', {
      model: PRESS_SEARCH_MODEL,
      name,
      role,
    });
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: PRESS_SEARCH_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You search the web and return only valid JSON matching the user instructions. No markdown.',
        },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      console.log('[Press] Empty completion from OpenAI');
      return { articles: [], error: null };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      console.error('[Press] Failed to parse JSON from OpenAI', parseErr, content.slice(0, 400));
      return { articles: [], error: null };
    }

    const raw = parsed as { articles?: unknown };
    const list = raw.articles;
    if (!Array.isArray(list)) {
      console.error('[Press] Response JSON missing articles array');
      return { articles: [], error: null };
    }

    const articles: PressArticleSuggestion[] = list
      .filter((item): item is RawArticle => {
        if (typeof item !== 'object' || item === null) return false;
        const r = item as Record<string, unknown>;
        return (
          typeof r['title'] === 'string' &&
          typeof r['url'] === 'string' &&
          (r['url'] as string).startsWith('http')
        );
      })
      .map((item) => ({
        title: item.title,
        url: item.url,
        ...(item.publication_name ? { publication_name: item.publication_name } : {}),
        ...(item.date ? { date: item.date } : {}),
      }));

    console.log('[Press] findPressArticles found', articles.length, 'articles for', name);
    return { articles, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Article search failed';
    console.error('[Press] findPressArticles failed', err);
    return { articles: [], error: `Article search failed: ${message}` };
  }
}

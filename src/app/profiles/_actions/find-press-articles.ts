'use server';

import OpenAI from 'openai';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { NewsPublicationInput } from '~/lib/news-publications';

export type PressArticleSuggestion = NewsPublicationInput;

type RawArticle = {
  title: string;
  url: string;
  publication_name?: string;
  date?: string;
};

type ResponseOutputItem = {
  type: string;
  content?: Array<{ type: string; text?: string }>;
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

  // Fetch profile to build the search query
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

  try {
    console.log('[Press] Calling OpenAI Responses API with web search', { name, role });
    const openai = new OpenAI({ apiKey });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai.responses as any).create({
      model: 'gpt-4o-mini-search-preview',
      tools: [{ type: 'web_search_preview' }],
      input: `Search the web for real press articles, interviews, exhibition reviews, and news coverage about the ${roleLabel} named "${name}"${locationHint}.

Return a JSON array of up to 10 articles. Each item must have:
- "title": the article headline
- "url": the direct URL to the article
- "publication_name": the name of the publication or website
- "date": publication date in YYYY-MM-DD format or year only (omit if unknown)

Only include real, verifiable articles with actual URLs. Return ONLY valid JSON with no markdown fences, no explanation.`,
    });

    // Extract the text output from the response
    const textContent = ((response.output as ResponseOutputItem[]) ?? [])
      .filter((item) => item.type === 'message')
      .flatMap((item) => item.content ?? [])
      .filter((c) => c.type === 'output_text')
      .map((c) => c.text ?? '')
      .join('');

    if (!textContent.trim()) {
      console.log('[Press] Empty response from OpenAI');
      return { articles: [], error: null };
    }

    // Strip markdown fences if the model included them despite instructions
    const jsonStr = textContent
      .replace(/^```(?:json)?\s*/m, '')
      .replace(/\s*```\s*$/m, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      console.error('[Press] Failed to parse JSON response', jsonStr.slice(0, 300));
      return { articles: [], error: null };
    }

    if (!Array.isArray(parsed)) {
      console.error('[Press] Response is not a JSON array');
      return { articles: [], error: null };
    }

    const articles: PressArticleSuggestion[] = (parsed as unknown[])
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

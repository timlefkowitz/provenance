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

/**
 * Parse JSON from an LLM response that may include markdown code fences,
 * leading/trailing prose, or citations. Returns null if no JSON object can
 * be extracted.
 */
function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();

  // Direct parse first (happy path).
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  // Strip ```json ... ``` or ``` ... ``` fences if present.
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  // Fallback: extract the first balanced {...} block.
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // fall through
    }
  }

  return null;
}

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

Respond with ONE JSON object and nothing else. Do not include prose, commentary, citations, or markdown fences. The JSON object must have a single key "articles" whose value is an array of up to 10 items. Each item must have:
- "title": the article headline (string)
- "url": the direct URL to the article, must start with https (string)
- "publication_name": the name of the publication or website (string, optional)
- "date": publication date in YYYY-MM-DD or year only (string, optional, omit if unknown)

Only include real, verifiable articles with actual URLs you found via web search. If you find none, return {"articles": []}.`;

  try {
    console.log('[Press] Calling OpenAI Chat Completions (web search model)', {
      model: PRESS_SEARCH_MODEL,
      name,
      role,
    });
    const openai = new OpenAI({ apiKey });

    // NOTE: gpt-4o-search-preview does NOT support response_format: json_object.
    // We instruct the model to emit pure JSON via the prompt and parse defensively.
    const completion = await openai.chat.completions.create({
      model: PRESS_SEARCH_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are a research assistant that searches the web and returns ONLY a single valid JSON object matching the user instructions. Never include markdown, code fences, prose, or trailing commentary — output must be parseable by JSON.parse.',
        },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      console.log('[Press] Empty completion from OpenAI');
      return { articles: [], error: null };
    }

    const parsed = parseJsonLoose(content);
    if (parsed === null) {
      console.error('[Press] Failed to parse JSON from OpenAI', content.slice(0, 400));
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

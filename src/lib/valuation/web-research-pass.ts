import OpenAI from 'openai';
import { z } from 'zod';

import { logger } from '~/lib/logger';

/** Chat Completions web-search model (same pattern as find-press-articles). */
const WEB_SEARCH_MODEL = 'gpt-4o-search-preview';

const WebResearchArticleSchema = z.object({
  title: z.string(),
  url: z.string(),
  source: z.string().optional().nullable(),
  year: z.string().optional().nullable(),
});

const WebResearchAuctionSchema = z.object({
  description: z.string(),
  price_range: z.string().optional().nullable(),
  house: z.string().optional().nullable(),
  year: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});

const WebResearchMuseumSchema = z.object({
  institution: z.string(),
  context: z.string().optional().nullable(),
  url: z.string().optional().nullable(),
});

const WebResearchResponseSchema = z.object({
  articles: z.array(WebResearchArticleSchema).default([]),
  auction_signals: z.array(WebResearchAuctionSchema).default([]),
  museum_mentions: z.array(WebResearchMuseumSchema).default([]),
  representation: z.array(z.string()).default([]),
  recognition: z.array(z.string()).default([]),
  summary: z.string().optional().nullable(),
});

export type WebResearchArticle = z.infer<typeof WebResearchArticleSchema>;
export type WebResearchAuctionSignal = z.infer<typeof WebResearchAuctionSchema>;
export type WebResearchMuseumMention = z.infer<typeof WebResearchMuseumSchema>;

export interface WebResearchResult {
  articles: WebResearchArticle[];
  auction_signals: WebResearchAuctionSignal[];
  museum_mentions: WebResearchMuseumMention[];
  representation: string[];
  recognition: string[];
  summary: string | null;
  searched_at: string;
  model: string | null;
  error: string | null;
}

export interface WebResearchParams {
  artistName: string | null;
  artworkTitle: string | null;
  medium: string | null;
}

function emptyResult(error: string | null = null): WebResearchResult {
  return {
    articles: [],
    auction_signals: [],
    museum_mentions: [],
    representation: [],
    recognition: [],
    summary: null,
    searched_at: new Date().toISOString(),
    model: null,
    error,
  };
}

/**
 * Parse JSON from an LLM response that may include markdown fences or prose.
 */
function parseJsonLoose(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  return null;
}

function buildSearchPrompt(params: WebResearchParams): string {
  const artist = params.artistName?.trim() || 'Unknown artist';
  const title = params.artworkTitle?.trim() || 'Untitled';
  const medium = params.medium?.trim() ? ` (${params.medium})` : '';

  return `Search the web for art-market and provenance signals about the artist "${artist}" and the artwork "${title}"${medium}.

Find and return ONE JSON object with these keys:
- "articles": up to 8 press articles, interviews, reviews, or news about the artist. Each item: title (string), url (https string), source (publication name, optional), year (string, optional).
- "auction_signals": up to 5 known auction results or price ranges for this artist or similar works. Each item: description (string), price_range (string, optional), house (auction house, optional), year (optional), url (optional https).
- "museum_mentions": up to 5 museum collections or institutional exhibitions involving the artist. Each item: institution (string), context (string, optional), url (optional https).
- "representation": array of gallery names representing the artist (strings, up to 5).
- "recognition": array of awards, biennials, catalogue raisonné, or major career milestones (strings, up to 5).
- "summary": 2-3 sentence market summary based only on what you found.

Only include real, verifiable information with actual URLs where possible. If nothing is found for a category, use an empty array. Return {"articles":[],"auction_signals":[],"museum_mentions":[],"representation":[],"recognition":[],"summary":null} when appropriate.`;
}

/**
 * Run optional web research for provenance valuation. Never throws; returns
 * empty signals when OpenAI is unavailable or search fails.
 */
export async function runWebResearchPass(
  params: WebResearchParams,
): Promise<WebResearchResult> {
  console.log('[Valuation] runWebResearchPass started', {
    artistName: params.artistName,
    artworkTitle: params.artworkTitle,
  });

  const rawKey = process.env.OPENAI_API_KEY;
  const apiKey = typeof rawKey === 'string' ? rawKey.trim() : undefined;

  if (!apiKey) {
    console.log('[Valuation] runWebResearchPass skipped — OPENAI_API_KEY not set');
    return emptyResult('OpenAI API key not configured');
  }

  if (!params.artistName?.trim() && !params.artworkTitle?.trim()) {
    console.log('[Valuation] runWebResearchPass skipped — no artist or title');
    return emptyResult('No artist or artwork title to search');
  }

  try {
    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: WEB_SEARCH_MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You are an art-market research assistant. Search the web and return ONLY a single valid JSON object matching the user instructions. Never include markdown, code fences, or commentary.',
        },
        { role: 'user', content: buildSearchPrompt(params) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content?.trim()) {
      console.log('[Valuation] runWebResearchPass empty response');
      return { ...emptyResult('Empty response from web search'), model: WEB_SEARCH_MODEL };
    }

    const parsed = parseJsonLoose(content);
    if (parsed === null) {
      console.error('[Valuation] runWebResearchPass JSON parse failed', content.slice(0, 400));
      return {
        ...emptyResult('Failed to parse web search response'),
        model: WEB_SEARCH_MODEL,
      };
    }

    const validated = WebResearchResponseSchema.safeParse(parsed);
    if (!validated.success) {
      console.error('[Valuation] runWebResearchPass validation failed', validated.error);
      return {
        ...emptyResult('Web search response failed validation'),
        model: WEB_SEARCH_MODEL,
      };
    }

    const articles = validated.data.articles.filter(
      (article) =>
        article.title.trim().length > 0 && article.url.trim().startsWith('http'),
    );

    const result: WebResearchResult = {
      articles,
      auction_signals: validated.data.auction_signals,
      museum_mentions: validated.data.museum_mentions,
      representation: validated.data.representation,
      recognition: validated.data.recognition,
      summary: validated.data.summary?.trim() || null,
      searched_at: new Date().toISOString(),
      model: WEB_SEARCH_MODEL,
      error: null,
    };

    console.log('[Valuation] runWebResearchPass complete', {
      articles: result.articles.length,
      auctionSignals: result.auction_signals.length,
      museumMentions: result.museum_mentions.length,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Web research failed';
    console.error('[Valuation] runWebResearchPass failed', err);
    logger.error('web_research_pass_failed', {
      artistName: params.artistName,
      artworkTitle: params.artworkTitle,
      error: err,
    });
    return emptyResult(message);
  }
}

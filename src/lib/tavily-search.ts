const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';

export type TavilySearchResult = {
  title: string;
  url: string;
  content: string;
};

type TavilyResponse = {
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
  }>;
};

/**
 * Run a Tavily web search. Requires TAVILY_API_KEY in env.
 */
export async function tavilySearch(
  query: string,
  maxResults: number,
): Promise<{ results: TavilySearchResult[]; error: string | null }> {
  const apiKey = typeof process.env.TAVILY_API_KEY === 'string' ? process.env.TAVILY_API_KEY.trim() : '';
  if (!apiKey) {
    return { results: [], error: 'TAVILY_API_KEY is not configured' };
  }

  const q = query.trim();
  if (!q) {
    return { results: [], error: 'Search query is empty' };
  }

  try {
    console.log('[Press] Tavily search request');
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: q,
        max_results: Math.min(Math.max(maxResults, 1), 15),
        search_depth: 'basic',
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[Press] Tavily search failed', res.status, text);
      return { results: [], error: `Search failed (${res.status})` };
    }

    const data = (await res.json()) as TavilyResponse;
    const results: TavilySearchResult[] = (data.results || [])
      .map((r) => ({
        title: (r.title || '').trim() || 'Untitled',
        url: (r.url || '').trim(),
        content: (r.content || '').trim(),
      }))
      .filter((r) => r.url.length > 0);

    console.log('[Press] Tavily search success', { count: results.length });
    return { results, error: null };
  } catch (err) {
    console.error('[Press] Tavily search error', err);
    return { results: [], error: err instanceof Error ? err.message : 'Search request failed' };
  }
}

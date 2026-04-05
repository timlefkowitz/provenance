'use server';

import type { NewsPublicationInput } from '~/lib/news-publications';

export type PressArticleSuggestion = NewsPublicationInput;

export async function findPressArticles(_profileId: string): Promise<{
  articles: PressArticleSuggestion[];
  error: string | null;
}> {
  console.log('[Press] findPressArticles web search not configured');
  return { articles: [], error: 'Press article discovery is not currently available.' };
}

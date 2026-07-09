import OpenAI from 'openai';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const EMBEDDING_MODEL = 'text-embedding-3-small';

export interface KnowledgeChunk {
  id: string;
  content: string;
  source: string;
  source_title: string | null;
  source_url: string | null;
  similarity: number;
}

/**
 * Embed a query and retrieve the most semantically similar art knowledge chunks
 * from the knowledge_chunks table via pgvector cosine similarity search.
 *
 * Returns an empty array on any failure so callers can degrade gracefully.
 */
export async function retrieveArtKnowledge(
  query: string,
  options: {
    matchCount?: number;
    matchThreshold?: number;
    filterSource?: 'wikipedia' | 'book' | 'custom' | 'grant_description' | null;
  } = {},
): Promise<KnowledgeChunk[]> {
  const { matchCount = 6, matchThreshold = 0.65, filterSource = null } = options;

  console.log('[ArtKnowledge] retrieveArtKnowledge query:', query.slice(0, 80));

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[ArtKnowledge] OPENAI_API_KEY not set, skipping retrieval');
    return [];
  }

  const openai = new OpenAI({ apiKey });

  let embedding: number[];
  try {
    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: query.slice(0, 8192),
    });
    embedding = embeddingResponse.data[0]?.embedding ?? [];
    if (!embedding.length) throw new Error('Empty embedding returned');
  } catch (err) {
    console.error('[ArtKnowledge] embedding failed', err);
    return [];
  }

  const client = getSupabaseServerClient();

  const { data, error } = await client.rpc('match_knowledge_chunks', {
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: matchThreshold,
    filter_source: filterSource,
  });

  if (error) {
    console.error('[ArtKnowledge] pgvector search failed', error);
    return [];
  }

  const chunks = (data ?? []) as KnowledgeChunk[];
  console.log('[ArtKnowledge] retrieved', chunks.length, 'chunks');
  return chunks;
}

/**
 * Format knowledge chunks into a concise context block suitable for injection
 * into a system prompt or tool result.
 */
export function formatChunksAsContext(chunks: KnowledgeChunk[]): string {
  if (!chunks.length) return '';
  return chunks
    .map((c, i) => {
      const source = c.source_title ? `${c.source_title} (${c.source})` : c.source;
      return `[${i + 1}] ${source}\n${c.content.trim()}`;
    })
    .join('\n\n---\n\n');
}

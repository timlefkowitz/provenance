/**
 * Art knowledge ingestion script
 *
 * Fetches art-related Wikipedia articles and/or ingests local PDF/text files,
 * splits them into chunks, embeds them with OpenAI, and upserts into the
 * knowledge_chunks table via pgvector.
 *
 * Usage:
 *   pnpm with-env tsx scripts/ingest-art-knowledge.ts --source wikipedia
 *   pnpm with-env tsx scripts/ingest-art-knowledge.ts --source pdf --file /path/to/book.pdf
 *   pnpm with-env tsx scripts/ingest-art-knowledge.ts --source wikipedia --category "Impressionism"
 *
 * Environment variables required:
 *   OPENAI_API_KEY
 *   SUPABASE_SERVICE_ROLE_KEY  (needed to bypass RLS for inserts)
 *   NEXT_PUBLIC_SUPABASE_URL
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { readFileSync } from 'fs';

// ─── Config ──────────────────────────────────────────────────────────────────

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHUNK_SIZE = 500;     // target tokens per chunk (approx 4 chars = 1 token)
const CHUNK_OVERLAP = 50;   // overlap tokens between chunks
const BATCH_SIZE = 20;      // embeddings per API call (max 2048)

// Curated list of Wikipedia art topics to ingest by default
const WIKIPEDIA_ART_TOPICS = [
  // Movements
  'Impressionism',
  'Post-Impressionism',
  'Abstract expressionism',
  'Cubism',
  'Surrealism',
  'Minimalism',
  'Conceptual art',
  'Pop art',
  'Fauvism',
  'Expressionism',
  'Baroque',
  'Renaissance',
  'Romanticism',
  'Realism (arts)',
  'Modernism',
  'Contemporary art',
  'Arte Povera',
  'Fluxus',
  'Performance art',
  'Land art',
  'Street art',

  // Techniques & media
  'Oil painting',
  'Watercolor painting',
  'Printmaking',
  'Sculpture',
  'Photography',
  'Installation art',
  'Video art',
  'Drawing',
  'Etching',
  'Screen printing',
  'Lithography',
  'Encaustic painting',

  // Notable artists (career overviews give rich context)
  'Pablo Picasso',
  'Frida Kahlo',
  'Georgia O\'Keeffe',
  'Jean-Michel Basquiat',
  'Yayoi Kusama',
  'Cindy Sherman',
  'Kara Walker',
  'Kerry James Marshall',
  'Kehinde Wiley',
  'Jeff Koons',
  'Damien Hirst',
  'Banksy',
  'Marina Abramović',
  'Louise Bourgeois',
  'Agnes Martin',
  'Mark Rothko',
  'Jackson Pollock',

  // Art world infrastructure
  'Art residency',
  'Artist grant',
  'National Endowment for the Arts',
  'Guggenheim Fellowship',
  'MacArthur Fellows Program',
  'Artist-in-residence',
  'Gallery (art)',
  'Art museum',
  'Art fair',
  'Biennale',
  'Whitney Biennial',
  'Venice Biennale',
  'Art criticism',
  'Artist statement',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chunkText(text: string, chunkTokens = CHUNK_SIZE, overlapTokens = CHUNK_OVERLAP): string[] {
  // Rough token approximation: 1 token ≈ 4 chars
  const chunkChars = chunkTokens * 4;
  const overlapChars = overlapTokens * 4;

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkChars, text.length);
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 100) chunks.push(chunk); // skip tiny trailing fragments
    start += chunkChars - overlapChars;
  }

  return chunks;
}

async function embedBatch(openai: OpenAI, texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
  });
  return response.data.map((d) => d.embedding);
}

// ─── Wikipedia ingestion ──────────────────────────────────────────────────────

interface WikipediaSummary {
  title: string;
  extract: string;
  content_urls?: { desktop?: { page?: string } };
}

async function fetchWikipediaArticle(title: string): Promise<WikipediaSummary | null> {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Provenance-Art-Knowledge-Bot/1.0 (contact@provenance.app)' },
  });

  if (!res.ok) {
    console.warn(`[Ingest] Wikipedia fetch failed for "${title}": ${res.status}`);
    return null;
  }

  return res.json() as Promise<WikipediaSummary>;
}

async function fetchWikipediaFullText(title: string): Promise<string | null> {
  // Use the action API to get wikitext, then strip to plain text
  const url = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=extracts&explaintext=true&format=json&origin=*`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Provenance-Art-Knowledge-Bot/1.0 (contact@provenance.app)' },
  });

  if (!res.ok) return null;

  const json = (await res.json()) as {
    query: { pages: Record<string, { extract?: string }> };
  };
  const pages = Object.values(json.query?.pages ?? {});
  return pages[0]?.extract ?? null;
}

async function ingestWikipedia(
  topics: string[],
  openai: OpenAI,
  supabase: ReturnType<typeof createClient>,
) {
  console.log(`[Ingest] Wikipedia: ingesting ${topics.length} topics`);

  for (const topic of topics) {
    console.log(`[Ingest] Wikipedia: fetching "${topic}"`);

    const fullText = await fetchWikipediaFullText(topic);
    const summary = await fetchWikipediaArticle(topic);

    if (!fullText && !summary) {
      console.warn(`[Ingest] skipping "${topic}" — no content`);
      continue;
    }

    const text = fullText ?? summary?.extract ?? '';
    const articleUrl = summary?.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`;
    const actualTitle = summary?.title ?? topic;

    const rawChunks = chunkText(text);
    console.log(`[Ingest]   → ${rawChunks.length} chunks from "${actualTitle}"`);

    // Process in embedding batches
    for (let batchStart = 0; batchStart < rawChunks.length; batchStart += BATCH_SIZE) {
      const batchChunks = rawChunks.slice(batchStart, batchStart + BATCH_SIZE);
      let embeddings: number[][];

      try {
        embeddings = await embedBatch(openai, batchChunks);
      } catch (err) {
        console.error(`[Ingest] embedding failed for "${actualTitle}" batch ${batchStart}`, err);
        continue;
      }

      const rows = batchChunks.map((content, i) => ({
        content,
        embedding: `[${embeddings[i]!.join(',')}]`,
        source: 'wikipedia',
        source_title: actualTitle,
        source_url: articleUrl,
        metadata: { topic },
      }));

      const { error } = await supabase.from('knowledge_chunks').insert(rows);
      if (error) {
        console.error(`[Ingest] insert failed for "${actualTitle}" batch ${batchStart}`, error);
      } else {
        console.log(`[Ingest]   inserted batch ${batchStart}–${batchStart + batchChunks.length - 1}`);
      }

      // Be polite to the Wikipedia API
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ─── PDF / text file ingestion ────────────────────────────────────────────────

async function ingestFile(
  filePath: string,
  title: string,
  openai: OpenAI,
  supabase: ReturnType<typeof createClient>,
) {
  console.log(`[Ingest] File: "${filePath}" as "${title}"`);

  let text: string;

  if (filePath.endsWith('.pdf')) {
    // Dynamic import to avoid bundling pdf-parse in production
    const pdfParse = (await import('pdf-parse')).default;
    const buffer = readFileSync(filePath);
    const data = await pdfParse(buffer);
    text = data.text;
  } else {
    text = readFileSync(filePath, 'utf-8');
  }

  const rawChunks = chunkText(text);
  console.log(`[Ingest]   → ${rawChunks.length} chunks from "${title}"`);

  for (let batchStart = 0; batchStart < rawChunks.length; batchStart += BATCH_SIZE) {
    const batchChunks = rawChunks.slice(batchStart, batchStart + BATCH_SIZE);
    let embeddings: number[][];

    try {
      embeddings = await embedBatch(openai, batchChunks);
    } catch (err) {
      console.error(`[Ingest] embedding failed for "${title}" batch ${batchStart}`, err);
      continue;
    }

    const rows = batchChunks.map((content, i) => ({
      content,
      embedding: `[${embeddings[i]!.join(',')}]`,
      source: 'book',
      source_title: title,
      source_url: null,
      metadata: { file: filePath },
    }));

    const { error } = await supabase.from('knowledge_chunks').insert(rows);
    if (error) {
      console.error(`[Ingest] insert failed for "${title}" batch ${batchStart}`, error);
    } else {
      console.log(`[Ingest]   inserted batch ${batchStart}–${batchStart + batchChunks.length - 1}`);
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const sourceIdx = args.indexOf('--source');
  const fileIdx = args.indexOf('--file');
  const titleIdx = args.indexOf('--title');
  const categoryIdx = args.indexOf('--category');

  const source = sourceIdx !== -1 ? args[sourceIdx + 1] : 'wikipedia';
  const file = fileIdx !== -1 ? args[fileIdx + 1] : null;
  const title = titleIdx !== -1 ? args[titleIdx + 1] : file ?? 'Untitled';
  const category = categoryIdx !== -1 ? args[categoryIdx + 1] : null;

  const openaiKey = process.env.OPENAI_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!openaiKey) throw new Error('OPENAI_API_KEY is required');
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
  if (!supabaseServiceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');

  const openai = new OpenAI({ apiKey: openaiKey });
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  if (source === 'wikipedia') {
    // If a specific --category is provided, only ingest that one topic
    const topics = category ? [category] : WIKIPEDIA_ART_TOPICS;
    await ingestWikipedia(topics, openai, supabase);
  } else if (source === 'pdf' || source === 'text') {
    if (!file) throw new Error('--file <path> is required for pdf/text source');
    await ingestFile(file, title as string, openai, supabase);
  } else {
    throw new Error(`Unknown --source "${source}". Use: wikipedia | pdf | text`);
  }

  console.log('[Ingest] Done.');
}

main().catch((err) => {
  console.error('[Ingest] Fatal error', err);
  process.exit(1);
});

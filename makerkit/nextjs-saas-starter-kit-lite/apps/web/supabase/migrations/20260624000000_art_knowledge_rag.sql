-- Art knowledge RAG: enable pgvector and create knowledge_chunks table
-- This powers the art-based LLM context retrieval system (RAG).
-- Chunks from art history books, Wikipedia articles, etc. are embedded and stored here.

-- Enable the pgvector extension (safe to run if already enabled)
create extension if not exists vector;

-- ─── knowledge_chunks ────────────────────────────────────────────────────────

create table if not exists public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),

  -- The raw text passage (typically 200–600 tokens)
  content text not null,

  -- OpenAI text-embedding-3-small produces 1536-dimensional vectors
  embedding vector(1536),

  -- Where this chunk came from: 'wikipedia', 'book', 'custom', 'grant_description'
  source text not null default 'custom',

  -- Human-readable title (Wikipedia article name, book title, etc.)
  source_title text,

  -- Original URL if available (Wikipedia permalink, publisher page, etc.)
  source_url text,

  -- Additional metadata (e.g. author, publication year, chapter, art movement)
  metadata jsonb not null default '{}',

  created_at timestamptz not null default now()
);

-- IVFFlat index for fast approximate nearest-neighbour search.
-- Rebuild with a larger list count once the table grows beyond ~100k rows.
create index if not exists knowledge_chunks_embedding_idx
  on public.knowledge_chunks
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- GiST index on source for filtered similarity searches
create index if not exists knowledge_chunks_source_idx
  on public.knowledge_chunks (source);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table public.knowledge_chunks enable row level security;

-- All authenticated users can read knowledge chunks (they are public reference data)
create policy "Authenticated users can read knowledge chunks"
  on public.knowledge_chunks
  for select
  to authenticated
  using (true);

-- Only service role can insert/update/delete (ingestion scripts use service key)
-- No insert/update/delete policy = blocked for non-service roles by default.

-- ─── match_knowledge_chunks() RPC ────────────────────────────────────────────

create or replace function public.match_knowledge_chunks(
  query_embedding vector(1536),
  match_count     int     default 5,
  match_threshold float   default 0.65,
  filter_source   text    default null   -- pass 'wikipedia', 'book', etc. to narrow results
)
returns table (
  id           uuid,
  content      text,
  source       text,
  source_title text,
  source_url   text,
  similarity   float
)
language plpgsql
stable
as $$
begin
  return query
  select
    kc.id,
    kc.content,
    kc.source,
    kc.source_title,
    kc.source_url,
    1 - (kc.embedding <=> query_embedding) as similarity
  from public.knowledge_chunks kc
  where
    kc.embedding is not null
    and (filter_source is null or kc.source = filter_source)
    and 1 - (kc.embedding <=> query_embedding) > match_threshold
  order by kc.embedding <=> query_embedding
  limit match_count;
end;
$$;

-- Grant execute to authenticated users so client-side Supabase can call it
grant execute on function public.match_knowledge_chunks(vector, int, float, text)
  to authenticated;

/*
 * Reverse image lookup ("Find by photo").
 *
 * One DINOv2-small image embedding (384-dim, L2-normalised) per artwork, computed server-side
 * whenever an artwork image is set (src/lib/image-fingerprint) and by
 * scripts/backfill-artwork-fingerprints.ts.
 *
 * Kept in its own table rather than a column on artworks so `select('*')` on artworks never
 * drags a 384-float vector along, and so source_image_url can flag stale rows after an
 * image edit.
 *
 * Visibility: the select policy only exposes an embedding when the caller can see the artwork
 * itself (the EXISTS runs under the caller's artworks RLS), and match_artworks_by_image is
 * SECURITY INVOKER, so private/draft works only match for their owners. Writes are
 * service-role only.
 *
 * No ANN index on purpose: at our scale (<10k rows) an exact scan takes milliseconds and,
 * unlike HNSW, stays exact when RLS / exhibition filters remove most rows.
 */

create extension if not exists vector;

create table if not exists public.artwork_image_embeddings (
  artwork_id uuid primary key references public.artworks(id) on delete cascade,
  embedding vector(384) not null,
  model text not null,
  source_image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.artwork_image_embeddings is
  'DINOv2 image embedding per artwork for reverse image lookup. Written by the service role only.';
comment on column public.artwork_image_embeddings.model is
  'Model + preprocessing version (IMAGE_EMBEDDING_MODEL); rows with an older value get recomputed by the backfill.';
comment on column public.artwork_image_embeddings.source_image_url is
  'artworks.image_url the embedding was computed from; a mismatch means the image changed and the row is stale.';

alter table public.artwork_image_embeddings enable row level security;

revoke all on public.artwork_image_embeddings from anon, authenticated;
grant select on public.artwork_image_embeddings to anon, authenticated;
grant all on public.artwork_image_embeddings to service_role;

drop policy if exists artwork_image_embeddings_select_visible on public.artwork_image_embeddings;
create policy artwork_image_embeddings_select_visible on public.artwork_image_embeddings
  for select to anon, authenticated
  using (exists (select 1 from public.artworks a where a.id = artwork_image_embeddings.artwork_id));

create or replace function public.match_artworks_by_image(
  query_embedding vector(384),
  match_count int default 12,
  filter_exhibition_id uuid default null
)
returns table (artwork_id uuid, similarity float)
language sql
stable
security invoker
set search_path = public
as $$
  select e.artwork_id, 1 - (e.embedding <=> query_embedding) as similarity
  from public.artwork_image_embeddings e
  where filter_exhibition_id is null
     or exists (
       select 1 from public.exhibition_artworks ea
       where ea.artwork_id = e.artwork_id and ea.exhibition_id = filter_exhibition_id
     )
  order by e.embedding <=> query_embedding
  limit least(greatest(coalesce(match_count, 12), 1), 50);
$$;

revoke all on function public.match_artworks_by_image(vector, int, uuid) from public;
grant execute on function public.match_artworks_by_image(vector, int, uuid) to anon, authenticated, service_role;

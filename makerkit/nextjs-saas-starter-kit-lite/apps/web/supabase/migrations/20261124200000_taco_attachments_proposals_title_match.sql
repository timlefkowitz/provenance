-- Taco the cat: files dropped into the chat, confirm-before-write proposals,
-- and fuzzy title matching ("is this already on Provenance?").

-- ---------------------------------------------------------------------------
-- Staged attachments: files a user dropped into Taco, stored in the artworks
-- bucket under {user_id}/taco-staging/. Written by the service role only.
-- ---------------------------------------------------------------------------
create table if not exists public.taco_attachments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  kind text not null check (kind in ('image', 'document')),
  mime text not null,
  name text not null,
  size_bytes integer,
  extracted_text text,
  created_at timestamptz not null default now()
);

create index if not exists taco_attachments_user_created_idx
  on public.taco_attachments (user_id, created_at desc);

alter table public.taco_attachments enable row level security;

revoke all on public.taco_attachments from anon, authenticated;
grant select on public.taco_attachments to authenticated;
grant all on public.taco_attachments to service_role;

drop policy if exists taco_attachments_select_own on public.taco_attachments;
create policy taco_attachments_select_own on public.taco_attachments
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Proposals: changes Taco suggests. Nothing is written to artworks until the
-- user applies one. Written by the service role only, so a client can't
-- forge or edit a payload; applying re-checks permission server-side.
-- ---------------------------------------------------------------------------
create table if not exists public.taco_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null,
  payload jsonb not null,
  preview jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'applied', 'partial', 'skipped', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists taco_proposals_user_created_idx
  on public.taco_proposals (user_id, created_at desc);

alter table public.taco_proposals enable row level security;

revoke all on public.taco_proposals from anon, authenticated;
grant select on public.taco_proposals to authenticated;
grant all on public.taco_proposals to service_role;

drop policy if exists taco_proposals_select_own on public.taco_proposals;
create policy taco_proposals_select_own on public.taco_proposals
  for select to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Fuzzy title / artist matching.
-- ---------------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;

create index if not exists artworks_title_trgm_idx
  on public.artworks using gin (lower(title) extensions.gin_trgm_ops);

create index if not exists artworks_artist_name_trgm_idx
  on public.artworks using gin (lower(artist_name) extensions.gin_trgm_ops);

-- security invoker: artworks RLS decides what the caller can see, same as
-- match_artworks_by_image.
create or replace function public.match_artworks_by_title(
  q_title text,
  q_artist text default null,
  match_count int default 10
)
returns table (
  artwork_id uuid,
  title text,
  artist_name text,
  creation_date date,
  image_url text,
  account_id uuid,
  gallery_profile_id uuid,
  is_public boolean,
  status text,
  certificate_type text,
  title_sim real,
  artist_sim real,
  score real
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select lower(trim(coalesce(q_title, ''))) as t,
           nullif(lower(trim(coalesce(q_artist, ''))), '') as a
  )
  select a.id,
         a.title::text,
         a.artist_name::text,
         a.creation_date,
         a.image_url,
         a.account_id,
         a.gallery_profile_id,
         a.is_public,
         a.status::text,
         a.certificate_type::text,
         similarity(lower(a.title), q.t) as title_sim,
         case when q.a is null or a.artist_name is null then null
              else similarity(lower(a.artist_name), q.a) end as artist_sim,
         (similarity(lower(a.title), q.t)
           + case when q.a is null or a.artist_name is null then 0
                  else 0.5 * similarity(lower(a.artist_name), q.a) end)::real as score
  from public.artworks a, q
  where length(q.t) >= 2
    and coalesce(a.status::text, '') <> 'voided'
    and (lower(a.title) % q.t or lower(a.title) like '%' || q.t || '%')
  order by score desc
  limit least(greatest(coalesce(match_count, 10), 1), 50);
$$;

revoke all on function public.match_artworks_by_title(text, text, int) from public;
grant execute on function public.match_artworks_by_title(text, text, int) to authenticated, service_role;

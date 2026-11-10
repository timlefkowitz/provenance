/*
 * -------------------------------------------------------
 * Curator-edited artist details for exhibitions
 *
 * 1. user_profiles gains an artist statement and museum "tombstone" details
 *    (birth year/place, nationality, death year).
 * 2. exhibition_artist_details: the curator's copy of an artist's bio,
 *    statement, photo, CV entries and press for one show. Used by wall
 *    labels, the catalog and the public Artists tab. artist_key matches the
 *    keys built in exhibitions/_helpers/artist-bios.ts
 *    ('profile:<id>' | 'account:<id>' | 'name:<lowercased name>').
 * 3. artist_research_findings: sourced facts found on the web by
 *    "Find information" (articles, exhibitions, sales, awards...). Private to
 *    the show's managers (service role only) until accepted.
 * 4. artist_profile_suggestions: changes a curator sends to an artist to
 *    accept into their own profile (like provenance_update_requests).
 *
 * Additive only (see MIGRATIONS.md).
 * -------------------------------------------------------
 */

-- 1. Profile fields --------------------------------------------------------
alter table public.user_profiles
  add column if not exists artist_statement text,
  add column if not exists birth_year int,
  add column if not exists birth_place text,
  add column if not exists nationality text,
  add column if not exists death_year int;

comment on column public.user_profiles.artist_statement is 'Artist statement (artists only).';
comment on column public.user_profiles.birth_year is 'Year of birth, for museum-style labels ("b. 1984").';

-- 2. Show copy ---------------------------------------------------------------
create table if not exists public.exhibition_artist_details (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  artist_key text not null,
  artist_profile_id uuid references public.user_profiles(id) on delete set null,
  artist_account_id uuid,
  display_name text,
  bio text,
  artist_statement text,
  picture_url text,
  birth_year int,
  birth_place text,
  nationality text,
  death_year int,
  website text,
  cv_entries jsonb not null default '[]'::jsonb,
  press jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (exhibition_id, artist_key)
);

create index if not exists exhibition_artist_details_exhibition_idx
  on public.exhibition_artist_details (exhibition_id);

alter table public.exhibition_artist_details enable row level security;

-- Anyone may read the show copy of a published show. Writes go through
-- server actions (service role) after canManageExhibition.
drop policy if exists exhibition_artist_details_read_published on public.exhibition_artist_details;
create policy exhibition_artist_details_read_published on public.exhibition_artist_details
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.exhibitions e
      where e.id = exhibition_artist_details.exhibition_id
        and e.published_at is not null
    )
  );

-- 3. Research findings -------------------------------------------------------
create table if not exists public.artist_research_findings (
  id uuid primary key default gen_random_uuid(),
  exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
  artist_key text not null,
  artist_profile_id uuid references public.user_profiles(id) on delete set null,
  kind text not null check (kind in ('bio_fact', 'article', 'exhibition', 'sale', 'award', 'collection')),
  payload jsonb not null default '{}'::jsonb,
  source_url text not null,
  source_title text,
  status text not null default 'suggested' check (status in ('suggested', 'accepted', 'dismissed')),
  model text,
  requested_by uuid references auth.users(id) on delete set null,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_research_findings_artist_idx
  on public.artist_research_findings (exhibition_id, artist_key);
create index if not exists artist_research_findings_profile_idx
  on public.artist_research_findings (artist_profile_id);

-- Service role only: no policies.
alter table public.artist_research_findings enable row level security;

-- 4. Suggestions to the artist -----------------------------------------------
create table if not exists public.artist_profile_suggestions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  exhibition_id uuid references public.exhibitions(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  update_fields jsonb not null default '{}'::jsonb,
  source_finding_ids uuid[] not null default '{}',
  message text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'partially_approved', 'denied')),
  reviewed_at timestamptz,
  review_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists artist_profile_suggestions_profile_idx
  on public.artist_profile_suggestions (profile_id, status);

alter table public.artist_profile_suggestions enable row level security;

drop policy if exists artist_profile_suggestions_read_artist on public.artist_profile_suggestions;
create policy artist_profile_suggestions_read_artist on public.artist_profile_suggestions
  for select
  to authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = artist_profile_suggestions.profile_id
        and p.user_id = auth.uid()
    )
  );

drop policy if exists artist_profile_suggestions_read_requester on public.artist_profile_suggestions;
create policy artist_profile_suggestions_read_requester on public.artist_profile_suggestions
  for select
  to authenticated
  using (requested_by = auth.uid());
-- Responding goes through a server action (service role) after checking the
-- caller owns the profile, so no update policy is needed.

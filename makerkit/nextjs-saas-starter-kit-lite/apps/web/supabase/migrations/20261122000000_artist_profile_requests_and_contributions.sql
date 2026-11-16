/*
 * -------------------------------------------------------
 * Artist profile update requests and contributions
 *
 * 1. artist_profile_update_requests: a signed-in user (gallery, collector,
 *    curator) asks an artist with an account to add or update parts of their
 *    profile: CV, artist statement, exhibition history, bio, header image.
 *    Requests target the artist's account (many artist accounts have no
 *    user_profiles row yet); profile_id is set when the page showed one.
 *    The artist marks each request done or dismisses it. One open request per
 *    requester per artist; sending again refreshes it.
 *
 * 2. artist_profile_contributions: edits signed-in users make directly to an
 *    unclaimed artist profile (a user_profiles row with role 'artist' and no
 *    user_id). One row per change, with the value before and after, so the
 *    profile can credit contributors and an edit can be traced or undone.
 *    The content itself lives on user_profiles, so it carries over when the
 *    artist claims the profile. When a claim merges a duplicate profile into
 *    the artist's existing one, its rows are re-pointed to that profile.
 *
 * Writes to both tables go through server actions with the service role,
 * after the action has checked who may write (same as
 * artist_profile_suggestions), so there are no insert/update policies.
 *
 * Additive only (see MIGRATIONS.md).
 * -------------------------------------------------------
 */

-- 1. Requests ---------------------------------------------------------------
create table if not exists public.artist_profile_update_requests (
  id uuid primary key default gen_random_uuid(),
  artist_account_id uuid not null references auth.users(id) on delete cascade,
  profile_id uuid references public.user_profiles(id) on delete set null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  requested_fields text[] not null
    check (
      cardinality(requested_fields) > 0
      and requested_fields <@ array['cv', 'artist_statement', 'exhibitions', 'bio', 'header_image']::text[]
    ),
  message text check (message is null or char_length(message) <= 2000),
  status text not null default 'pending'
    check (status in ('pending', 'fulfilled', 'dismissed')),
  responded_at timestamptz,
  response_message text check (response_message is null or char_length(response_message) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requested_by <> artist_account_id)
);

create index if not exists artist_profile_update_requests_artist_idx
  on public.artist_profile_update_requests (artist_account_id, status);
create index if not exists artist_profile_update_requests_requester_idx
  on public.artist_profile_update_requests (requested_by, created_at desc);
create unique index if not exists artist_profile_update_requests_one_open
  on public.artist_profile_update_requests (artist_account_id, requested_by)
  where status = 'pending';

alter table public.artist_profile_update_requests enable row level security;

drop policy if exists artist_profile_update_requests_read_artist on public.artist_profile_update_requests;
create policy artist_profile_update_requests_read_artist on public.artist_profile_update_requests
  for select
  to authenticated
  using (artist_account_id = auth.uid());

drop policy if exists artist_profile_update_requests_read_requester on public.artist_profile_update_requests;
create policy artist_profile_update_requests_read_requester on public.artist_profile_update_requests
  for select
  to authenticated
  using (requested_by = auth.uid());

-- 2. Contributions ----------------------------------------------------------
create table if not exists public.artist_profile_contributions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.user_profiles(id) on delete cascade,
  contributed_by uuid references auth.users(id) on delete set null,
  field text not null
    check (field in ('bio', 'artist_statement', 'header_image_url', 'cv', 'exhibitions')),
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists artist_profile_contributions_profile_idx
  on public.artist_profile_contributions (profile_id, created_at desc);
create index if not exists artist_profile_contributions_contributor_idx
  on public.artist_profile_contributions (contributed_by);

alter table public.artist_profile_contributions enable row level security;

-- The profile page credits contributors, so anyone may read the log of an
-- active artist profile, as they can read the profile itself.
drop policy if exists artist_profile_contributions_read_public on public.artist_profile_contributions;
create policy artist_profile_contributions_read_public on public.artist_profile_contributions
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.user_profiles p
      where p.id = artist_profile_contributions.profile_id
        and p.role = 'artist'
        and p.is_active = true
    )
  );

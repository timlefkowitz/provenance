-- Link artworks to artist user_profiles (claimed or unclaimed) for public profile URLs and aggregating works.

alter table public.artworks
  add column if not exists artist_profile_id uuid references public.user_profiles(id) on delete set null;

comment on column public.artworks.artist_profile_id is 'Artist user_profiles row for this work (unclaimed placeholder or claimed). Used for /artists/{id} when the poster is not the artist.';

create index if not exists artworks_artist_profile_id_idx on public.artworks(artist_profile_id);

-- Optional backfill (run manually if needed): attach profile rows that already exist by artist name
-- update public.artworks a
-- set artist_profile_id = p.id
-- from public.user_profiles p
-- where a.artist_profile_id is null
--   and p.role = 'artist'
--   and p.is_active = true
--   and trim(a.artist_name) = trim(p.name);

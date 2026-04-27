/*
 * -------------------------------------------------------
 * Add registry_artwork_id to user_profiles
 *
 * Artists and galleries can pin a specific artwork (which must be a
 * verified, public Certificate of Authenticity) as their preview
 * thumbnail on the /registry directory page.
 *
 * The FK uses ON DELETE SET NULL so that deleting an artwork
 * automatically clears the selection without orphaning the profile.
 * -------------------------------------------------------
 */

alter table public.user_profiles
  add column if not exists registry_artwork_id uuid
    references public.artworks(id) on delete set null;

create index if not exists user_profiles_registry_artwork_id_idx
  on public.user_profiles(registry_artwork_id);

comment on column public.user_profiles.registry_artwork_id is
  'The artwork chosen by this artist/gallery profile as their /registry preview thumbnail. Must be a verified, public, certificate_type=authenticity artwork owned or credited to this profile.';

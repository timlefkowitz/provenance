/*
 * -------------------------------------------------------
 * Gallery directory: up to 5 registry artwork thumbnails on /registry
 *
 * Galleries may pin an ordered list of verified public COS / COO / COA
 * artworks. registry_artwork_id remains the primary (first) pick for
 * backward compatibility with code that reads a single FK.
 * -------------------------------------------------------
 */

alter table public.user_profiles
  add column if not exists registry_artwork_ids uuid[];

alter table public.user_profiles
  drop constraint if exists user_profiles_registry_artwork_ids_max5;

alter table public.user_profiles
  add constraint user_profiles_registry_artwork_ids_max5
  check (
    registry_artwork_ids is null
    or cardinality(registry_artwork_ids) <= 5
  );

comment on column public.user_profiles.registry_artwork_ids is
  'Ordered list (max 5) of artworks pinned by a gallery for /registry directory thumbnails. COA/COS/COO tied to this profile; verified and public. First id mirrors registry_artwork_id.';

-- Backfill from legacy single-column pick for gallery profiles only.
-- Only touches the new column; does not modify registry_artwork_id or any other field.
-- Restrict to registry_artwork_ids IS NULL so we never overwrite an existing array
-- (including re-runs of this migration after users have saved multi-picks).
update public.user_profiles
set registry_artwork_ids = array[registry_artwork_id]
where role = 'gallery'
  and registry_artwork_id is not null
  and registry_artwork_ids is null;

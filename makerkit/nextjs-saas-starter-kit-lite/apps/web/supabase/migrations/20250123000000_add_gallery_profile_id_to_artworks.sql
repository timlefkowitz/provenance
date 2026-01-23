/*
 * -------------------------------------------------------
 * Add Gallery Profile ID to Artworks
 * Allows artworks to be associated with a specific gallery profile
 * when posted by a user with multiple gallery profiles
 * -------------------------------------------------------
 */

-- Add gallery_profile_id column to artworks table
alter table public.artworks
  add column if not exists gallery_profile_id uuid references public.user_profiles(id) on delete set null;

comment on column public.artworks.gallery_profile_id is 'The gallery profile (user_profiles) that posted this artwork. Only set when posted by a gallery.';

-- Create index for faster queries
create index if not exists artworks_gallery_profile_id_idx on public.artworks(gallery_profile_id);


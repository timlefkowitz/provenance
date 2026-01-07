/*
 * -------------------------------------------------------
 * Add Privacy Field to Artworks Table
 * Adds is_public field to control artwork visibility
 * -------------------------------------------------------
 */

-- Add is_public column (default true for existing artworks)
alter table public.artworks
    add column if not exists is_public boolean default true not null;

comment on column public.artworks.is_public is 'Whether the artwork is visible to the public (true) or private (false)';

-- Set all existing artworks to public
update public.artworks
set is_public = true
where is_public is null;

-- Create index for faster queries
create index if not exists artworks_is_public_idx on public.artworks(is_public);

-- Update RLS policies to respect privacy settings
-- Drop the old public read policy
drop policy if exists artworks_read_public on public.artworks;

-- New policy: Public can only read verified AND public artworks
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Users can always read their own artworks (regardless of privacy setting)
-- The existing artworks_read_own policy already handles this


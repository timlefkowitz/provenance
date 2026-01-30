-- Fix Artworks Public Read Policy
-- Restores public read access to verified artworks
-- SAFE: Only changes permissions, does NOT modify or delete any data

drop policy if exists artworks_read_public on public.artworks;

create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

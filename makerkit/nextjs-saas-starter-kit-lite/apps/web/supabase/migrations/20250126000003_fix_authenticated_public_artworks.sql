-- Comprehensive fix for artworks visibility
-- Ensures both authenticated and anonymous users can see public verified artworks
-- SAFE: Only changes permissions, does NOT modify or delete any data

-- Drop and recreate public policy to ensure it works for both anon and authenticated
drop policy if exists artworks_read_public on public.artworks;

create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Ensure own policy allows users to see their own artworks (regardless of privacy)
-- This policy is for authenticated users only
drop policy if exists artworks_read_own on public.artworks;

create policy artworks_read_own on public.artworks
    for select
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Complete fix for artworks visibility
-- Run this in Supabase SQL Editor
-- SAFE: Only changes permissions, does NOT modify or delete any data

-- Step 1: Drop existing policies
drop policy if exists artworks_read_public on public.artworks;
drop policy if exists artworks_read_own on public.artworks;

-- Step 2: Create public read policy (for both anonymous and authenticated users)
-- This allows anyone to see verified, public artworks
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Step 3: Create own read policy (for authenticated users only)
-- This allows users to see their own artworks (regardless of privacy)
-- and artworks from galleries they're members of
create policy artworks_read_own on public.artworks
    for select
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Step 4: Verify policies were created
SELECT 
    policyname,
    cmd,
    roles,
    qual
FROM pg_policies 
WHERE tablename = 'artworks' 
AND policyname IN ('artworks_read_public', 'artworks_read_own')
ORDER BY policyname;

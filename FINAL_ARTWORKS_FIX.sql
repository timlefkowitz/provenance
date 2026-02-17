-- FINAL FIX for artworks visibility
-- This ensures everything works correctly
-- SAFE: Only changes permissions, does NOT modify or delete any data

-- Step 1: Ensure the helper function exists (required for gallery members feature)
CREATE OR REPLACE FUNCTION is_gallery_member_for_artwork(artwork_account_id uuid, artwork_gallery_profile_id uuid)
RETURNS boolean AS $$
BEGIN
    -- If artwork has a gallery_profile_id, check membership for that profile
    IF artwork_gallery_profile_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.gallery_members gm
            WHERE gm.gallery_profile_id = artwork_gallery_profile_id
            AND gm.user_id = (SELECT auth.uid())
        );
    END IF;
    
    -- Otherwise, check if user owns the account or is a member of any gallery profile owned by that account
    RETURN artwork_account_id = (SELECT auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.gallery_members gm
            JOIN public.user_profiles up ON gm.gallery_profile_id = up.id
            WHERE up.user_id = artwork_account_id
            AND up.role = 'gallery'
            AND gm.user_id = (SELECT auth.uid())
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Drop ALL existing read policies
DROP POLICY IF EXISTS artworks_read_public ON public.artworks;
DROP POLICY IF EXISTS artworks_read_own ON public.artworks;
DROP POLICY IF EXISTS artworks_read_verified ON public.artworks;

-- Step 3: Create public read policy (for anonymous AND authenticated users)
-- This is the most important policy - it allows anyone to see verified + public artworks
CREATE POLICY artworks_read_public ON public.artworks
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'verified' 
        AND is_public = true
    );

-- Step 4: Create own read policy (for authenticated users only)
-- This allows users to see their own artworks (even if private)
-- AND artworks from galleries they're members of
CREATE POLICY artworks_read_own ON public.artworks
    FOR SELECT
    TO authenticated
    USING (
        account_id = (SELECT auth.uid())
        OR is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Step 5: Verify policies exist
SELECT 
    policyname,
    cmd,
    roles::text as roles
FROM pg_policies 
WHERE tablename = 'artworks' 
AND policyname IN ('artworks_read_public', 'artworks_read_own')
ORDER BY policyname;

-- Step 6: Test - count artworks that should be visible
SELECT 
    COUNT(*) as total_artworks,
    COUNT(*) FILTER (WHERE status = 'verified' AND is_public = true) as should_be_visible
FROM public.artworks;

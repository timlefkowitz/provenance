-- Comprehensive fix for artworks visibility
-- This addresses all potential RLS policy issues
-- SAFE: Only changes permissions, does NOT modify or delete any data

-- Step 1: Check if the helper function exists
-- If it doesn't exist, the artworks_read_own policy will fail
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'is_gallery_member_for_artwork'
    ) THEN
        -- Recreate the function if it's missing
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
    END IF;
END $$;

-- Step 2: Drop ALL existing artworks read policies to start fresh
DROP POLICY IF EXISTS artworks_read_public ON public.artworks;
DROP POLICY IF EXISTS artworks_read_own ON public.artworks;
DROP POLICY IF EXISTS artworks_read_verified ON public.artworks;

-- Step 3: Create public read policy FIRST (PostgreSQL evaluates policies with OR logic)
-- This allows ANYONE (anon or authenticated) to see verified + public artworks
CREATE POLICY artworks_read_public ON public.artworks
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'verified' 
        AND is_public = true
    );

-- Step 4: Create own read policy for authenticated users
-- This allows users to see their own artworks (regardless of privacy)
-- AND artworks from galleries they're members of
CREATE POLICY artworks_read_own ON public.artworks
    FOR SELECT
    TO authenticated
    USING (
        account_id = (SELECT auth.uid())
        OR (
            -- Check if function exists before using it
            EXISTS (
                SELECT 1 FROM pg_proc 
                WHERE proname = 'is_gallery_member_for_artwork'
            )
            AND is_gallery_member_for_artwork(account_id, gallery_profile_id)
        )
    );

-- Step 5: Verify the policies were created correctly
SELECT 
    policyname,
    cmd,
    roles::text,
    qual::text
FROM pg_policies 
WHERE tablename = 'artworks' 
AND policyname IN ('artworks_read_public', 'artworks_read_own')
ORDER BY policyname;

-- Step 6: Test query to see what would be visible
-- This simulates what an anonymous user would see
SELECT 
    COUNT(*) as visible_to_anon,
    'Should see verified + public artworks' as note
FROM public.artworks
WHERE status = 'verified' 
AND is_public = true;

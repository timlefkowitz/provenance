-- =============================================================================
-- Fix artworks visibility on /artworks (RLS + grants)
-- Run in Supabase SQL Editor after running ARTWORKS_VISIBILITY_DIAGNOSTIC.sql
-- SAFE: Only changes permissions; does not modify or delete data.
-- =============================================================================

-- 1. Ensure anon can SELECT (required for public feed when not signed in)
GRANT SELECT ON TABLE public.artworks TO anon;

-- 2. Ensure gallery helper exists (needed for artworks_read_own if you use gallery members)
--    If you don't have gallery_members table, this will fail; comment out (2) and (4) then
--    use the simpler artworks_read_own in the note at the bottom.
CREATE OR REPLACE FUNCTION is_gallery_member_for_artwork(artwork_account_id uuid, artwork_gallery_profile_id uuid)
RETURNS boolean AS $$
BEGIN
    IF artwork_gallery_profile_id IS NOT NULL THEN
        RETURN EXISTS (
            SELECT 1 FROM public.gallery_members gm
            WHERE gm.gallery_profile_id = artwork_gallery_profile_id
            AND gm.user_id = (SELECT auth.uid())
        );
    END IF;
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

-- 3. Public read: anon + authenticated can see verified + public artworks
DROP POLICY IF EXISTS artworks_read_public ON public.artworks;
CREATE POLICY artworks_read_public ON public.artworks
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'verified'
        AND is_public = true
    );

-- 4. Own read: authenticated can see own + gallery-member artworks
DROP POLICY IF EXISTS artworks_read_own ON public.artworks;
CREATE POLICY artworks_read_own ON public.artworks
    FOR SELECT
    TO authenticated
    USING (
        account_id = (SELECT auth.uid())
        OR is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- 5. Confirm policies
SELECT policyname, cmd, roles::text AS roles
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'artworks'
ORDER BY policyname;

-- =============================================================================
-- If you don't have gallery_members: drop (2) and (4), and use this instead of (4):
--
-- CREATE POLICY artworks_read_own ON public.artworks
--     FOR SELECT TO authenticated
--     USING (account_id = (SELECT auth.uid()));
-- =============================================================================

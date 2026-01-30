-- =============================================================================
-- Apply Artworks Visibility Fix
-- Run this in Supabase SQL Editor if:
--   • /artworks shows no public artworks (signed out or signed in)
--   • Portal shows "Your Artworks: 0" even though you have artworks
--
-- Cause: Base schema revokes anon access; RLS must allow anon to read
-- verified+public rows and authenticated to read their own (account_id = auth.uid()).
-- SAFE: Only changes permissions and RLS policies; does not modify data.
-- =============================================================================

-- 1. Allow anon to access public schema and artworks (base schema revokes these)
--    Required for /artworks when not signed in.
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON TABLE public.artworks TO anon;

-- 2. Public read: anyone (anon + authenticated) can see verified, public artworks
DROP POLICY IF EXISTS artworks_read_public ON public.artworks;
CREATE POLICY artworks_read_public ON public.artworks
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'verified'
        AND is_public = true
    );

-- 3. Own read: authenticated users see their own artworks (and gallery-member artworks if you use gallery_members)
-- (3a) Create helper only if gallery_members table exists (for gallery member access)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'gallery_members') THEN
        CREATE OR REPLACE FUNCTION is_gallery_member_for_artwork(artwork_account_id uuid, artwork_gallery_profile_id uuid)
        RETURNS boolean AS $inner$
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
        $inner$ LANGUAGE plpgsql SECURITY DEFINER;
    END IF;
END $$;

-- (3b) Policy: own account OR gallery member (if function exists). If you don't have gallery_members, use (3c) instead.
DROP POLICY IF EXISTS artworks_read_own ON public.artworks;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON p.pronamespace = n.oid WHERE n.nspname = 'public' AND p.proname = 'is_gallery_member_for_artwork') THEN
        CREATE POLICY artworks_read_own ON public.artworks
            FOR SELECT TO authenticated
            USING (
                account_id = (SELECT auth.uid())
                OR is_gallery_member_for_artwork(account_id, gallery_profile_id)
            );
    ELSE
        CREATE POLICY artworks_read_own ON public.artworks
            FOR SELECT TO authenticated
            USING (account_id = (SELECT auth.uid()));
    END IF;
END $$;

-- 4. Confirm
SELECT policyname, cmd, roles::text
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'artworks'
ORDER BY policyname;

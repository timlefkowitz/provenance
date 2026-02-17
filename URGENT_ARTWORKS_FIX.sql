-- URGENT FIX - Ensures basic artwork access works
-- This fixes the immediate issue where users can't see their own or public artworks
-- SAFE: Only changes permissions, does NOT modify or delete any data

-- Step 1: Drop ALL existing read policies to start completely fresh
DROP POLICY IF EXISTS artworks_read_public ON public.artworks;
DROP POLICY IF EXISTS artworks_read_own ON public.artworks;
DROP POLICY IF EXISTS artworks_read_verified ON public.artworks;

-- Step 2: Create SIMPLE public policy first (no function dependencies)
-- This allows anyone to see verified + public artworks
CREATE POLICY artworks_read_public ON public.artworks
    FOR SELECT
    TO anon, authenticated
    USING (
        status = 'verified' 
        AND is_public = true
    );

-- Step 3: Create SIMPLE own policy (no function call that could fail)
-- Users can see their own artworks regardless of privacy
CREATE POLICY artworks_read_own ON public.artworks
    FOR SELECT
    TO authenticated
    USING (
        account_id = (SELECT auth.uid())
    );

-- Step 4: Verify policies were created
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    CASE 
        WHEN qual IS NULL THEN 'No condition'
        ELSE substring(qual::text, 1, 100)
    END as condition_preview
FROM pg_policies 
WHERE tablename = 'artworks' 
AND policyname IN ('artworks_read_public', 'artworks_read_own')
ORDER BY policyname;

-- Step 5: Test - this should show your artworks count
SELECT 
    COUNT(*) FILTER (WHERE account_id = auth.uid()) as my_artworks,
    COUNT(*) FILTER (WHERE status = 'verified' AND is_public = true) as public_artworks
FROM public.artworks;

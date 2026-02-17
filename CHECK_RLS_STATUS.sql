-- Check RLS status and all policies on artworks table
-- Run this to diagnose why artworks aren't showing

-- 1. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'artworks' 
AND schemaname = 'public';

-- 2. List ALL policies on artworks (not just read policies)
SELECT 
    policyname,
    cmd,
    roles::text as roles,
    permissive,
    qual::text as condition,
    with_check::text as with_check
FROM pg_policies 
WHERE tablename = 'artworks'
ORDER BY policyname;

-- 3. Check if there are any DENY policies or restrictive policies
SELECT 
    policyname,
    cmd,
    permissive,
    qual::text
FROM pg_policies 
WHERE tablename = 'artworks'
AND (permissive = 'RESTRICTIVE' OR qual::text LIKE '%false%' OR qual::text LIKE '%NOT%')
ORDER BY policyname;

-- 4. Test query as current user (this simulates what RLS sees)
-- Replace YOUR_USER_ID with your actual user ID from auth.users
SELECT 
    COUNT(*) as total_artworks,
    COUNT(*) FILTER (WHERE account_id = auth.uid()) as my_artworks,
    COUNT(*) FILTER (WHERE status = 'verified' AND is_public = true) as public_verified,
    COUNT(*) FILTER (WHERE account_id = auth.uid() OR (status = 'verified' AND is_public = true)) as should_be_visible
FROM public.artworks;

-- 5. Check grants on the table
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'artworks' 
AND table_schema = 'public'
ORDER BY grantee, privilege_type;

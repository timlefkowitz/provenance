-- Diagnostic queries to check why artworks aren't showing
-- Run these in Supabase SQL Editor to diagnose the issue

-- 1. Check if artworks exist and their status
SELECT 
    COUNT(*) as total_artworks,
    COUNT(*) FILTER (WHERE status = 'verified') as verified_count,
    COUNT(*) FILTER (WHERE is_public = true) as public_count,
    COUNT(*) FILTER (WHERE status = 'verified' AND is_public = true) as verified_public_count
FROM public.artworks;

-- 2. Check current RLS policies on artworks
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'artworks'
ORDER BY policyname;

-- 3. Check if public read policy exists
SELECT 
    policyname,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'artworks' 
AND policyname = 'artworks_read_public';

-- 4. Sample artworks to see their status
SELECT 
    id,
    title,
    status,
    is_public,
    account_id,
    created_at
FROM public.artworks
ORDER BY created_at DESC
LIMIT 10;

-- 5. Test if the policy would allow access (run as authenticated user)
-- This simulates what an authenticated user would see
SELECT COUNT(*) as accessible_count
FROM public.artworks
WHERE status = 'verified' 
AND is_public = true;

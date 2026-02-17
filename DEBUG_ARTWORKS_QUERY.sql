-- Debug: Check if RLS is actually working
-- This will help us see what's happening

-- 1. Check if you can query artworks at all (with RLS)
SELECT COUNT(*) as can_query_artworks
FROM public.artworks;

-- 2. Check your user ID vs artwork account_ids
SELECT 
    auth.uid() as your_user_id,
    COUNT(DISTINCT account_id) as unique_account_ids_in_artworks,
    'Check if your user ID matches any account_id' as note
FROM public.artworks;

-- 3. Check if your artworks exist and their status
SELECT 
    account_id,
    COUNT(*) as count,
    COUNT(*) FILTER (WHERE status = 'verified') as verified_count,
    COUNT(*) FILTER (WHERE is_public = true) as public_count,
    COUNT(*) FILTER (WHERE status = 'verified' AND is_public = true) as verified_public_count
FROM public.artworks
WHERE account_id = auth.uid()
GROUP BY account_id;

-- 4. Try to see if RLS is blocking - this should return rows if policies work
SELECT 
    id,
    title,
    status,
    is_public,
    account_id
FROM public.artworks
WHERE account_id = auth.uid()
LIMIT 5;

-- 5. Check if public artworks are accessible
SELECT 
    COUNT(*) as accessible_public_count
FROM public.artworks
WHERE status = 'verified' 
AND is_public = true;

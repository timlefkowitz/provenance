-- Test what you can actually see with current RLS policies
-- Run this while signed in to see what RLS allows

-- Test 1: Can you see your own artworks?
SELECT 
    COUNT(*) as my_artworks_count,
    'Your own artworks (should work with artworks_read_own policy)' as test
FROM public.artworks
WHERE account_id = auth.uid();

-- Test 2: Can you see public verified artworks?
SELECT 
    COUNT(*) as public_artworks_count,
    'Public verified artworks (should work with artworks_read_public policy)' as test
FROM public.artworks
WHERE status = 'verified' 
AND is_public = true;

-- Test 3: What's your user ID?
SELECT 
    auth.uid() as your_user_id,
    'Your current user ID' as note;

-- Test 4: Do you have any artworks with your account_id?
SELECT 
    COUNT(*) as total_with_my_account,
    COUNT(*) FILTER (WHERE status = 'verified') as verified_with_my_account,
    COUNT(*) FILTER (WHERE is_public = true) as public_with_my_account
FROM public.artworks
WHERE account_id = auth.uid();

-- Test 5: Sample of your artworks
SELECT 
    id,
    title,
    status,
    is_public,
    account_id,
    created_at
FROM public.artworks
WHERE account_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;

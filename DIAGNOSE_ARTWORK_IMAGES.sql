-- Run this in Supabase SQL Editor to check why the last 3 artworks don't show images.
-- 1) Check last 3 artworks: do they have image_url set?
SELECT
  id,
  title,
  created_at,
  image_url IS NOT NULL AS has_image_url,
  left(image_url, 80) AS image_url_preview
FROM public.artworks
ORDER BY created_at DESC
LIMIT 5;

-- 2) Get FULL image_url for the last 3 (IMG_0416, IMG_0417, IMG_0418) to test in browser.
--    If all three URLs are identical = batch bug (same URL stored). If different, open one
--    in a new tab: if it 404s, the file is missing in storage.
SELECT id, title, image_url
FROM public.artworks
WHERE title IN ('IMG_0418', 'IMG_0417', 'IMG_0416')
ORDER BY created_at DESC;

-- 3) If image_url is NULL for some rows, those were created without a stored URL (bug).
-- 4) If image_url is set, copy one URL and open it in a browser. If it 404s or is blocked,
--    the URL base may not match your app (e.g. wrong Supabase URL in env at upload time).

-- Optional: Fix URLs that use a different host (e.g. old project URL).
-- Replace OLD_BASE and NEW_BASE with your actual URLs (e.g. from .env), then run:
-- UPDATE public.artworks
-- SET image_url = replace(image_url, 'OLD_BASE', 'NEW_BASE')
-- WHERE image_url LIKE 'OLD_BASE%';

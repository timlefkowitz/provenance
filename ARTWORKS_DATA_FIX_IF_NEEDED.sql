-- =============================================================================
-- Use only if diagnostic shows visible_in_feed_count = 0 because of DATA
-- (e.g. status = 'draft' or is_public = false for artworks that should be public)
-- Run ARTWORKS_VISIBILITY_DIAGNOSTIC.sql first to confirm.
-- =============================================================================

-- Option A: Set all existing artworks to verified + public (only if that’s correct for your app)
-- Uncomment and run only after confirming this is what you want:

/*
UPDATE public.artworks
SET status = 'verified', is_public = true
WHERE status IS DISTINCT FROM 'verified' OR is_public = false;
*/

-- Option B: Set only artworks that have a certificate_number (or other criteria) to verified + public
-- Example: uncomment and adjust as needed:

/*
UPDATE public.artworks
SET status = 'verified', is_public = true
WHERE certificate_number IS NOT NULL
  AND (status IS DISTINCT FROM 'verified' OR is_public = false);
*/

-- Check result (run after any update):
-- SELECT status, is_public, COUNT(*) FROM public.artworks GROUP BY 1, 2 ORDER BY 1, 2;

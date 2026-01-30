-- =============================================================================
-- Artworks visibility diagnostic – run in Supabase SQL Editor
-- Use this to find why /artworks shows no items despite 170 rows in the table.
-- =============================================================================

-- 1. RLS status on artworks
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'artworks';

-- 2. All RLS policies on artworks (names, commands, roles, conditions)
SELECT
  policyname,
  cmd,
  roles::text AS roles,
  permissive,
  qual::text AS using_condition,
  with_check::text AS with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'artworks'
ORDER BY policyname;

-- 3. Table grants (anon must have SELECT for public feed)
SELECT
  grantee,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'artworks'
ORDER BY grantee, privilege_type;

-- 4. Data: counts that drive visibility
--    App shows only rows where status = 'verified' AND is_public = true
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE status = 'verified') AS verified_count,
  COUNT(*) FILTER (WHERE is_public = true) AS is_public_true_count,
  COUNT(*) FILTER (WHERE status = 'verified' AND is_public = true) AS visible_in_feed_count,
  COUNT(*) FILTER (WHERE status IS DISTINCT FROM 'verified') AS not_verified_count
FROM public.artworks;

-- 5. Status and is_public breakdown
SELECT
  status,
  is_public,
  COUNT(*) AS cnt
FROM public.artworks
GROUP BY status, is_public
ORDER BY status, is_public;

-- 6. Sample rows (to confirm status/is_public values)
SELECT id, title, status, is_public, account_id, created_at
FROM public.artworks
ORDER BY created_at DESC
LIMIT 15;

-- =============================================================================
-- How to interpret
-- =============================================================================
-- • visible_in_feed_count = 0  → Either no rows are verified+public (data),
--   or RLS/grants block them. If total_rows > 0 and verified+public in (5)/(6)
--   look correct, the blocker is RLS or missing "grant select to anon".
-- • anon missing from (3)       → Run FIX_ARTWORKS_VISIBILITY.sql (grants section).
-- • artworks_read_public missing or wrong in (2) → Run FIX_ARTWORKS_VISIBILITY.sql
--   (policies section).
-- • status mostly 'draft' / not 'verified' in (5)/(6) → Update data so artworks
--   that should be public have status = 'verified' (and is_public = true).
-- =============================================================================

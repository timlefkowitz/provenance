/*
 * Add published_at to exhibitions so owners can explicitly publish shows.
 *
 * DATA-SAFE:
 * - ADD COLUMN only; no rows deleted or overwritten except the backfill below.
 * - DROP/CREATE POLICY changes access rules only; does not touch row data.
 * - Backfill sets published_at on existing rows so current public URLs keep working.
 *   New exhibitions created after this migration start as drafts (published_at NULL).
 */

ALTER TABLE public.exhibitions
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

COMMENT ON COLUMN public.exhibitions.published_at IS
  'When set, the exhibition is publicly viewable at /exhibitions/{id}';

CREATE INDEX IF NOT EXISTS exhibitions_published_at_idx
  ON public.exhibitions (published_at DESC NULLS LAST);

-- Existing exhibitions were already world-readable; preserve that visibility.
UPDATE public.exhibitions
SET published_at = COALESCE(published_at, created_at)
WHERE published_at IS NULL;

-- Replace open read policy with publish-aware access.
-- Split anon vs authenticated so anon never calls is_gallery_member_for_exhibition
-- (that function is granted to authenticated only).
DROP POLICY IF EXISTS exhibitions_read_public ON public.exhibitions;

CREATE POLICY exhibitions_read_anon ON public.exhibitions
  FOR SELECT
  TO anon
  USING (published_at IS NOT NULL);

CREATE POLICY exhibitions_read_authenticated ON public.exhibitions
  FOR SELECT
  TO authenticated
  USING (
    published_at IS NOT NULL
    OR gallery_id = (SELECT auth.uid())
    OR public.is_gallery_member_for_exhibition(gallery_id)
  );

/*
 * Draft exhibitions — restrict junction-table SELECT to mirror parent exhibition visibility.
 *
 * BEFORE this migration:
 *   exhibition_artists_read_public  → FOR SELECT USING (true)   — any anon / authenticated
 *   exhibition_artworks_read_public → FOR SELECT USING (true)   — any anon / authenticated
 *
 * This means anyone can enumerate the artists and artworks of a draft exhibition
 * by querying the junction tables directly, even though the exhibitions row itself
 * is already protected by the publish-aware policies added in
 * 20260615000000_add_exhibitions_published_at.sql.
 *
 * AFTER this migration:
 *   anon         — only rows whose parent exhibition has published_at IS NOT NULL.
 *   authenticated — rows where the exhibition is published,
 *                   OR the viewer is the gallery/account owner (gallery_id = auth.uid()),
 *                   OR the viewer is a gallery team member (is_gallery_member_for_exhibition).
 *
 * This is identical to the access rule already in place on public.exhibitions.
 *
 * DATA SAFETY:
 * - No rows modified, no columns added or removed.
 * - DROP POLICY / CREATE POLICY only; table structure and existing data untouched.
 * - Idempotent: DROP IF EXISTS guards against re-run errors.
 */

-- ── exhibition_artists ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS exhibition_artists_read_public      ON public.exhibition_artists;
DROP POLICY IF EXISTS exhibition_artists_read_anon        ON public.exhibition_artists;
DROP POLICY IF EXISTS exhibition_artists_read_authenticated ON public.exhibition_artists;

-- Anon: only rows whose parent exhibition is published.
CREATE POLICY exhibition_artists_read_anon ON public.exhibition_artists
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_artists.exhibition_id
        AND e.published_at IS NOT NULL
    )
  );

-- Authenticated: published exhibitions, own drafts, or team-member drafts.
CREATE POLICY exhibition_artists_read_authenticated ON public.exhibition_artists
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_artists.exhibition_id
        AND (
          e.published_at IS NOT NULL
          OR e.gallery_id = (SELECT auth.uid())
          OR public.is_gallery_member_for_exhibition(e.gallery_id)
        )
    )
  );

-- ── exhibition_artworks ───────────────────────────────────────────────────────

DROP POLICY IF EXISTS exhibition_artworks_read_public       ON public.exhibition_artworks;
DROP POLICY IF EXISTS exhibition_artworks_read_anon         ON public.exhibition_artworks;
DROP POLICY IF EXISTS exhibition_artworks_read_authenticated ON public.exhibition_artworks;

-- Anon: only rows whose parent exhibition is published.
CREATE POLICY exhibition_artworks_read_anon ON public.exhibition_artworks
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_artworks.exhibition_id
        AND e.published_at IS NOT NULL
    )
  );

-- Authenticated: published exhibitions, own drafts, or team-member drafts.
CREATE POLICY exhibition_artworks_read_authenticated ON public.exhibition_artworks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exhibitions e
      WHERE e.id = exhibition_artworks.exhibition_id
        AND (
          e.published_at IS NOT NULL
          OR e.gallery_id = (SELECT auth.uid())
          OR public.is_gallery_member_for_exhibition(e.gallery_id)
        )
    )
  );

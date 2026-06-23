-- Add feed_panel_artwork_ids to user_profiles
-- Stores up to 3 artwork IDs that appear in the artworks feed panel for this artist/gallery.
-- When set, these override the default "3 most recent" fallback in /api/artist-preview.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS feed_panel_artwork_ids text[] DEFAULT NULL;

COMMENT ON COLUMN public.user_profiles.feed_panel_artwork_ids IS
  'Up to 3 artwork IDs to feature in the artworks feed panel. When set, overrides the most-recent default.';

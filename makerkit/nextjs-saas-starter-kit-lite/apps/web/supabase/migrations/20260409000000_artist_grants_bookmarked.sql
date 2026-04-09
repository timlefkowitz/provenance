-- Add bookmarked flag to artist_grants so users can star grants they intend to apply for.

ALTER TABLE artist_grants
  ADD COLUMN IF NOT EXISTS bookmarked boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN artist_grants.bookmarked IS 'User-toggled flag indicating intent to apply';

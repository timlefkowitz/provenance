/*
 * -------------------------------------------------------
 * user_streaks: add per-day favoriting counters
 *
 * Mirrors the upload-bonus pattern: once a user hits 5 favorites
 * in a calendar day, they earn a one-time +1 streak bonus.
 * -------------------------------------------------------
 */

ALTER TABLE public.user_streaks
    ADD COLUMN IF NOT EXISTS daily_favorite_count   int     NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_favorite_date    date,
    ADD COLUMN IF NOT EXISTS has_daily_favorite_bonus boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.user_streaks.daily_favorite_count IS
    'Number of artworks favorited today (resets each calendar day)';
COMMENT ON COLUMN public.user_streaks.daily_favorite_date IS
    'Calendar date for the daily_favorite_count window (UTC)';
COMMENT ON COLUMN public.user_streaks.has_daily_favorite_bonus IS
    'Whether the one-time daily favorite bonus (+1 streak) has been granted today';

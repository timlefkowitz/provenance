-- Add planet tracking to user_profiles so the UI knows which planets a user has activated
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS active_planets jsonb DEFAULT '["artworks"]'::jsonb;

COMMENT ON COLUMN public.user_profiles.active_planets IS
  'JSON array of planet identifiers the user has activated, e.g. ["artworks","collectibles"]';

-- Upgrade path: if an older migration created `island` / `active_islands`, rename to planet terminology.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'asset_events' AND column_name = 'island'
  ) THEN
    ALTER TABLE public.asset_events RENAME COLUMN island TO planet;
    DROP INDEX IF EXISTS public.idx_asset_events_lookup;
    CREATE INDEX idx_asset_events_lookup ON public.asset_events(planet, asset_id, created_at);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'certificates' AND column_name = 'island'
  ) THEN
    ALTER TABLE public.certificates RENAME COLUMN island TO planet;
    DROP INDEX IF EXISTS public.idx_certificates_island_asset;
    CREATE INDEX IF NOT EXISTS idx_certificates_planet_asset ON public.certificates(planet, asset_id);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'api_keys' AND column_name = 'island'
  ) THEN
    ALTER TABLE public.api_keys RENAME COLUMN island TO planet;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'user_profiles' AND column_name = 'active_islands'
  ) THEN
    ALTER TABLE public.user_profiles RENAME COLUMN active_islands TO active_planets;
  END IF;
END $$;

-- Collectibles: declared value + collection value rollup, plus a certificate
-- number generator scoped to the collectibles table. Mirrors the artworks
-- "value" / "value_is_public" columns and generate_certificate_number() RPC so
-- collectibles reach feature parity with artworks (add -> certificate -> value).

-- 1. Declared value (free text, matches artworks.value) + privacy flag.
ALTER TABLE public.collectibles
  ADD COLUMN IF NOT EXISTS value text,
  ADD COLUMN IF NOT EXISTS value_is_public boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.collectibles.value IS 'Owner-declared value, free text (e.g. "$5,000 USD"). Mirrors artworks.value.';
COMMENT ON COLUMN public.collectibles.value_is_public IS 'Whether the declared value is visible to non-owners. Private by default.';

-- 2. Certificate number generator for collectibles. Uses the same PROV-XXXXXXXX
--    shape as artworks but checks uniqueness against the collectibles table.
CREATE OR REPLACE FUNCTION public.generate_collectible_certificate_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  candidate text;
  exists_already boolean;
  attempts integer := 0;
BEGIN
  LOOP
    candidate := 'PROV-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    SELECT EXISTS (
      SELECT 1 FROM public.collectibles WHERE certificate_number = candidate
    ) INTO exists_already;
    EXIT WHEN NOT exists_already OR attempts > 10;
    attempts := attempts + 1;
  END LOOP;
  RETURN candidate;
END;
$$;

-- 3. Allow scan tracking on public collectibles. Scans are written server-side
--    with the admin client (bypassing RLS) exactly like artworks, so no extra
--    policy is strictly required; this index keeps owner value rollups fast.
CREATE INDEX IF NOT EXISTS idx_collectibles_value ON public.collectibles(account_id) WHERE value IS NOT NULL;

/*
 * Seed curated grants (visible to all artists on the Grants page).
 * Run after migration 20250318000000_artist_grants_curated.sql.
 * Idempotent: skips each grant if one with the same name already exists with user_id IS NULL.
 *
 * Run as database owner or service role (e.g. Supabase SQL editor or psql with DB URL).
 * Normal authenticated users cannot INSERT with user_id NULL due to RLS.
 */

-- 1. Creative Capital 2027 Open Call
INSERT INTO public.artist_grants (
  user_id, name, description, deadline, amount, eligible_locations, url, discipline, source
)
SELECT
  NULL,
  'Creative Capital 2027 Open Call',
  'Individual artists in the U.S. (all 50 states).',
  '2026-04-02'::date,
  NULL,
  ARRAY['United States'],
  'https://creative-capital.org/creative-capital-award/award-application/',
  ARRAY['Visual Art', 'Film', 'Performing Arts', 'Literature'],
  'curated'
WHERE NOT EXISTS (
  SELECT 1 FROM public.artist_grants WHERE name = 'Creative Capital 2027 Open Call' AND user_id IS NULL
);

-- 2. Hopper Prize – Spring 2026 Artist Grants
INSERT INTO public.artist_grants (
  user_id, name, description, deadline, amount, eligible_locations, url, discipline, source
)
SELECT
  NULL,
  'Hopper Prize – Spring 2026 Artist Grants',
  'Artists worldwide age 18+.',
  '2026-05-12'::date,
  NULL,
  ARRAY[]::text[],
  'https://hopperprize.org',
  ARRAY['Painting', 'Photography', 'Sculpture', 'Drawing', 'Video', 'Performance', 'Installation', 'Digital Art'],
  'curated'
WHERE NOT EXISTS (
  SELECT 1 FROM public.artist_grants WHERE name = 'Hopper Prize – Spring 2026 Artist Grants' AND user_id IS NULL
);

-- 3. Laredo Public Art Program Open Call
INSERT INTO public.artist_grants (
  user_id, name, description, deadline, amount, eligible_locations, url, discipline, source
)
SELECT
  NULL,
  'Laredo Public Art Program Open Call',
  'Artists eligible to work in the U.S.',
  '2026-04-12'::date,
  NULL,
  ARRAY['United States', 'Laredo'],
  'https://www.lmtonline.com/local/article/laredo-public-art-program-round-two-artist-call-21954989.php',
  ARRAY['Murals', 'Poetry', 'Public Art Installations'],
  'curated'
WHERE NOT EXISTS (
  SELECT 1 FROM public.artist_grants WHERE name = 'Laredo Public Art Program Open Call' AND user_id IS NULL
);

-- 4. The Work of Art Journal – "Care" Issue
INSERT INTO public.artist_grants (
  user_id, name, description, deadline, amount, eligible_locations, url, discipline, source
)
SELECT
  NULL,
  'The Work of Art Journal – "Care" Issue',
  'Open to artists worldwide (original unpublished work).',
  '2026-03-20'::date,
  NULL,
  ARRAY[]::text[],
  'https://beethechangefoundation.com/the-work-of-art/',
  ARRAY['Visual Art', 'Poetry', 'Written Work'],
  'curated'
WHERE NOT EXISTS (
  SELECT 1 FROM public.artist_grants WHERE name = 'The Work of Art Journal – "Care" Issue' AND user_id IS NULL
);

-- 5. Screen-Native Media Open Call (Restart Reality)
INSERT INTO public.artist_grants (
  user_id, name, description, deadline, amount, eligible_locations, url, discipline, source
)
SELECT
  NULL,
  'Screen-Native Media Open Call (Restart Reality)',
  'Emerging & established artists worldwide.',
  '2026-05-08'::date,
  NULL,
  ARRAY[]::text[],
  'https://cifra.art',
  ARRAY['Digital Art', 'Screen-based media'],
  'curated'
WHERE NOT EXISTS (
  SELECT 1 FROM public.artist_grants WHERE name = 'Screen-Native Media Open Call (Restart Reality)' AND user_id IS NULL
);

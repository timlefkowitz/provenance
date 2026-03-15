/*
 * Seed open calls from the provided list.
 * Uses the first gallery profile in the database as the "owner" of these listings.
 * Idempotent: re-running skips any open call whose slug already exists.
 *
 * Prerequisite: At least one row in user_profiles with role = 'gallery'.
 *
 * Run from project root, e.g.:
 *   psql $DATABASE_URL -f scripts/seed-open-calls-from-list.sql
 * Or via Supabase SQL editor: paste the contents of this file.
 */

DO $$
DECLARE
  g_pid uuid;
  g_uid uuid;
  exh_id uuid;
BEGIN
  SELECT id, user_id INTO g_pid, g_uid
  FROM public.user_profiles
  WHERE role = 'gallery'
  LIMIT 1;

  IF g_pid IS NULL OR g_uid IS NULL THEN
    RAISE EXCEPTION 'No gallery profile found. Create a gallery account and profile first.';
  END IF;

  -- 1. Art in the Open – San Antonio River Foundation
  IF NOT EXISTS (SELECT 1 FROM public.open_calls WHERE slug = 'art-in-the-open-san-antonio-2026') THEN
    INSERT INTO public.exhibitions (gallery_id, title, description, start_date, end_date, created_by, updated_by)
    VALUES (g_uid, 'Art in the Open – San Antonio River Foundation',
      'Open to artists / collectives (Texas artists commonly apply).',
      '2026-01-15'::date, '2026-02-15'::date, g_uid, g_uid)
    RETURNING id INTO exh_id;
    INSERT INTO public.open_calls (exhibition_id, gallery_profile_id, slug, submission_open_date, submission_closing_date, call_type, eligible_locations, external_url, created_by, updated_by)
    VALUES (exh_id, g_pid, 'art-in-the-open-san-antonio-2026', '2026-01-15'::date, '2026-02-15'::date, 'exhibition', ARRAY['Texas'], 'https://sariverfound.org/events/callforproposals-767/', g_uid, g_uid);
  END IF;

  -- 2. Texas Sculpts V – Juried Exhibition
  IF NOT EXISTS (SELECT 1 FROM public.open_calls WHERE slug = 'texas-sculpts-v-2026') THEN
    INSERT INTO public.exhibitions (gallery_id, title, description, start_date, end_date, created_by, updated_by)
    VALUES (g_uid, 'Texas Sculpts V – Juried Exhibition',
      'Must be a Texas sculptor.',
      '2026-01-19'::date, '2026-02-16'::date, g_uid, g_uid)
    RETURNING id INTO exh_id;
    INSERT INTO public.open_calls (exhibition_id, gallery_profile_id, slug, submission_open_date, submission_closing_date, call_type, medium, eligible_locations, external_url, created_by, updated_by)
    VALUES (exh_id, g_pid, 'texas-sculpts-v-2026', '2026-01-19'::date, '2026-02-16'::date, 'exhibition', 'sculpture', ARRAY['Texas'], 'https://www.artcentreofplano.org/events-exhibitions/texas-sculpts-v-call-for-artist', g_uid, g_uid);
  END IF;

  -- 3. Artist-in-Residence Program – Mexican American Cultural Center
  IF NOT EXISTS (SELECT 1 FROM public.open_calls WHERE slug = 'macc-artist-in-residence-2026') THEN
    INSERT INTO public.exhibitions (gallery_id, title, description, start_date, end_date, created_by, updated_by)
    VALUES (g_uid, 'Artist-in-Residence Program – Mexican American Cultural Center',
      'Open to artists; focus on border / Mexican American culture.',
      '2026-01-13'::date, '2026-02-28'::date, g_uid, g_uid)
    RETURNING id INTO exh_id;
    INSERT INTO public.open_calls (exhibition_id, gallery_profile_id, slug, submission_open_date, submission_closing_date, call_type, eligible_locations, external_url, created_by, updated_by)
    VALUES (exh_id, g_pid, 'macc-artist-in-residence-2026', '2026-01-13'::date, '2026-02-28'::date, 'exhibition', ARRAY['Texas'], 'https://epmacc.org', g_uid, g_uid);
  END IF;

  -- 4. Laredo Public Art Contest
  IF NOT EXISTS (SELECT 1 FROM public.open_calls WHERE slug = 'laredo-public-art-contest-2026') THEN
    INSERT INTO public.exhibitions (gallery_id, title, description, start_date, end_date, created_by, updated_by)
    VALUES (g_uid, 'Laredo Public Art Contest',
      'Must be legally eligible to work in the U.S. City of Laredo public art program.',
      '2026-03-01'::date, '2026-04-12'::date, g_uid, g_uid)
    RETURNING id INTO exh_id;
    INSERT INTO public.open_calls (exhibition_id, gallery_profile_id, slug, submission_open_date, submission_closing_date, call_type, eligible_locations, external_url, created_by, updated_by)
    VALUES (exh_id, g_pid, 'laredo-public-art-contest-2026', '2026-03-01'::date, '2026-04-12'::date, 'exhibition', ARRAY['Texas', 'Laredo'], NULL, g_uid, g_uid);
  END IF;

  -- 5. Future Front Festival Artist Open Call
  IF NOT EXISTS (SELECT 1 FROM public.open_calls WHERE slug = 'future-front-festival-2026') THEN
    INSERT INTO public.exhibitions (gallery_id, title, description, start_date, end_date, created_by, updated_by)
    VALUES (g_uid, 'Future Front Festival Artist Open Call',
      'Must live and work in Texas. Expected reopen Apr 2026; deadline TBD.',
      '2026-04-01'::date, NULL, g_uid, g_uid)
    RETURNING id INTO exh_id;
    INSERT INTO public.open_calls (exhibition_id, gallery_profile_id, slug, submission_open_date, submission_closing_date, call_type, eligible_locations, external_url, created_by, updated_by)
    VALUES (exh_id, g_pid, 'future-front-festival-2026', '2026-04-01'::date, NULL, 'exhibition', ARRAY['Texas'], 'https://futurefronttexas.org/submit', g_uid, g_uid);
  END IF;

  -- 6. Virtual Environmental Art Residencies
  IF NOT EXISTS (SELECT 1 FROM public.open_calls WHERE slug = 'virtual-environmental-art-residencies-2026') THEN
    INSERT INTO public.exhibitions (gallery_id, title, description, start_date, end_date, created_by, updated_by)
    VALUES (g_uid, 'Virtual Environmental Art Residencies',
      'Open internationally. Rolling deadline.',
      '2026-01-01'::date, NULL, g_uid, g_uid)
    RETURNING id INTO exh_id;
    INSERT INTO public.open_calls (exhibition_id, gallery_profile_id, slug, submission_open_date, submission_closing_date, call_type, eligible_locations, external_url, created_by, updated_by)
    VALUES (exh_id, g_pid, 'virtual-environmental-art-residencies-2026', '2026-01-01'::date, NULL, 'exhibition', ARRAY[]::text[], 'https://www.mokuartstudio.com/open-call-residency-programs-2026', g_uid, g_uid);
  END IF;

END $$;

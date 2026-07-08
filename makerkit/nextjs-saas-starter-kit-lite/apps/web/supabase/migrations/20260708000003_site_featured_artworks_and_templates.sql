/*
 * 1. Add featured_artwork_ids column to profile_sites.
 *    - Ordered jsonb array of artwork UUIDs that the site owner pinned.
 *    - Empty array = automatic (latest works); non-empty = curated order.
 *    - Mirrors the feed_panel_artwork_ids pattern on user_profiles.
 *
 * 2. Expand profile_sites.template_id CHECK constraint to include 7 new
 *    template ids: manifesto, billboard, shopfront, poster, annum, chronicle, ledger.
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP TABLE.
 * - No existing column data is modified.
 * - All existing rows remain valid (new column gets empty-array default;
 *   template_id widening is a strict superset of existing values).
 * - Supabase runs migrations in a transaction; constraint re-add rolls back
 *   cleanly on any failure.
 */

alter table public.profile_sites
  add column if not exists featured_artwork_ids jsonb not null default '[]'::jsonb;

comment on column public.profile_sites.featured_artwork_ids is
  'Ordered array of artwork UUIDs pinned by the site owner. Empty = auto (latest works).';

-- Widen the template_id allowed-values check.
alter table public.profile_sites
  drop constraint if exists profile_sites_template_id_check;

alter table public.profile_sites
  add constraint profile_sites_template_id_check
  check (
    template_id in (
      -- original 12
      'editorial',
      'studio',
      'atelier',
      'whitecube',
      'vitrine',
      'salon',
      'pavilion',
      'folio',
      'index',
      'concrete',
      'lightbox',
      'noir',
      -- 7 new templates
      'manifesto',
      'billboard',
      'shopfront',
      'poster',
      'annum',
      'chronicle',
      'ledger'
    )
  );

comment on column public.profile_sites.template_id is
  'Visual template id. One of 19 layouts.';

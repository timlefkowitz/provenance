/*
 * Add 'marginalia' to the profile_sites.template_id allowed-values check.
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP TABLE.
 * - No existing column data is modified; every existing row is left untouched.
 * - Only the CHECK constraint definition changes (allowed enum widens to 22 values).
 * - All previously valid template_id values remain valid.
 * - Default stays 'studio'; NOT NULL is unchanged.
 * - RLS policies, triggers, indexes, and handles are not touched.
 * - Supabase runs migrations in a transaction: if re-adding the constraint fails
 *   the drop is rolled back and the old constraint stays in place.
 */

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
      -- 7 added in 20260708000003
      'manifesto',
      'billboard',
      'shopfront',
      'poster',
      'annum',
      'chronicle',
      'ledger',
      -- 1 added in 20260721000000
      'cabinet',
      -- 1 added in 20260721000002
      'broadside',
      -- 1 new: marginalia
      'marginalia'
    )
  );

comment on column public.profile_sites.template_id is
  'Visual template id. One of 22 layouts.';

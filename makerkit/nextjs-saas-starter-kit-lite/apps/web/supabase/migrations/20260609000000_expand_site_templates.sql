/*
 * Expand profile_sites.template_id to support 12 creator-site templates.
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP TABLE.
 * - No column data is modified; every existing row is left untouched.
 * - Only the CHECK constraint definition changes (allowed enum widens).
 * - New allowed values are a superset of the previous three
 *   (editorial, studio, atelier), so all existing rows remain valid.
 * - Default stays 'studio'; NOT NULL is unchanged.
 * - RLS policies, triggers, indexes, and handles are not touched.
 * - Supabase runs migrations in a transaction: if re-adding the
 *   constraint fails (e.g. corrupt template_id in a row), the
 *   drop is rolled back and the old constraint stays in place.
 */

alter table public.profile_sites
  drop constraint if exists profile_sites_template_id_check;

alter table public.profile_sites
  add constraint profile_sites_template_id_check
  check (
    template_id in (
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
      'noir'
    )
  );

comment on column public.profile_sites.template_id is
  'Visual template id. One of 12 layouts: editorial, studio, atelier, whitecube, vitrine, salon, pavilion, folio, index, concrete, lightbox, noir.';

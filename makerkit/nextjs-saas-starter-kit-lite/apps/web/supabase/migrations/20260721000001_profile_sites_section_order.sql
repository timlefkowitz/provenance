/*
 * Add section_order column to profile_sites.
 *
 * Stores an ordered array of section keys (e.g. ["bio","artworks","exhibitions","press","contact"]).
 * null = use the template's default order (fully backward-compatible).
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP TABLE.
 * - Column is nullable; existing rows are left with section_order = null
 *   which means templates continue to render in their hard-coded default order.
 * - RLS policies, triggers, indexes, handles, and CHECK constraints are not touched.
 */

alter table public.profile_sites
  add column if not exists section_order jsonb null;

comment on column public.profile_sites.section_order is
  'Ordered array of section keys for the site layout (null = template default).
   Valid values: "bio", "artworks", "exhibitions", "press", "contact".';

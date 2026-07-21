/*
 * Add featured_exhibition_ids column to profile_sites.
 *
 * Ordered jsonb array of exhibition UUIDs that the site owner pinned.
 * Empty array = automatic (latest 12 published exhibitions);
 * non-empty = curated/pinned order.
 *
 * Mirrors the featured_artwork_ids column added in 20260708000003.
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP TABLE.
 * - No existing column data is modified.
 * - All existing rows receive the empty-array default (automatic mode).
 * - RLS policies, triggers, indexes, handles, and CHECK constraints are not touched.
 */

alter table public.profile_sites
  add column if not exists featured_exhibition_ids jsonb not null default '[]'::jsonb;

comment on column public.profile_sites.featured_exhibition_ids is
  'Ordered array of exhibition UUIDs pinned by the site owner. Empty = auto (latest 12 published exhibitions).';

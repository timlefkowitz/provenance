/*
 * -------------------------------------------------------
 * Widen exhibitions.owner_role to include artist / collector
 *
 * Artists and collectors can now create their own exhibition
 * records, so the CHECK constraint must accept all four modes.
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP on user tables.
 * - Existing rows with 'gallery' or 'institution' remain valid.
 * - Only the constraint definition changes.
 * -------------------------------------------------------
 */

alter table public.exhibitions
  drop constraint if exists exhibitions_owner_role_check;

alter table public.exhibitions
  add constraint exhibitions_owner_role_check
  check (owner_role in ('artist', 'collector', 'gallery', 'institution'));

comment on column public.exhibitions.owner_role is
  'Which user mode owns this exhibition: artist, collector, gallery, or institution. gallery_id still stores the owner account id.';

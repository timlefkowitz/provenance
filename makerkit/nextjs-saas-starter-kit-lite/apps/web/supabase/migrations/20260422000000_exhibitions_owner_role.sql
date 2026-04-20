/*
 * -------------------------------------------------------
 * Exhibitions Owner Role
 * Adds an owner_role column to public.exhibitions so the
 * same account can own both gallery-mode and institution-mode
 * exhibitions without them bleeding into each other's pickers.
 *
 * gallery_id continues to store the owning account's id for
 * both modes. owner_role records which mode the exhibition
 * was created under so the UI can filter per active mode.
 * -------------------------------------------------------
 *
 * DATA SAFETY (review checklist):
 * - No DELETE, TRUNCATE, or DROP on user tables.
 * - Existing exhibitions: new column with NOT NULL DEFAULT 'gallery'
 *   so all pre-existing rows get 'gallery' without a mass update.
 * - Idempotent: ADD COLUMN / CREATE INDEX use IF NOT EXISTS.
 * - No RLS policy change needed; existing policies key off
 *   gallery_id = auth.uid(), which works for both modes.
 */

alter table public.exhibitions
  add column if not exists owner_role text not null default 'gallery';

-- Add (or replace) the check constraint only after the column exists.
alter table public.exhibitions
  drop constraint if exists exhibitions_owner_role_check;

alter table public.exhibitions
  add constraint exhibitions_owner_role_check
  check (owner_role in ('gallery', 'institution'));

comment on column public.exhibitions.owner_role is
  'Which user mode owns this exhibition: gallery or institution. gallery_id still stores the owner account id.';

create index if not exists exhibitions_owner_role_idx
  on public.exhibitions(owner_role);

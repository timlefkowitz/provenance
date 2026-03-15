/*
 * -------------------------------------------------------
 * Open Calls: medium (e.g. Painting, Sculpture) for filtering
 *
 * DATA-SAFE: Additive only. ADD COLUMN IF NOT EXISTS.
 * -------------------------------------------------------
 */

alter table public.open_calls
  add column if not exists medium text;

comment on column public.open_calls.medium is 'Medium/category for the open call (e.g. Painting, Sculpture) for search and filter.';

create index if not exists open_calls_medium_idx on public.open_calls(medium);

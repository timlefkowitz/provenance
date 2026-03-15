/*
 * -------------------------------------------------------
 * Open Calls: submission window, type, and location eligibility
 * - submission_open_date / submission_closing_date for active vs expired
 * - call_type for filtering (exhibition, art, residency, grant)
 * - eligible_locations for "qualifies in your location" filter
 *
 * DATA-SAFE: Additive only. No DROP TABLE, TRUNCATE, DELETE, or DROP COLUMN.
 * - ADD COLUMN IF NOT EXISTS with defaults (existing rows get default values).
 * - UPDATE only fills NULL submission dates from exhibition dates; does not
 *   overwrite any non-null values. Safe to run multiple times.
 * -------------------------------------------------------
 */

alter table public.open_calls
  add column if not exists submission_open_date date,
  add column if not exists submission_closing_date date,
  add column if not exists call_type text default 'exhibition',
  add column if not exists eligible_locations text[] default '{}';

comment on column public.open_calls.submission_open_date is 'When submissions open for this open call';
comment on column public.open_calls.submission_closing_date is 'When submissions close; used to show open call in expired section';
comment on column public.open_calls.call_type is 'Type of call: exhibition, art, residency, grant';
comment on column public.open_calls.eligible_locations is 'Locations where artists can apply (empty = no restriction)';

create index if not exists open_calls_submission_closing_date_idx on public.open_calls(submission_closing_date);
create index if not exists open_calls_call_type_idx on public.open_calls(call_type);
create index if not exists open_calls_eligible_locations_idx on public.open_calls using gin(eligible_locations);

-- Backfill: set submission dates only where still null (from exhibition dates).
-- Does not overwrite any existing non-null values; safe to re-run.
update public.open_calls oc
set
  submission_open_date = coalesce(oc.submission_open_date, e.start_date),
  submission_closing_date = coalesce(oc.submission_closing_date, e.end_date)
from public.exhibitions e
where oc.exhibition_id = e.id
  and (oc.submission_open_date is null or oc.submission_closing_date is null);

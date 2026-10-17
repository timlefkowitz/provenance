/*
 * Open call logistics.
 *
 * open_calls.dropoff_date: when selected artists deliver their work.
 * open_calls.address: where to deliver it (usually the venue), shown on the
 * open call page alongside the exhibition dates.
 *
 * DATA-SAFE: additive only. Nullable columns; existing calls render as before.
 */

alter table public.open_calls
  add column if not exists dropoff_date date;

alter table public.open_calls
  add column if not exists address text;

comment on column public.open_calls.dropoff_date is 'Date selected artists drop off their artwork';
comment on column public.open_calls.address is 'Drop-off / venue address shown on the open call page';

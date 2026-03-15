/*
 * -------------------------------------------------------
 * Open Calls: external URL for curated/listings
 * When set, the open call is a listing; link out to the real application page.
 *
 * DATA-SAFE: Additive only. ADD COLUMN IF NOT EXISTS.
 * -------------------------------------------------------
 */

alter table public.open_calls
  add column if not exists external_url text;

comment on column public.open_calls.external_url is 'When set, link to the real open call / application page (curated listing).';

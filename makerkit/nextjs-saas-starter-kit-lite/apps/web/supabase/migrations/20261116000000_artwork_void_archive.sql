-- Void a certificate: it leaves every list, the registry and public views
-- (all of which read status = 'verified') and moves to the holder's Archive.
-- The certificate page stays reachable so a scanned QR shows "Voided".
-- Restoring puts status back to what it was before the void.

alter table public.artworks
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by uuid references auth.users(id) on delete set null,
  add column if not exists void_reason text,
  add column if not exists status_before_void varchar(50);

comment on column public.artworks.voided_at is 'When the certificate was voided; status is ''voided'' while set.';
comment on column public.artworks.voided_by is 'Who voided the certificate.';
comment on column public.artworks.void_reason is 'Optional reason the holder gave for voiding.';
comment on column public.artworks.status_before_void is 'Status to restore when the certificate is un-voided.';

create index if not exists artworks_voided_idx
  on public.artworks(account_id, voided_at desc)
  where status = 'voided';

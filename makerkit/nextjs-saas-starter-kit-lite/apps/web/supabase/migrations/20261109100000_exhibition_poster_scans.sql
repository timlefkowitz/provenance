/*
 * -------------------------------------------------------
 * Exhibition poster scans
 * One row per scan of a show's own QR code (the poster, flyer, catalog
 * and checklist code), so organisers can see how many people scanned it.
 * No location, device or account is stored: only when, an anonymous
 * per-browser id for counting people, and whether it was the show's own
 * team. Written and read by the server only (service role); no policies.
 * -------------------------------------------------------
 */

create table if not exists public.exhibition_poster_scans (
    id uuid primary key default gen_random_uuid(),
    exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
    scanned_at timestamptz not null default now(),
    visitor text check (visitor is null or visitor ~ '^[a-z0-9]{16,40}$'),
    by_team boolean not null default false
);

create index if not exists exhibition_poster_scans_exhibition_idx
    on public.exhibition_poster_scans (exhibition_id, scanned_at desc);

alter table public.exhibition_poster_scans enable row level security;

revoke all on public.exhibition_poster_scans from anon, authenticated;
grant select, insert, delete on public.exhibition_poster_scans to service_role;

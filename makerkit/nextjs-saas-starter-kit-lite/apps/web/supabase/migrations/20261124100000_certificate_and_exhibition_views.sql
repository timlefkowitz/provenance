/*
 * -------------------------------------------------------
 * Certificate and exhibition page views
 * One row per view of a certificate page (COA, COO or COS) or an
 * exhibition page, however the visitor got there (QR scan, shared link,
 * feed, search). Repeat views by the same browser are collapsed server-side
 * before insert. No location, device or account is stored: only when, an
 * anonymous per-browser id for counting people, and whether it was the
 * certificate's holder / the show's own team (left out of the counts).
 * Written and read by the server only (service role); no policies.
 * -------------------------------------------------------
 */

create table if not exists public.certificate_views (
    id uuid primary key default gen_random_uuid(),
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    viewed_at timestamptz not null default now(),
    visitor text check (visitor is null or visitor ~ '^[a-z0-9]{16,40}$'),
    by_owner boolean not null default false
);

create index if not exists certificate_views_artwork_idx
    on public.certificate_views (artwork_id, viewed_at desc);

alter table public.certificate_views enable row level security;

revoke all on public.certificate_views from anon, authenticated;
grant select, insert, delete on public.certificate_views to service_role;

create table if not exists public.exhibition_views (
    id uuid primary key default gen_random_uuid(),
    exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
    viewed_at timestamptz not null default now(),
    visitor text check (visitor is null or visitor ~ '^[a-z0-9]{16,40}$'),
    by_team boolean not null default false
);

create index if not exists exhibition_views_exhibition_idx
    on public.exhibition_views (exhibition_id, viewed_at desc);

alter table public.exhibition_views enable row level security;

revoke all on public.exhibition_views from anon, authenticated;
grant select, insert, delete on public.exhibition_views to service_role;

/*
 * View counts per certificate, the holder's own views left out. `people`
 * counts distinct browsers; views without a browser id count once each.
 */
create or replace function public.certificate_view_stats(p_artwork_ids uuid[])
returns table (artwork_id uuid, total bigint, people bigint, last_viewed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
    select
        v.artwork_id,
        count(*) as total,
        count(distinct v.visitor) + count(*) filter (where v.visitor is null) as people,
        max(v.viewed_at) as last_viewed_at
    from public.certificate_views v
    where v.artwork_id = any(p_artwork_ids)
      and not v.by_owner
    group by v.artwork_id;
$$;

revoke all on function public.certificate_view_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.certificate_view_stats(uuid[]) to service_role;

/* Page views of one exhibition, the show's team left out. */
create or replace function public.exhibition_view_stats(p_exhibition_id uuid)
returns table (total bigint, people bigint, last_viewed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
    select
        count(*) as total,
        count(distinct v.visitor) + count(*) filter (where v.visitor is null) as people,
        max(v.viewed_at) as last_viewed_at
    from public.exhibition_views v
    where v.exhibition_id = p_exhibition_id
      and not v.by_team;
$$;

revoke all on function public.exhibition_view_stats(uuid) from public, anon, authenticated;
grant execute on function public.exhibition_view_stats(uuid) to service_role;

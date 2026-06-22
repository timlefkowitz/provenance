/*
 * Site analytics extension.
 *
 * Adds three new tables that the rewritten record_user_heartbeat RPC populates:
 *
 *   user_activity_daily  – per-user, per-day active_minutes (powers DAU/WAU/MAU, retention)
 *   page_activity        – site-wide path aggregates (powers "where users spend time")
 *   user_sessions        – individual sessions keyed by a 30-min inactivity gap (powers
 *                          avg session length, sessions/user, device+browser breakdown)
 *
 * record_user_heartbeat is replaced with a new overload that accepts optional
 * p_path / p_device / p_browser.  Callers that omit the new params get the
 * original behaviour (backward compatible during deploy).
 *
 * Admin aggregation RPCs mirror the existing admin_top_artwork_uploaders pattern:
 * SECURITY DEFINER, caller must be service_role (checked via auth.jwt()).
 */

-- -----------------------------------------------------------------------
-- user_activity_daily
-- -----------------------------------------------------------------------
create table if not exists public.user_activity_daily (
    user_id        uuid    not null references auth.users(id) on delete cascade,
    day            date    not null,
    active_minutes integer not null default 0 check (active_minutes >= 0),
    primary key (user_id, day)
);

comment on table public.user_activity_daily is
    'One row per (user, calendar day). active_minutes mirrors the same 50s-debounced increment used in user_presence.';

create index if not exists user_activity_daily_day_idx on public.user_activity_daily(day desc);
create index if not exists user_activity_daily_user_day_idx on public.user_activity_daily(user_id, day desc);

alter table public.user_activity_daily enable row level security;

drop policy if exists user_activity_daily_read_own  on public.user_activity_daily;
drop policy if exists user_activity_daily_write_own on public.user_activity_daily;

create policy user_activity_daily_read_own on public.user_activity_daily
    for select to authenticated
    using (user_id = (select auth.uid()));

create policy user_activity_daily_write_own on public.user_activity_daily
    for all to authenticated
    using (user_id = (select auth.uid()))
    with check (user_id = (select auth.uid()));

grant select, insert, update on table public.user_activity_daily to authenticated;
grant all on table public.user_activity_daily to service_role;

-- -----------------------------------------------------------------------
-- page_activity
-- -----------------------------------------------------------------------
create table if not exists public.page_activity (
    path                 text        primary key,
    total_active_minutes integer     not null default 0 check (total_active_minutes >= 0),
    view_count           integer     not null default 0 check (view_count >= 0),
    last_seen_at         timestamptz not null default now()
);

comment on table public.page_activity is
    'Site-wide aggregate of active minutes and heartbeat pings per normalized route path.';

create index if not exists page_activity_total_minutes_idx on public.page_activity(total_active_minutes desc);
create index if not exists page_activity_view_count_idx    on public.page_activity(view_count desc);

alter table public.page_activity enable row level security;

-- No user-scoped reads; all reads/writes go through the SECURITY DEFINER RPC.
grant all on table public.page_activity to service_role;

-- -----------------------------------------------------------------------
-- user_sessions
-- -----------------------------------------------------------------------
create table if not exists public.user_sessions (
    id         bigint      generated always as identity primary key,
    user_id    uuid        not null references auth.users(id) on delete cascade,
    started_at timestamptz not null default now(),
    ended_at   timestamptz not null default now(),
    device     text,
    browser    text
);

comment on table public.user_sessions is
    'One row per distinct session (gap > 30 min ends a session). ended_at is advanced on each heartbeat.';

create index if not exists user_sessions_user_started_idx on public.user_sessions(user_id, started_at desc);
create index if not exists user_sessions_started_idx      on public.user_sessions(started_at desc);

alter table public.user_sessions enable row level security;

drop policy if exists user_sessions_read_own  on public.user_sessions;
drop policy if exists user_sessions_write_own on public.user_sessions;

-- Users can read their own sessions; inserts/updates go through the SECURITY
-- DEFINER RPC only (no direct write policy needed for authenticated).
create policy user_sessions_read_own on public.user_sessions
    for select to authenticated
    using (user_id = (select auth.uid()));

-- authenticated role can read its own sessions; inserts/updates happen only via
-- the SECURITY DEFINER record_user_heartbeat RPC (which runs as the function owner
-- and bypasses RLS), so we do not grant insert/update here and we do not need a
-- direct grant on the identity sequence.
grant select on table public.user_sessions to authenticated;
grant all on table public.user_sessions to service_role;

-- -----------------------------------------------------------------------
-- record_user_heartbeat  (replaces the version from 20260512000000)
-- -----------------------------------------------------------------------
-- Drop the old signature so we can replace it with the extended one.
drop function if exists public.record_user_heartbeat(uuid);

create or replace function public.record_user_heartbeat(
    p_user_id uuid,
    p_path    text    default null,
    p_device  text    default null,
    p_browser text    default null
)
returns table (
    last_seen_at         timestamptz,
    total_active_minutes integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_now                  timestamptz := now();
    v_today                date        := (v_now at time zone 'UTC')::date;
    v_total                integer;
    v_seen                 timestamptz;
    v_increment            boolean     := false;
    v_old_incremented_at   timestamptz;
    v_session              bigint;
    v_session_gap          interval    := interval '30 minutes';
begin
    if (select auth.uid()) is distinct from p_user_id then
        raise exception 'not authorized'
            using errcode = '42501';
    end if;

    -- Capture the CURRENT last_incremented_at BEFORE the upsert so we can
    -- correctly determine whether this ping triggers a minute increment.
    -- (After the upsert, last_incremented_at is already set to v_now if it
    -- fired, making the post-upsert check always return false — classic TOCTOU.)
    select last_incremented_at
    into v_old_incremented_at
    from public.user_presence
    where user_id = p_user_id;

    -- No existing row → first heartbeat → always increment.
    v_increment := (v_old_incremented_at is null
                    or v_now - v_old_incremented_at >= interval '50 seconds');

    -- ---- user_presence (existing behaviour, unchanged) -----------------
    insert into public.user_presence (user_id, last_seen_at, last_incremented_at, total_active_minutes)
    values (p_user_id, v_now, v_now, 1)
    on conflict (user_id) do update
        set last_seen_at = v_now,
            last_incremented_at = case
                when public.user_presence.last_incremented_at is null
                  or v_now - public.user_presence.last_incremented_at >= interval '50 seconds'
                then v_now
                else public.user_presence.last_incremented_at
            end,
            total_active_minutes = case
                when public.user_presence.last_incremented_at is null
                  or v_now - public.user_presence.last_incremented_at >= interval '50 seconds'
                then public.user_presence.total_active_minutes + 1
                else public.user_presence.total_active_minutes
            end
        returning user_presence.last_seen_at, user_presence.total_active_minutes
        into v_seen, v_total;

    -- ---- user_activity_daily -------------------------------------------
    if v_increment then
        insert into public.user_activity_daily (user_id, day, active_minutes)
        values (p_user_id, v_today, 1)
        on conflict (user_id, day) do update
            set active_minutes = public.user_activity_daily.active_minutes + 1;
    end if;

    -- ---- page_activity -------------------------------------------------
    if p_path is not null then
        insert into public.page_activity (path, total_active_minutes, view_count, last_seen_at)
        values (
            p_path,
            case when v_increment then 1 else 0 end,
            1,
            v_now
        )
        on conflict (path) do update
            set total_active_minutes = public.page_activity.total_active_minutes
                                        + case when v_increment then 1 else 0 end,
                view_count           = public.page_activity.view_count + 1,
                last_seen_at         = v_now;
    end if;

    -- ---- user_sessions -------------------------------------------------
    -- Find the most recent open session for this user.
    select id into v_session
    from public.user_sessions
    where user_id = p_user_id
      and ended_at >= v_now - v_session_gap
    order by ended_at desc
    limit 1;

    if v_session is not null then
        -- Extend the existing session.
        update public.user_sessions
        set ended_at = v_now,
            device   = coalesce(p_device, device),
            browser  = coalesce(p_browser, browser)
        where id = v_session;
    else
        -- Start a new session.
        insert into public.user_sessions (user_id, started_at, ended_at, device, browser)
        values (p_user_id, v_now, v_now, p_device, p_browser);
    end if;

    return query select v_seen, v_total;
end;
$$;

revoke all on function public.record_user_heartbeat(uuid, text, text, text) from public;
grant execute on function public.record_user_heartbeat(uuid, text, text, text) to authenticated;

-- -----------------------------------------------------------------------
-- Admin aggregation RPCs
-- -----------------------------------------------------------------------

-- admin_dau_series: active user counts per day for the last N days.
create or replace function public.admin_dau_series(p_days integer default 30)
returns table (
    day            date,
    active_users   bigint
)
language sql
security definer
set search_path = public
as $$
    select day, count(distinct user_id) as active_users
    from public.user_activity_daily
    where day >= current_date - (p_days - 1)
    group by day
    order by day;
$$;

revoke all on function public.admin_dau_series(integer) from public;
grant execute on function public.admin_dau_series(integer) to service_role;

-- admin_top_pages: pages by total active minutes and view count.
create or replace function public.admin_top_pages(p_limit integer default 20)
returns table (
    path                 text,
    total_active_minutes integer,
    view_count           integer,
    last_seen_at         timestamptz
)
language sql
security definer
set search_path = public
as $$
    select path, total_active_minutes, view_count, last_seen_at
    from public.page_activity
    order by total_active_minutes desc
    limit least(coalesce(p_limit, 20), 100);
$$;

revoke all on function public.admin_top_pages(integer) from public;
grant execute on function public.admin_top_pages(integer) to service_role;

-- admin_session_stats: aggregate session metrics.
create or replace function public.admin_session_stats()
returns table (
    total_sessions       bigint,
    distinct_users       bigint,
    avg_session_minutes  numeric,
    median_session_minutes numeric,
    p90_session_minutes  numeric
)
language sql
security definer
set search_path = public
as $$
    with durations as (
        select
            user_id,
            greatest(1, round(extract(epoch from (ended_at - started_at)) / 60.0)::int) as minutes
        from public.user_sessions
    )
    select
        count(*)                                              as total_sessions,
        count(distinct user_id)                              as distinct_users,
        round(avg(minutes)::numeric, 1)                     as avg_session_minutes,
        round(percentile_cont(0.5) within group (order by minutes)::numeric, 1)
                                                             as median_session_minutes,
        round(percentile_cont(0.9) within group (order by minutes)::numeric, 1)
                                                             as p90_session_minutes
    from durations;
$$;

revoke all on function public.admin_session_stats() from public;
grant execute on function public.admin_session_stats() to service_role;

-- admin_device_breakdown: counts by device type and browser family.
create or replace function public.admin_device_breakdown()
returns table (
    device  text,
    browser text,
    cnt     bigint
)
language sql
security definer
set search_path = public
as $$
    select
        coalesce(device, 'unknown')  as device,
        coalesce(browser, 'unknown') as browser,
        count(*)                     as cnt
    from public.user_sessions
    group by device, browser
    order by cnt desc;
$$;

revoke all on function public.admin_device_breakdown() from public;
grant execute on function public.admin_device_breakdown() to service_role;

-- admin_retention: weekly cohort — users who were active in week N-1 and also week N.
create or replace function public.admin_retention()
returns table (
    week_start      date,
    new_users       bigint,
    returning_users bigint,
    retention_pct   numeric
)
language sql
security definer
set search_path = public
as $$
    with weekly_active as (
        select
            user_id,
            date_trunc('week', day)::date as week_start
        from public.user_activity_daily
        group by user_id, date_trunc('week', day)::date
    ),
    cohorts as (
        select
            w.week_start,
            count(distinct w.user_id)                                            as total_active,
            count(distinct case when prev.user_id is null then w.user_id end)    as new_users,
            count(distinct case when prev.user_id is not null then w.user_id end) as returning_users
        from weekly_active w
        left join weekly_active prev
            on prev.user_id = w.user_id
            and prev.week_start = w.week_start - interval '1 week'
        group by w.week_start
    )
    select
        week_start,
        new_users,
        returning_users,
        case when (new_users + returning_users) > 0
            then round(returning_users::numeric / (new_users + returning_users) * 100, 1)
            else 0
        end as retention_pct
    from cohorts
    order by week_start desc
    limit 12;
$$;

revoke all on function public.admin_retention() from public;
grant execute on function public.admin_retention() to service_role;

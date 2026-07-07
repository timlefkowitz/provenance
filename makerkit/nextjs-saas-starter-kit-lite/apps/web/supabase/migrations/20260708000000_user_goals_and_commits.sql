/*
 * -------------------------------------------------------
 * User Goals + Daily Commits
 *
 * Replaces the single global user_streaks row-per-user model
 * with:
 *   - user_goals: multiple user-defined art career streaks per
 *     user (e.g. "Paint daily", "Apply to a grant weekly"), plus
 *     one system-managed default goal that carries forward the
 *     original overall streak.
 *   - user_daily_commits: a GitHub-style per-day activity ledger
 *     ("commits") that powers a public contribution graph. Commits
 *     accrue from explicit check-ins and automatically from
 *     platform activity (uploading/certifying artwork counts for
 *     more commits than a plain check-in).
 *
 * user_streaks is left in place (read-only, unused) for rollback
 * safety and is fully superseded by the default row in user_goals.
 * -------------------------------------------------------
 */

create table if not exists public.user_goals (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    title text not null,
    emoji text not null default '🎨',
    is_default boolean not null default false,
    is_archived boolean not null default false,
    current_streak_days integer not null default 0 check (current_streak_days >= 0),
    longest_streak_days integer not null default 0 check (longest_streak_days >= 0),
    last_checkin_date date,
    star_tier varchar(20) not null default 'bronze' check (star_tier in ('bronze', 'silver', 'gold')),
    -- Daily bonus counters only used by the default goal (mirrors legacy user_streaks behavior).
    daily_upload_count integer not null default 0 check (daily_upload_count >= 0),
    daily_upload_date date,
    has_daily_upload_bonus boolean not null default false,
    daily_favorite_count integer not null default 0 check (daily_favorite_count >= 0),
    daily_favorite_date date,
    has_daily_favorite_bonus boolean not null default false,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

comment on table public.user_goals is 'User-defined art career goals/streaks; exactly one row per user has is_default = true (the overall activity streak).';
comment on column public.user_goals.is_default is 'True for the single system-managed "overall activity" goal migrated from user_streaks; false for user-created goals.';
comment on column public.user_goals.last_checkin_date is 'Most recent date this goal was checked in on (UTC)';

create index if not exists user_goals_user_id_idx on public.user_goals(user_id);
create unique index if not exists user_goals_one_default_per_user_idx on public.user_goals(user_id) where is_default;

alter table public.user_goals enable row level security;

drop policy if exists user_goals_read_own on public.user_goals;
drop policy if exists user_goals_read_public_default on public.user_goals;
drop policy if exists user_goals_insert_own on public.user_goals;
drop policy if exists user_goals_update_own on public.user_goals;
drop policy if exists user_goals_delete_own on public.user_goals;

create policy user_goals_read_own on public.user_goals
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
    );

-- The default goal (overall art activity streak) is shown on public artist profiles;
-- user-created custom goals stay private to the owner.
create policy user_goals_read_public_default on public.user_goals
    for select
    to anon, authenticated
    using (
        is_default = true
    );

create policy user_goals_insert_own on public.user_goals
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

create policy user_goals_update_own on public.user_goals
    for update
    to authenticated
    using (
        user_id = (select auth.uid())
    )
    with check (
        user_id = (select auth.uid())
    );

create policy user_goals_delete_own on public.user_goals
    for delete
    to authenticated
    using (
        user_id = (select auth.uid())
    );

grant select on table public.user_goals to anon;
grant select, insert, update, delete on table public.user_goals to authenticated;

create or replace function update_user_goals_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_goals_updated_at_trigger on public.user_goals;
create trigger update_user_goals_updated_at_trigger
    before update on public.user_goals
    for each row
    execute function update_user_goals_updated_at();

/*
 * -------------------------------------------------------
 * user_daily_commits: GitHub-style contribution ledger
 * -------------------------------------------------------
 */

create table if not exists public.user_daily_commits (
    user_id uuid not null references auth.users(id) on delete cascade,
    commit_date date not null,
    commit_count integer not null default 0 check (commit_count >= 0),
    breakdown jsonb not null default '{}'::jsonb,
    note text,
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now(),
    primary key (user_id, commit_date)
);

comment on table public.user_daily_commits is 'Per-day "commit" ledger for the public art-activity contribution graph. commit_count aggregates weighted activity (check-ins, uploads/COAs, favorites); breakdown records the per-source counts.';
comment on column public.user_daily_commits.breakdown is 'Per-source commit counts for the day, e.g. {"manual_checkin": 1, "artwork_uploaded": 3}';
comment on column public.user_daily_commits.note is 'Optional free-text note from a manual "worked on my art today" check-in';

create index if not exists user_daily_commits_user_id_idx on public.user_daily_commits(user_id);
create index if not exists user_daily_commits_commit_date_idx on public.user_daily_commits(commit_date);

alter table public.user_daily_commits enable row level security;

drop policy if exists user_daily_commits_read_public on public.user_daily_commits;
drop policy if exists user_daily_commits_insert_own on public.user_daily_commits;
drop policy if exists user_daily_commits_update_own on public.user_daily_commits;
drop policy if exists user_daily_commits_delete_own on public.user_daily_commits;

-- Contribution graphs are public, like GitHub's.
create policy user_daily_commits_read_public on public.user_daily_commits
    for select
    to anon, authenticated
    using (true);

create policy user_daily_commits_insert_own on public.user_daily_commits
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

create policy user_daily_commits_update_own on public.user_daily_commits
    for update
    to authenticated
    using (
        user_id = (select auth.uid())
    )
    with check (
        user_id = (select auth.uid())
    );

create policy user_daily_commits_delete_own on public.user_daily_commits
    for delete
    to authenticated
    using (
        user_id = (select auth.uid())
    );

grant select on table public.user_daily_commits to anon;
grant select, insert, update, delete on table public.user_daily_commits to authenticated;

create or replace function update_user_daily_commits_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_daily_commits_updated_at_trigger on public.user_daily_commits;
create trigger update_user_daily_commits_updated_at_trigger
    before update on public.user_daily_commits
    for each row
    execute function update_user_daily_commits_updated_at();

/*
 * -------------------------------------------------------
 * Backfill: migrate every user_streaks row into a default
 * user_goals row, and seed one commit entry so existing
 * streak-holders don't start with an empty graph.
 * -------------------------------------------------------
 */

insert into public.user_goals (
    user_id,
    title,
    emoji,
    is_default,
    current_streak_days,
    longest_streak_days,
    last_checkin_date,
    star_tier,
    daily_upload_count,
    daily_upload_date,
    has_daily_upload_bonus,
    daily_favorite_count,
    daily_favorite_date,
    has_daily_favorite_bonus
)
select
    us.user_id,
    'Working on my art',
    '🎨',
    true,
    us.current_streak_days,
    us.longest_streak_days,
    us.last_active_date,
    us.star_tier,
    us.daily_upload_count,
    us.daily_upload_date,
    us.has_daily_upload_bonus,
    us.daily_favorite_count,
    us.daily_favorite_date,
    us.has_daily_favorite_bonus
from public.user_streaks us
on conflict do nothing;

insert into public.user_daily_commits (user_id, commit_date, commit_count, breakdown)
select
    us.user_id,
    us.last_active_date,
    1,
    '{"daily_activity": 1}'::jsonb
from public.user_streaks us
where us.last_active_date is not null
on conflict (user_id, commit_date) do nothing;

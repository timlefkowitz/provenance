/*
 * -------------------------------------------------------
 * User Streaks + Star Tiers
 * Tracks daily activity streaks and upload milestones
 * -------------------------------------------------------
 */

create table if not exists public.user_streaks (
    user_id uuid primary key references auth.users(id) on delete cascade,
    current_streak_days integer not null default 0 check (current_streak_days >= 0),
    longest_streak_days integer not null default 0 check (longest_streak_days >= 0),
    last_active_date date,
    daily_upload_count integer not null default 0 check (daily_upload_count >= 0),
    daily_upload_date date,
    has_daily_upload_bonus boolean not null default false,
    star_tier varchar(20) not null default 'bronze' check (star_tier in ('bronze', 'silver', 'gold')),
    created_at timestamp with time zone not null default now(),
    updated_at timestamp with time zone not null default now()
);

comment on table public.user_streaks is 'Tracks consecutive active days and star tier progression per user';
comment on column public.user_streaks.current_streak_days is 'Current consecutive-day streak';
comment on column public.user_streaks.longest_streak_days is 'Best streak achieved by the user';
comment on column public.user_streaks.last_active_date is 'Most recent date where the user was active';
comment on column public.user_streaks.daily_upload_count is 'Number of uploads made on daily_upload_date';
comment on column public.user_streaks.has_daily_upload_bonus is 'True when user has reached the daily upload goal';

create index if not exists user_streaks_last_active_date_idx on public.user_streaks(last_active_date);
create index if not exists user_streaks_star_tier_idx on public.user_streaks(star_tier);

alter table public.user_streaks enable row level security;

drop policy if exists user_streaks_read_own on public.user_streaks;
drop policy if exists user_streaks_insert_own on public.user_streaks;
drop policy if exists user_streaks_update_own on public.user_streaks;
drop policy if exists user_streaks_delete_own on public.user_streaks;

create policy user_streaks_read_own on public.user_streaks
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
    );

create policy user_streaks_insert_own on public.user_streaks
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

create policy user_streaks_update_own on public.user_streaks
    for update
    to authenticated
    using (
        user_id = (select auth.uid())
    )
    with check (
        user_id = (select auth.uid())
    );

create policy user_streaks_delete_own on public.user_streaks
    for delete
    to authenticated
    using (
        user_id = (select auth.uid())
    );

grant select, insert, update, delete on table public.user_streaks to authenticated;

create or replace function update_user_streaks_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_user_streaks_updated_at_trigger on public.user_streaks;
create trigger update_user_streaks_updated_at_trigger
    before update on public.user_streaks
    for each row
    execute function update_user_streaks_updated_at();

/*
 * -------------------------------------------------------
 * user_badges — Founding Artist award
 *
 * 1. Creates a general user_badges table for named achievements.
 * 2. Awards the "founding_artist" badge to the first 30 accounts
 *    by sign-up date.
 * 3. Gives those 30 users a 30-day gold streak (GREATEST so we
 *    never reduce an existing higher streak).
 * -------------------------------------------------------
 */

-- Table -------------------------------------------------------

create table if not exists public.user_badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  badge_type  text not null,
  label       text not null,
  emoji       text not null default '🏅',
  description text,
  awarded_at  timestamptz not null default now()
);

comment on table public.user_badges is
  'Named achievement badges awarded to users (e.g. founding_artist).';

create unique index if not exists user_badges_user_type_idx
  on public.user_badges (user_id, badge_type);

create index if not exists user_badges_badge_type_idx
  on public.user_badges (badge_type);

alter table public.user_badges enable row level security;

-- Anyone can read badges (public profiles show them)
create policy "Badges are publicly readable"
  on public.user_badges for select
  using (true);

-- Only service role / admin can insert
create policy "Service role can manage badges"
  on public.user_badges for all
  using (auth.role() = 'service_role');

-- Founding Artist award -----------------------------------------

-- Step 1: identify the first 30 accounts
create temp table _founding_accounts as
  select id
  from public.accounts
  order by created_at asc
  limit 30;

-- Step 2: insert founding badges (skip if already awarded)
insert into public.user_badges (user_id, badge_type, label, emoji, description)
select
  id,
  'founding_artist',
  'Founding Artist',
  '👑',
  'One of the first 30 artists to join Provenance'
from _founding_accounts
on conflict (user_id, badge_type) do nothing;

-- Step 3: boost existing default goals to gold / 30-day streak
update public.user_goals g
set
  current_streak_days = greatest(g.current_streak_days, 30),
  longest_streak_days = greatest(g.longest_streak_days, 30),
  star_tier            = 'gold',
  last_checkin_date    = greatest(coalesce(g.last_checkin_date, current_date), current_date),
  updated_at           = now()
from _founding_accounts fa
where g.user_id = fa.id
  and g.is_default = true;

-- Step 4: create a default goal for founding users who don't have one yet
insert into public.user_goals (
  user_id, title, emoji, is_default,
  current_streak_days, longest_streak_days,
  star_tier, last_checkin_date
)
select
  fa.id,
  'Working on my art',
  '🎨',
  true,
  30,
  30,
  'gold',
  current_date
from _founding_accounts fa
where not exists (
  select 1
  from public.user_goals g
  where g.user_id = fa.id
    and g.is_default = true
);

drop table _founding_accounts;

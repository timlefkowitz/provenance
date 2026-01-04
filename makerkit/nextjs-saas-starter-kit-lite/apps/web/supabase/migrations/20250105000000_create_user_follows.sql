/*
 * -------------------------------------------------------
 * User Follows System
 * Allows users to follow other users/artists
 * -------------------------------------------------------
 */

-- Create user_follows table
create table if not exists public.user_follows (
    id uuid unique not null default extensions.uuid_generate_v4(),
    follower_id uuid not null references public.accounts(id) on delete cascade,
    following_id uuid not null references public.accounts(id) on delete cascade,
    created_at timestamp with time zone default now(),
    primary key (id),
    unique(follower_id, following_id),
    check (follower_id != following_id) -- Users can't follow themselves
);

comment on table public.user_follows is 'Tracks which users follow which artists/accounts';
comment on column public.user_follows.follower_id is 'The user who is following';
comment on column public.user_follows.following_id is 'The user being followed';

-- Create indexes for faster queries
create index if not exists user_follows_follower_idx on public.user_follows(follower_id);
create index if not exists user_follows_following_idx on public.user_follows(following_id);

-- Enable RLS
alter table public.user_follows enable row level security;

-- RLS Policies
-- Users can read their own follows
create policy user_follows_read_own on public.user_follows
    for select
    to authenticated
    using (
        follower_id = (select auth.uid())
        or following_id = (select auth.uid())
    );

-- Users can follow others
create policy user_follows_insert on public.user_follows
    for insert
    to authenticated
    with check (
        follower_id = (select auth.uid())
    );

-- Users can unfollow
create policy user_follows_delete on public.user_follows
    for delete
    to authenticated
    using (
        follower_id = (select auth.uid())
    );

-- Grant permissions
grant select, insert, delete on table public.user_follows to authenticated;


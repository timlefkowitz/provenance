/*
 * -------------------------------------------------------
 * User Role Profiles System
 * Allows users to have separate profiles for each role
 * (collector, artist, gallery)
 * -------------------------------------------------------
 */

-- Create user_profiles table
create table if not exists public.user_profiles (
    id uuid unique not null default extensions.uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    role varchar(20) not null check (role in ('collector', 'artist', 'gallery')),
    name varchar(255) not null,
    picture_url text,
    bio text,
    medium varchar(255), -- For artists
    location text, -- For galleries/artists
    website text,
    links text[], -- Array of links
    galleries text[], -- For artists: galleries they're associated with
    contact_email text,
    phone text,
    is_active boolean default true not null,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    primary key (id),
    unique(user_id, role) -- One profile per role per user
);

comment on table public.user_profiles is 'Separate profiles for each user role (collector, artist, gallery)';
comment on column public.user_profiles.role is 'The role this profile represents: collector, artist, or gallery';
comment on column public.user_profiles.name is 'Display name for this profile';
comment on column public.user_profiles.bio is 'Biography/description for this profile';
comment on column public.user_profiles.medium is 'Artistic medium (for artist profiles)';
comment on column public.user_profiles.is_active is 'Whether this profile is active and visible';

-- Create indexes
create index if not exists user_profiles_user_id_idx on public.user_profiles(user_id);
create index if not exists user_profiles_role_idx on public.user_profiles(role);
create index if not exists user_profiles_user_role_idx on public.user_profiles(user_id, role);
create index if not exists user_profiles_is_active_idx on public.user_profiles(is_active);

-- Enable RLS
alter table public.user_profiles enable row level security;

-- RLS Policies
-- Drop existing policies if they exist (for idempotent migrations)
drop policy if exists user_profiles_read_own on public.user_profiles;
drop policy if exists user_profiles_read_public on public.user_profiles;
drop policy if exists user_profiles_insert_own on public.user_profiles;
drop policy if exists user_profiles_update_own on public.user_profiles;
drop policy if exists user_profiles_delete_own on public.user_profiles;

-- Users can read their own profiles
create policy user_profiles_read_own on public.user_profiles
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
    );

-- Anyone can read active public profiles
create policy user_profiles_read_public on public.user_profiles
    for select
    to authenticated, anon
    using (
        is_active = true
    );

-- Users can create their own profiles
create policy user_profiles_insert_own on public.user_profiles
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

-- Users can update their own profiles
create policy user_profiles_update_own on public.user_profiles
    for update
    to authenticated
    using (
        user_id = (select auth.uid())
    )
    with check (
        user_id = (select auth.uid())
    );

-- Users can delete their own profiles
create policy user_profiles_delete_own on public.user_profiles
    for delete
    to authenticated
    using (
        user_id = (select auth.uid())
    );

-- Grant permissions
grant select, insert, update, delete on table public.user_profiles to authenticated;
grant select on table public.user_profiles to anon;

-- Create function to update updated_at timestamp
create or replace function update_user_profiles_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_user_profiles_updated_at_trigger on public.user_profiles;
create trigger update_user_profiles_updated_at_trigger
    before update on public.user_profiles
    for each row
    execute function update_user_profiles_updated_at();


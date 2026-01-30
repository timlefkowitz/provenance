/*
 * -------------------------------------------------------
 * Gallery Team Members System
 * Allows multiple users to manage a gallery profile
 * -------------------------------------------------------
 */

-- Create gallery_members table
create table if not exists public.gallery_members (
    id uuid unique not null default extensions.uuid_generate_v4(),
    gallery_profile_id uuid not null references public.user_profiles(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    role varchar(50) not null default 'member' check (role in ('owner', 'admin', 'member')),
    invited_by uuid references auth.users(id),
    invited_at timestamp with time zone default now(),
    joined_at timestamp with time zone,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    primary key (id),
    unique(gallery_profile_id, user_id) -- One membership per user per gallery
);

comment on table public.gallery_members is 'Team members who can manage a gallery profile';
comment on column public.gallery_members.gallery_profile_id is 'The gallery profile this membership is for';
comment on column public.gallery_members.user_id is 'The user who is a member of this gallery';
comment on column public.gallery_members.role is 'The role of the member: owner (gallery creator), admin (can manage members), or member (can post/manage content)';
comment on column public.gallery_members.invited_by is 'The user who invited this member';
comment on column public.gallery_members.joined_at is 'When the member accepted the invitation';

-- Create indexes
create index if not exists gallery_members_gallery_profile_id_idx on public.gallery_members(gallery_profile_id);
create index if not exists gallery_members_user_id_idx on public.gallery_members(user_id);
create index if not exists gallery_members_role_idx on public.gallery_members(role);

-- Enable RLS
alter table public.gallery_members enable row level security;

-- RLS Policies
-- Drop existing policies if they exist
drop policy if exists gallery_members_read_own on public.gallery_members;
drop policy if exists gallery_members_read_gallery on public.gallery_members;
drop policy if exists gallery_members_insert_owner on public.gallery_members;
drop policy if exists gallery_members_update_owner on public.gallery_members;
drop policy if exists gallery_members_delete_owner on public.gallery_members;

-- Users can read their own memberships
create policy gallery_members_read_own on public.gallery_members
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
    );

-- Gallery owners/admins can read all members of their galleries
create policy gallery_members_read_gallery on public.gallery_members
    for select
    to authenticated
    using (
        exists (
            select 1 from public.gallery_members gm
            join public.user_profiles up on gm.gallery_profile_id = up.id
            where gm.gallery_profile_id = gallery_members.gallery_profile_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('owner', 'admin')
        )
        or exists (
            select 1 from public.user_profiles up
            where up.id = gallery_members.gallery_profile_id
            and up.user_id = (select auth.uid())
            and up.role = 'gallery'
        )
    );

-- Gallery owners can add members (also allow users to add themselves if they're the gallery creator)
create policy gallery_members_insert_owner on public.gallery_members
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.user_profiles up
            where up.id = gallery_members.gallery_profile_id
            and up.user_id = (select auth.uid())
            and up.role = 'gallery'
        )
        or exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = gallery_members.gallery_profile_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('owner', 'admin')
        )
    );

-- Gallery owners/admins can update members (role changes, etc.)
create policy gallery_members_update_owner on public.gallery_members
    for update
    to authenticated
    using (
        exists (
            select 1 from public.user_profiles up
            where up.id = gallery_members.gallery_profile_id
            and up.user_id = (select auth.uid())
            and up.role = 'gallery'
        )
        or exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = gallery_members.gallery_profile_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('owner', 'admin')
        )
    )
    with check (
        exists (
            select 1 from public.user_profiles up
            where up.id = gallery_members.gallery_profile_id
            and up.user_id = (select auth.uid())
            and up.role = 'gallery'
        )
        or exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = gallery_members.gallery_profile_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('owner', 'admin')
        )
    );

-- Gallery owners/admins can remove members (members can also remove themselves)
create policy gallery_members_delete_owner on public.gallery_members
    for delete
    to authenticated
    using (
        user_id = (select auth.uid()) -- Members can remove themselves
        or exists (
            select 1 from public.user_profiles up
            where up.id = gallery_members.gallery_profile_id
            and up.user_id = (select auth.uid())
            and up.role = 'gallery'
        )
        or exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = gallery_members.gallery_profile_id
            and gm.user_id = (select auth.uid())
            and gm.role in ('owner', 'admin')
        )
    );

-- Grant permissions
grant select, insert, update, delete on table public.gallery_members to authenticated;

-- Create function to update updated_at timestamp
create or replace function update_gallery_members_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_gallery_members_updated_at_trigger on public.gallery_members;
create trigger update_gallery_members_updated_at_trigger
    before update on public.gallery_members
    for each row
    execute function update_gallery_members_updated_at();

-- Function to automatically add gallery creator as owner when gallery profile is created
create or replace function auto_add_gallery_owner()
returns trigger as $$
begin
    if new.role = 'gallery' then
        insert into public.gallery_members (gallery_profile_id, user_id, role, joined_at)
        values (new.id, new.user_id, 'owner', now())
        on conflict (gallery_profile_id, user_id) do nothing;
    end if;
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger to auto-add owner when gallery profile is created
drop trigger if exists auto_add_gallery_owner_trigger on public.user_profiles;
create trigger auto_add_gallery_owner_trigger
    after insert on public.user_profiles
    for each row
    when (new.role = 'gallery')
    execute function auto_add_gallery_owner();

-- Backfill: Add existing gallery profile creators as owners
insert into public.gallery_members (gallery_profile_id, user_id, role, joined_at)
select id, user_id, 'owner', created_at
from public.user_profiles
where role = 'gallery'
and not exists (
    select 1 from public.gallery_members gm
    where gm.gallery_profile_id = user_profiles.id
    and gm.user_id = user_profiles.user_id
)
on conflict (gallery_profile_id, user_id) do nothing;

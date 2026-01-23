/*
 * -------------------------------------------------------
 * Artist Profile Claims System
 * Allows galleries to create unclaimed artist profiles in registry
 * Artists can claim these profiles, and galleries approve the claims
 * -------------------------------------------------------
 */

-- Modify user_profiles to allow null user_id for unclaimed artist profiles
alter table public.user_profiles
  alter column user_id drop not null,
  add column if not exists created_by_gallery_id uuid references public.accounts(id) on delete set null,
  add column if not exists is_claimed boolean default true not null,
  add column if not exists claimed_at timestamp with time zone;

comment on column public.user_profiles.user_id is 'User ID for claimed profiles. NULL for unclaimed artist profiles created by galleries.';
comment on column public.user_profiles.created_by_gallery_id is 'Gallery account ID that created this unclaimed artist profile';
comment on column public.user_profiles.is_claimed is 'Whether this profile has been claimed by an artist';
comment on column public.user_profiles.claimed_at is 'Timestamp when the profile was claimed';

-- Update existing profiles to be marked as claimed
update public.user_profiles
set is_claimed = true
where user_id is not null;

-- Create artist_profile_claims table for claim requests
create table if not exists public.artist_profile_claims (
    id uuid unique not null default extensions.uuid_generate_v4(),
    profile_id uuid not null references public.user_profiles(id) on delete cascade,
    artist_user_id uuid not null references auth.users(id) on delete cascade,
    gallery_id uuid not null references public.accounts(id) on delete cascade,
    status varchar(50) not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    message text, -- Optional message from artist
    gallery_response text, -- Optional response from gallery
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    primary key (id),
    unique(profile_id, artist_user_id) -- One claim per artist per profile
);

comment on table public.artist_profile_claims is 'Artist profile claim requests. Artists request to claim profiles, galleries approve/reject.';
comment on column public.artist_profile_claims.profile_id is 'The unclaimed artist profile being claimed';
comment on column public.artist_profile_claims.artist_user_id is 'The artist user requesting to claim the profile';
comment on column public.artist_profile_claims.gallery_id is 'The gallery that created the profile and needs to approve';
comment on column public.artist_profile_claims.status is 'Claim status: pending, approved, rejected';

-- Create indexes
create index if not exists artist_profile_claims_profile_id_idx on public.artist_profile_claims(profile_id);
create index if not exists artist_profile_claims_artist_user_id_idx on public.artist_profile_claims(artist_user_id);
create index if not exists artist_profile_claims_gallery_id_idx on public.artist_profile_claims(gallery_id);
create index if not exists artist_profile_claims_status_idx on public.artist_profile_claims(status);
create index if not exists user_profiles_is_claimed_idx on public.user_profiles(is_claimed);
create index if not exists user_profiles_created_by_gallery_id_idx on public.user_profiles(created_by_gallery_id);

-- Enable RLS on artist_profile_claims
alter table public.artist_profile_claims enable row level security;

-- RLS Policies for artist_profile_claims
drop policy if exists artist_profile_claims_read_own on public.artist_profile_claims;
drop policy if exists artist_profile_claims_read_gallery on public.artist_profile_claims;
drop policy if exists artist_profile_claims_insert_own on public.artist_profile_claims;
drop policy if exists artist_profile_claims_update_gallery on public.artist_profile_claims;

-- Artists can read their own claims
create policy artist_profile_claims_read_own on public.artist_profile_claims
    for select
    to authenticated
    using (
        artist_user_id = (select auth.uid())
    );

-- Galleries can read claims for profiles they created
create policy artist_profile_claims_read_gallery on public.artist_profile_claims
    for select
    to authenticated
    using (
        gallery_id in (
            select id from public.accounts
            where id = (select auth.uid())
        )
    );

-- Artists can create claims for unclaimed profiles
create policy artist_profile_claims_insert_own on public.artist_profile_claims
    for insert
    to authenticated
    with check (
        artist_user_id = (select auth.uid())
        and status = 'pending'
    );

-- Galleries can update (approve/reject) claims for profiles they created
create policy artist_profile_claims_update_gallery on public.artist_profile_claims
    for update
    to authenticated
    using (
        gallery_id in (
            select id from public.accounts
            where id = (select auth.uid())
        )
    )
    with check (
        gallery_id in (
            select id from public.accounts
            where id = (select auth.uid())
        )
    );

-- Grant permissions
grant select, insert, update on table public.artist_profile_claims to authenticated;

-- Function to update updated_at timestamp
create or replace function update_artist_profile_claims_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
drop trigger if exists update_artist_profile_claims_updated_at_trigger on public.artist_profile_claims;
create trigger update_artist_profile_claims_updated_at_trigger
    before update on public.artist_profile_claims
    for each row
    execute function update_artist_profile_claims_updated_at();

-- Update RLS policy for user_profiles to allow galleries to create unclaimed profiles
-- We need to allow galleries to insert profiles with null user_id
drop policy if exists user_profiles_insert_own on public.user_profiles;
create policy user_profiles_insert_own on public.user_profiles
    for insert
    to authenticated
    with check (
        -- Users can create their own profiles (user_id matches)
        (user_id = (select auth.uid()))
        OR
        -- Galleries can create unclaimed artist profiles (user_id is null, role is artist, created_by_gallery_id matches)
        (
            user_id is null
            and role = 'artist'
            and created_by_gallery_id in (
                select id from public.accounts
                where id = (select auth.uid())
            )
        )
    );


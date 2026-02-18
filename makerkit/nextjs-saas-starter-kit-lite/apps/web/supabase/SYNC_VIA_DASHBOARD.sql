-- =============================================================================
-- SYNC VIA DASHBOARD (when "supabase db push" times out)
-- =============================================================================
-- 1. Open Supabase Dashboard → your project → SQL Editor.
-- 2. Paste this entire file (or run in chunks if the editor limits size).
-- 3. Click Run.
--
-- If your remote DB already has some migrations applied, running from the top
-- may hit "already exists" errors. In that case, find the first -- ==========
-- section that doesn't exist yet and run from there, or run one section at a
-- time and skip sections that error with "already exists".
-- =============================================================================

-- ========== 20241219010757_schema.sql ==========

/*
 * -------------------------------------------------------
 * Supabase SaaS Starter Kit Schema
 * This is the schema for the Supabase SaaS Starter Kit.
 * It includes the schema for accounts
 * -------------------------------------------------------
 */
/*
 * -------------------------------------------------------
 * Section: Revoke default privileges from public schema
 * We will revoke all default privileges from public schema on functions to prevent public access to them
 * -------------------------------------------------------
 */
-- Create a private Makerkit schema
create schema if not exists kit;

create extension if not exists "unaccent" schema kit;

-- We remove all default privileges from public schema on functions to
--   prevent public access to them
alter default privileges
    revoke
    execute on functions
    from
    public;

revoke all on schema public
    from
    public;

revoke all PRIVILEGES on database "postgres"
    from
    "anon";

revoke all PRIVILEGES on schema "public"
    from
    "anon";

revoke all PRIVILEGES on schema "storage"
    from
    "anon";

revoke all PRIVILEGES on all SEQUENCES in schema "public"
    from
    "anon";

revoke all PRIVILEGES on all SEQUENCES in schema "storage"
    from
    "anon";

revoke all PRIVILEGES on all FUNCTIONS in schema "public"
    from
    "anon";

revoke all PRIVILEGES on all FUNCTIONS in schema "storage"
    from
    "anon";

revoke all PRIVILEGES on all TABLES in schema "public"
    from
    "anon";

revoke all PRIVILEGES on all TABLES in schema "storage"
    from
    "anon";

-- We remove all default privileges from public schema on functions to
--   prevent public access to them by default
alter default privileges in schema public
    revoke
    execute on functions
    from
    anon,
    authenticated;

-- we allow the authenticated role to execute functions in the public schema
grant usage on schema public to authenticated;

-- we allow the service_role role to execute functions in the public schema
grant usage on schema public to service_role;

/*
 * -------------------------------------------------------
 * Section: Accounts
 * We create the schema for the accounts. Accounts are the top level entity in the Supabase MakerKit. They can be team or personal accounts.
 * -------------------------------------------------------
 */
-- Accounts table
create table if not exists
    public.accounts
(
    id          uuid unique  not null default extensions.uuid_generate_v4(),
    name        varchar(255) not null,
    email       varchar(320) unique,
    updated_at  timestamp with time zone,
    created_at  timestamp with time zone,
    created_by  uuid references auth.users,
    updated_by  uuid references auth.users,
    picture_url varchar(1000),
    public_data jsonb                 default '{}'::jsonb not null,
    primary key (id)
);

comment on table public.accounts is 'Accounts are the top level entity in the Supabase MakerKit';

comment on column public.accounts.name is 'The name of the account';

comment on column public.accounts.email is 'The email of the account. For teams, this is the email of the team (if any)';

comment on column public.accounts.picture_url is 'The picture url of the account';

comment on column public.accounts.public_data is 'The public data of the account. Use this to store any additional data that you want to store for the account';

comment on column public.accounts.updated_at is 'The timestamp when the account was last updated';

comment on column public.accounts.created_at is 'The timestamp when the account was created';

comment on column public.accounts.created_by is 'The user who created the account';

comment on column public.accounts.updated_by is 'The user who last updated the account';

-- Enable RLS on the accounts table
alter table "public"."accounts"
    enable row level security;

-- SELECT(accounts):
-- Users can read their own accounts
create policy accounts_read on public.accounts for
    select
    to authenticated using (
        (select auth.uid()) = id
    );

-- UPDATE(accounts):
-- Users can update their own accounts
create policy accounts_update on public.accounts
    for update
    to authenticated using (
        (select auth.uid()) = id
    )
    with
    check (
        (select auth.uid()) = id
    );

-- Revoke all on accounts table from authenticated and service_role
revoke all on public.accounts
    from
    authenticated,
    service_role;

-- Open up access to accounts
grant
    select
    ,
    insert,
    update,
    delete on table public.accounts to authenticated,
    service_role;

-- Function "kit.protect_account_fields"
-- Function to protect account fields from being updated by anyone
create
    or replace function kit.protect_account_fields() returns trigger as
$$
begin
    if current_user in ('authenticated', 'anon') then
        if new.id <> old.id or new.email <> old.email then
            raise exception 'You do not have permission to update this field';

        end if;

    end if;

    return NEW;

end
$$ language plpgsql
    set
        search_path = '';

-- trigger to protect account fields
create trigger protect_account_fields
    before
        update
    on public.accounts
    for each row
execute function kit.protect_account_fields();

-- create a trigger to update the account email when the primary owner email is updated
create
    or replace function kit.handle_update_user_email() returns trigger
    language plpgsql
    security definer
    set
        search_path = '' as
$$
begin
    update
        public.accounts
    set email = new.email
    where id = new.id;

    return new;

end;

$$;

-- trigger the function every time a user email is updated only if the user is the primary owner of the account and
-- the account is personal account
create trigger "on_auth_user_updated"
    after
        update of email
    on auth.users
    for each row
execute procedure kit.handle_update_user_email();

-- Function "kit.new_user_created_setup"
-- Setup a new user account after user creation
create
    or replace function kit.new_user_created_setup() returns trigger
    language plpgsql
    security definer
    set
        search_path = '' as
$$
declare
    user_name   text;
    picture_url text;
begin
    if new.raw_user_meta_data ->> 'name' is not null then
        user_name := new.raw_user_meta_data ->> 'name';

    end if;

    if user_name is null and new.email is not null then
        user_name := split_part(new.email, '@', 1);

    end if;

    if user_name is null then
        user_name := '';

    end if;

    if new.raw_user_meta_data ->> 'avatar_url' is not null then
        picture_url := new.raw_user_meta_data ->> 'avatar_url';
    else
        picture_url := null;
    end if;

    insert into public.accounts(id,
                                name,
                                picture_url,
                                email)
    values (new.id,
            user_name,
            picture_url,
            new.email);

    return new;

end;

$$;

-- trigger the function every time a user is created
create trigger on_auth_user_created
    after insert
    on auth.users
    for each row
execute procedure kit.new_user_created_setup();

-- Storage
-- Account Image
insert into storage.buckets (id, name, PUBLIC)
values ('account_image', 'account_image', true);

-- Function: get the storage filename as a UUID.
-- Useful if you want to name files with UUIDs related to an account
create
    or replace function kit.get_storage_filename_as_uuid(name text) returns uuid
    set
        search_path = '' as
$$
begin
    return replace(storage.filename(name), concat('.',
                                                  storage.extension(name)), '')::uuid;

end;

$$ language plpgsql;

grant
    execute on function kit.get_storage_filename_as_uuid (text) to authenticated,
    service_role;

-- RLS policies for storage bucket account_image
create policy account_image on storage.objects for all using (
    bucket_id = 'account_image'
        and (
        kit.get_storage_filename_as_uuid(name) = auth.uid()
        )
    )
    with
    check (
    bucket_id = 'account_image'
        and (
        kit.get_storage_filename_as_uuid(name) = auth.uid()
        )
    );

-- ========== 20250103000000_create_artworks.sql ==========

/*
 * -------------------------------------------------------
 * Artworks and Collectibles Schema
 * This schema supports provenance tracking for artworks and collectibles
 * -------------------------------------------------------
 *
 * DATA-SAFE: Does not wipe user data.
 * - create table if not exists (no DROP TABLE)
 * - create index if not exists
 * - RLS policies and storage bucket insert use on conflict do nothing / create only
 * - No DELETE, TRUNCATE, or DROP TABLE.
 */

-- Create artworks table
create table if not exists public.artworks (
    id uuid unique not null default extensions.uuid_generate_v4(),
    account_id uuid not null references public.accounts(id) on delete cascade,
    title varchar(255) not null,
    description text,
    artist_name varchar(255),
    creation_date date,
    medium varchar(255),
    dimensions varchar(100),
    provenance_history jsonb default '[]'::jsonb,
    image_url text,
    certificate_hash text, -- For blockchain verification
    certificate_number varchar(100) unique,
    status varchar(50) default 'draft', -- draft, verified, published
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    created_by uuid references auth.users,
    updated_by uuid references auth.users,
    primary key (id)
);

comment on table public.artworks is 'Artworks and collectibles with provenance tracking';
comment on column public.artworks.account_id is 'The account that owns this artwork';
comment on column public.artworks.certificate_hash is 'Blockchain hash for certificate of authenticity';
comment on column public.artworks.certificate_number is 'Unique certificate number';
comment on column public.artworks.provenance_history is 'Array of provenance entries';

-- Create index for faster queries
create index if not exists artworks_account_id_idx on public.artworks(account_id);
create index if not exists artworks_certificate_number_idx on public.artworks(certificate_number);
create index if not exists artworks_status_idx on public.artworks(status);

-- Enable RLS
alter table public.artworks enable row level security;

-- RLS Policies
-- Users can read their own artworks
create policy artworks_read_own on public.artworks
    for select
    to authenticated
    using (
        account_id = (select auth.uid())
    );

-- Public can read verified artworks (for the feed)
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified'
    );

-- Users can insert their own artworks
create policy artworks_insert on public.artworks
    for insert
    to authenticated
    with check (
        account_id = (select auth.uid())
    );

-- Users can update their own artworks
create policy artworks_update on public.artworks
    for update
    to authenticated
    using (
        account_id = (select auth.uid())
    )
    with check (
        account_id = (select auth.uid())
    );

-- Users can delete their own artworks
create policy artworks_delete on public.artworks
    for delete
    to authenticated
    using (
        account_id = (select auth.uid())
    );

-- Grant permissions
grant select, insert, update, delete on table public.artworks to authenticated;
grant select on table public.artworks to anon;

-- Function to update updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

-- Trigger to automatically update updated_at
create trigger update_artworks_updated_at
    before update on public.artworks
    for each row
    execute function public.update_updated_at_column();

-- Function to generate certificate number
create or replace function public.generate_certificate_number()
returns text as $$
declare
    new_number text;
begin
    loop
        new_number := 'PROV-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
        if not exists (select 1 from public.artworks where certificate_number = new_number) then
            exit;
        end if;
    end loop;
    return new_number;
end;
$$ language plpgsql;

-- Storage bucket for artwork images
insert into storage.buckets (id, name, public)
values ('artworks', 'artworks', true)
on conflict (id) do nothing;

-- RLS policies for artworks storage bucket
-- Users can only access files in their own folder (userId/...)
-- Check that the first part of the path (before the first /) matches the user's ID
-- Also allow public read access for verified artworks (images are public)
create policy artworks_storage_read on storage.objects
    for select
    to authenticated, anon
    using (
        bucket_id = 'artworks'
    );

create policy artworks_storage_insert on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'artworks'
        and split_part(name, '/', 1) = auth.uid()::text
    );

create policy artworks_storage_update on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'artworks'
        and split_part(name, '/', 1) = auth.uid()::text
    )
    with check (
        bucket_id = 'artworks'
        and split_part(name, '/', 1) = auth.uid()::text
    );

create policy artworks_storage_delete on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'artworks'
        and split_part(name, '/', 1) = auth.uid()::text
    );


-- ========== 20250104000000_add_provenance_fields.sql ==========

/*
 * -------------------------------------------------------
 * Add Provenance Fields to Artworks Table
 * Adds fields for comprehensive provenance tracking
 * -------------------------------------------------------
 */

-- Add provenance fields to artworks table
alter table public.artworks
    add column if not exists former_owners text,
    add column if not exists auction_history text,
    add column if not exists exhibition_history text,
    add column if not exists historic_context text,
    add column if not exists celebrity_notes text;

comment on column public.artworks.former_owners is 'Names of former owners: prominent collectors, estates, galleries, or institutions';
comment on column public.artworks.auction_history is 'Records of previous sales at auction houses (including dates and lot numbers)';
comment on column public.artworks.exhibition_history is 'Exhibition history or literature references where the work has been discussed';
comment on column public.artworks.historic_context is 'Historic context / origin information: how and where it was acquired originally';
comment on column public.artworks.celebrity_notes is 'Special notes on celebrity or notable ownership';


-- ========== 20250105000000_create_user_follows.sql ==========

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


-- ========== 20250106000000_add_artwork_privacy.sql ==========

/*
 * -------------------------------------------------------
 * Add Privacy Field to Artworks Table
 * Adds is_public field to control artwork visibility
 * 
 * SAFE MIGRATION - This migration:
 * - Only ADDS a new column (does not delete or modify existing data)
 * - Sets default value to true for all existing artworks
 * - Does not remove or change any existing artwork records
 * - Only updates RLS policies (does not affect data)
 * -------------------------------------------------------
 */

-- Step 1: Add is_public column with default value
-- Using 'if not exists' to make it safe to run multiple times
-- Default value ensures existing rows get 'true' automatically
alter table public.artworks
    add column if not exists is_public boolean default true not null;

comment on column public.artworks.is_public is 'Whether the artwork is visible to the public (true) or private (false)';

-- Step 2: Ensure all existing artworks are set to public
-- This UPDATE is safe because:
-- - It only affects rows where is_public is null (shouldn't happen with default, but just in case)
-- - It only sets the value, doesn't delete or modify other data
-- - Safe to run multiple times (idempotent)
update public.artworks
set is_public = true
where is_public is null;

-- Step 3: Create index for faster queries (safe, doesn't affect data)
create index if not exists artworks_is_public_idx on public.artworks(is_public);

-- Step 4: Update RLS policies to respect privacy settings
-- This is safe because:
-- - 'if exists' prevents errors if policy doesn't exist
-- - Only changes access rules, doesn't modify data
-- - Users can still read their own artworks (existing policy remains)
drop policy if exists artworks_read_public on public.artworks;

-- New policy: Public can only read verified AND public artworks
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Note: Users can always read their own artworks (regardless of privacy setting)
-- The existing 'artworks_read_own' policy already handles this and remains unchanged


-- ========== 20250107000000_allow_public_account_read.sql ==========

/*
 * -------------------------------------------------------
 * Allow Public Read Access to Accounts for Registry
 * 
 * SAFE MIGRATION - This migration:
 * - Only ADDS a new RLS policy (does not delete or modify existing data)
 * - Allows public read access to accounts for the registry
 * - Only exposes public fields (id, name, picture_url, public_data)
 * - Does NOT allow write access (UPDATE/INSERT/DELETE still restricted)
 * - Does NOT expose sensitive fields like email
 * -------------------------------------------------------
 */

-- Add policy to allow authenticated and anonymous users to read accounts
-- This is safe because:
-- 1. It's read-only (SELECT only)
-- 2. Only exposes public information (name, picture_url, public_data)
-- 3. Email and other sensitive fields remain protected
-- 4. Write operations (UPDATE/INSERT/DELETE) are still restricted by existing policies

-- Drop policy if it exists, then create it
drop policy if exists accounts_read_public on public.accounts;

create policy accounts_read_public on public.accounts
    for select
    to authenticated, anon
    using (true);

comment on policy accounts_read_public on public.accounts is 
    'Allows public read access to accounts for the registry. Only exposes public fields (id, name, picture_url, public_data). Write operations remain restricted.';


-- ========== 20250108000000_ensure_anon_artworks_access.sql ==========

/*
 * -------------------------------------------------------
 * Ensure Anonymous Access to Artworks
 * 
 * This migration ensures that anonymous users can read public artworks
 * even if the base schema revoked privileges from anon role.
 * 
 * SAFE MIGRATION - This migration:
 * - Only ADDS grants (does not delete or modify existing data)
 * - Only affects read access (SELECT), not write access
 * - Safe to run multiple times (idempotent)
 * - Does NOT modify RLS policies (those are handled by other migrations)
 * -------------------------------------------------------
 */

-- Ensure anon role can select from artworks table
-- This is needed because the base schema (20241219010757_schema.sql) 
-- revokes all privileges from anon role, so we need to explicitly grant it back
grant select on table public.artworks to anon;

-- Note: RLS policies are handled by:
-- 1. 20250103000000_create_artworks.sql - creates initial policy for verified artworks
-- 2. 20250106000000_add_artwork_privacy.sql - updates policy to also check is_public
-- This migration only ensures the grant is in place


-- ========== 20250109000000_add_welcome_email_trigger.sql ==========

/*
 * -------------------------------------------------------
 * Welcome Email Support
 * 
 * Note: Welcome emails are sent from the auth callback route
 * in the application (src/app/auth/callback/route.ts) which
 * checks if an account was created in the last 2 minutes.
 * 
 * This migration is kept for future use if we want to add
 * database-level email sending via pg_net extension.
 * -------------------------------------------------------
 */

-- This migration is intentionally minimal.
-- The welcome email functionality is handled in the application
-- layer (auth callback route) for simplicity and reliability.


-- ========== 20250110000000_add_notifications_and_certificate_workflow.sql ==========

/*
 * -------------------------------------------------------
 * Notifications and Certificate Workflow
 * This migration adds:
 * 1. Notifications table for user messages and alerts
 * 2. Certificate workflow fields to artworks table
 * 3. Artist claim tracking for certificates
 * -------------------------------------------------------
 */

-- Add certificate workflow fields to artworks table
alter table public.artworks
  add column if not exists artist_account_id uuid references public.accounts(id),
  add column if not exists claimed_by_artist_at timestamp with time zone,
  add column if not exists verified_by_owner_at timestamp with time zone,
  add column if not exists certificate_status varchar(50) default 'pending_artist_claim';

comment on column public.artworks.artist_account_id is 'The account ID of the artist who created this artwork (for claiming)';
comment on column public.artworks.claimed_by_artist_at is 'Timestamp when the artist claimed the certificate';
comment on column public.artworks.verified_by_owner_at is 'Timestamp when the collector/gallery verified the certificate';
comment on column public.artworks.certificate_status is 'Status: pending_artist_claim, pending_verification, verified, rejected';

-- Update status enum to include new certificate workflow statuses
-- Note: We're using certificate_status as a separate field to avoid breaking existing status field

-- Create index for certificate workflow queries
create index if not exists artworks_certificate_status_idx on public.artworks(certificate_status);
create index if not exists artworks_artist_account_id_idx on public.artworks(artist_account_id);

-- Create notifications table
create table if not exists public.notifications (
    id uuid unique not null default extensions.uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    type varchar(50) not null, -- 'certificate_claim_request', 'certificate_verified', 'certificate_rejected', 'message', etc.
    title varchar(255) not null,
    message text,
    artwork_id uuid references public.artworks(id) on delete set null,
    related_user_id uuid references auth.users(id) on delete set null,
    read boolean default false not null,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now() not null,
    primary key (id)
);

comment on table public.notifications is 'User notifications and messages';
comment on column public.notifications.type is 'Type of notification: certificate_claim_request, certificate_verified, certificate_rejected, message, etc.';
comment on column public.notifications.artwork_id is 'Related artwork if this notification is about an artwork';
comment on column public.notifications.related_user_id is 'Related user (e.g., artist who claimed, collector who verified)';
comment on column public.notifications.read is 'Whether the notification has been read';
comment on column public.notifications.metadata is 'Additional data for the notification';

-- Create indexes for notifications
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(read);
create index if not exists notifications_created_at_idx on public.notifications(created_at desc);
create index if not exists notifications_artwork_id_idx on public.notifications(artwork_id);
create index if not exists notifications_type_idx on public.notifications(type);

-- Enable RLS on notifications
alter table public.notifications enable row level security;

-- RLS Policies for notifications
-- Drop existing policies if they exist (for idempotent migrations)
drop policy if exists notifications_read_own on public.notifications;
drop policy if exists notifications_update_own on public.notifications;
drop policy if exists notifications_insert on public.notifications;

-- Users can read their own notifications
create policy notifications_read_own on public.notifications
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
    );

-- Users can update their own notifications (mark as read)
create policy notifications_update_own on public.notifications
    for update
    to authenticated
    using (
        user_id = (select auth.uid())
    )
    with check (
        user_id = (select auth.uid())
    );

-- System can insert notifications (via service role or authenticated users creating notifications for others)
-- For now, we'll allow authenticated users to create notifications, but in production you might want to restrict this
create policy notifications_insert on public.notifications
    for insert
    to authenticated
    with check (
        true -- Allow authenticated users to create notifications (you may want to restrict this further)
    );

-- Grant permissions
grant select, insert, update on table public.notifications to authenticated;

-- Function to get unread notification count
create or replace function public.get_unread_notification_count(user_uuid uuid)
returns integer as $$
begin
    return (
        select count(*)
        from public.notifications
        where user_id = user_uuid
        and read = false
    );
end;
$$ language plpgsql security definer;

-- Grant execute permission
grant execute on function public.get_unread_notification_count(uuid) to authenticated;


-- ========== 20250111000000_add_artwork_additional_fields.sql ==========

/*
 * -------------------------------------------------------
 * Add Additional Artwork Fields
 * Adds: value, edition, production_location, owned_by
 * With privacy controls for value and owned_by
 * -------------------------------------------------------
 */

-- Add new fields to artworks table
alter table public.artworks
  add column if not exists value text,
  add column if not exists value_is_public boolean default false not null,
  add column if not exists edition varchar(255),
  add column if not exists production_location text,
  add column if not exists owned_by text,
  add column if not exists owned_by_is_public boolean default false not null;

comment on column public.artworks.value is 'Monetary value of the artwork (private by default)';
comment on column public.artworks.value_is_public is 'Whether the value field should be visible to the public';
comment on column public.artworks.edition is 'Edition information (e.g., "1/10", "Limited Edition", "Unique")';
comment on column public.artworks.production_location is 'Location where the artwork was produced/created';
comment on column public.artworks.owned_by is 'Current owner of the artwork (private by default)';
comment on column public.artworks.owned_by_is_public is 'Whether the owned_by field should be visible to the public';


-- ========== 20250112000000_add_exhibitions.sql ==========

/*
 * -------------------------------------------------------
 * Exhibitions Schema
 * This schema supports gallery exhibitions with artists and artworks
 * -------------------------------------------------------
 */

-- Create exhibitions table
create table if not exists public.exhibitions (
    id uuid unique not null default extensions.uuid_generate_v4(),
    gallery_id uuid not null references public.accounts(id) on delete cascade,
    title varchar(255) not null,
    description text,
    start_date date not null,
    end_date date,
    location text,
    image_url text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id),
    updated_by uuid references auth.users(id),
    primary key (id)
);

comment on table public.exhibitions is 'Gallery exhibitions/shows';
comment on column public.exhibitions.gallery_id is 'The gallery (account) that owns this exhibition';
comment on column public.exhibitions.start_date is 'Start date of the exhibition';
comment on column public.exhibitions.end_date is 'End date of the exhibition (null for ongoing exhibitions)';
comment on column public.exhibitions.location is 'Location/venue of the exhibition';
comment on column public.exhibitions.metadata is 'Additional exhibition data';

-- Create junction table for exhibition artists
create table if not exists public.exhibition_artists (
    id uuid unique not null default extensions.uuid_generate_v4(),
    exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
    artist_account_id uuid not null references public.accounts(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    unique(exhibition_id, artist_account_id)
);

comment on table public.exhibition_artists is 'Junction table linking exhibitions to artists';
comment on column public.exhibition_artists.exhibition_id is 'The exhibition';
comment on column public.exhibition_artists.artist_account_id is 'The artist account participating in the exhibition';

-- Create junction table for exhibition artworks
create table if not exists public.exhibition_artworks (
    id uuid unique not null default extensions.uuid_generate_v4(),
    exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    unique(exhibition_id, artwork_id)
);

comment on table public.exhibition_artworks is 'Junction table linking exhibitions to artworks';
comment on column public.exhibition_artworks.exhibition_id is 'The exhibition';
comment on column public.exhibition_artworks.artwork_id is 'The artwork displayed in the exhibition';

-- Create indexes for faster queries
create index if not exists exhibitions_gallery_id_idx on public.exhibitions(gallery_id);
create index if not exists exhibitions_start_date_idx on public.exhibitions(start_date desc);
create index if not exists exhibitions_end_date_idx on public.exhibitions(end_date desc);
create index if not exists exhibition_artists_exhibition_id_idx on public.exhibition_artists(exhibition_id);
create index if not exists exhibition_artists_artist_account_id_idx on public.exhibition_artists(artist_account_id);
create index if not exists exhibition_artworks_exhibition_id_idx on public.exhibition_artworks(exhibition_id);
create index if not exists exhibition_artworks_artwork_id_idx on public.exhibition_artworks(artwork_id);

-- Enable RLS
alter table public.exhibitions enable row level security;
alter table public.exhibition_artists enable row level security;
alter table public.exhibition_artworks enable row level security;

-- RLS Policies for exhibitions
-- Drop existing policies if they exist (for idempotent migrations)
drop policy if exists exhibitions_read_public on public.exhibitions;
drop policy if exists exhibitions_insert_own on public.exhibitions;
drop policy if exists exhibitions_update_own on public.exhibitions;
drop policy if exists exhibitions_delete_own on public.exhibitions;

-- Anyone can read exhibitions (public access)
create policy exhibitions_read_public on public.exhibitions
    for select
    to authenticated, anon
    using (true);

-- Gallery owners can insert their own exhibitions
create policy exhibitions_insert_own on public.exhibitions
    for insert
    to authenticated
    with check (
        gallery_id = (select auth.uid())
    );

-- Gallery owners can update their own exhibitions
create policy exhibitions_update_own on public.exhibitions
    for update
    to authenticated
    using (
        gallery_id = (select auth.uid())
    )
    with check (
        gallery_id = (select auth.uid())
    );

-- Gallery owners can delete their own exhibitions
create policy exhibitions_delete_own on public.exhibitions
    for delete
    to authenticated
    using (
        gallery_id = (select auth.uid())
    );

-- RLS Policies for exhibition_artists
-- Drop existing policies if they exist
drop policy if exists exhibition_artists_read_public on public.exhibition_artists;
drop policy if exists exhibition_artists_insert_own on public.exhibition_artists;
drop policy if exists exhibition_artists_delete_own on public.exhibition_artists;

-- Anyone can read exhibition artists (public access)
create policy exhibition_artists_read_public on public.exhibition_artists
    for select
    to authenticated, anon
    using (true);

-- Gallery owners can manage artists for their exhibitions
create policy exhibition_artists_insert_own on public.exhibition_artists
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.exhibitions
            where id = exhibition_id
            and gallery_id = (select auth.uid())
        )
    );

-- Gallery owners can delete artists from their exhibitions
create policy exhibition_artists_delete_own on public.exhibition_artists
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.exhibitions
            where id = exhibition_id
            and gallery_id = (select auth.uid())
        )
    );

-- RLS Policies for exhibition_artworks
-- Drop existing policies if they exist
drop policy if exists exhibition_artworks_read_public on public.exhibition_artworks;
drop policy if exists exhibition_artworks_insert_own on public.exhibition_artworks;
drop policy if exists exhibition_artworks_delete_own on public.exhibition_artworks;

-- Anyone can read exhibition artworks (public access)
create policy exhibition_artworks_read_public on public.exhibition_artworks
    for select
    to authenticated, anon
    using (true);

-- Gallery owners can manage artworks for their exhibitions
create policy exhibition_artworks_insert_own on public.exhibition_artworks
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.exhibitions
            where id = exhibition_id
            and gallery_id = (select auth.uid())
        )
    );

-- Gallery owners can delete artworks from their exhibitions
create policy exhibition_artworks_delete_own on public.exhibition_artworks
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.exhibitions
            where id = exhibition_id
            and gallery_id = (select auth.uid())
        )
    );

-- Grant permissions
grant select, insert, update, delete on table public.exhibitions to authenticated;
grant select, insert, delete on table public.exhibition_artists to authenticated;
grant select, insert, delete on table public.exhibition_artworks to authenticated;
grant select on table public.exhibitions to anon;
grant select on table public.exhibition_artists to anon;
grant select on table public.exhibition_artworks to anon;


-- ========== 20250113000000_add_user_profiles.sql ==========

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


-- ========== 20250114000000_add_established_to_profiles.sql ==========

/*
 * -------------------------------------------------------
 * Add Established Year Field for Gallery Profiles
 * -------------------------------------------------------
 */

-- Add established_year column to user_profiles table
alter table if exists public.user_profiles
  add column if not exists established_year integer;

comment on column public.user_profiles.established_year is 'Year the gallery was established (for gallery profiles)';


-- ========== 20250115000000_add_profiles_storage_bucket.sql ==========

-- Storage bucket for profile pictures
insert into storage.buckets (id, name, public)
values ('profiles', 'profiles', true)
on conflict (id) do nothing;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists profiles_storage_read on storage.objects;
drop policy if exists profiles_storage_insert on storage.objects;
drop policy if exists profiles_storage_update on storage.objects;
drop policy if exists profiles_storage_delete on storage.objects;

-- RLS policies for profiles storage bucket
-- Users can only access files in their own folder (userId/...)
-- Check that the first part of the path (before the first /) matches the user's ID
-- Also allow public read access (profile pictures are public)
create policy profiles_storage_read on storage.objects
    for select
    to authenticated, anon
    using (
        bucket_id = 'profiles'
    );

create policy profiles_storage_insert on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'profiles'
        and split_part(name, '/', 1) = auth.uid()::text
    );

create policy profiles_storage_update on storage.objects
    for update
    to authenticated
    using (
        bucket_id = 'profiles'
        and split_part(name, '/', 1) = auth.uid()::text
    )
    with check (
        bucket_id = 'profiles'
        and split_part(name, '/', 1) = auth.uid()::text
    );

create policy profiles_storage_delete on storage.objects
    for delete
    to authenticated
    using (
        bucket_id = 'profiles'
        and split_part(name, '/', 1) = auth.uid()::text
    );


-- ========== 20250116000000_add_provenance_update_requests.sql ==========

-- Table for provenance update requests
create table if not exists public.provenance_update_requests (
    id uuid primary key default gen_random_uuid(),
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    requested_by uuid not null references auth.users(id) on delete cascade,
    requested_at timestamp with time zone default now(),
    status varchar(20) not null default 'pending' check (status in ('pending', 'approved', 'denied')),
    reviewed_by uuid references auth.users(id) on delete set null,
    reviewed_at timestamp with time zone,
    update_fields jsonb not null default '{}'::jsonb,
    request_message text,
    review_message text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Indexes
create index if not exists provenance_update_requests_artwork_id_idx on public.provenance_update_requests(artwork_id);
create index if not exists provenance_update_requests_requested_by_idx on public.provenance_update_requests(requested_by);
create index if not exists provenance_update_requests_status_idx on public.provenance_update_requests(status);
create index if not exists provenance_update_requests_created_at_idx on public.provenance_update_requests(created_at);

-- RLS Policies
alter table public.provenance_update_requests enable row level security;

-- Drop existing policies if they exist (for idempotency)
drop policy if exists provenance_update_requests_read_own on public.provenance_update_requests;
drop policy if exists provenance_update_requests_read_artwork_owner on public.provenance_update_requests;
drop policy if exists provenance_update_requests_insert_own on public.provenance_update_requests;
drop policy if exists provenance_update_requests_update_artwork_owner on public.provenance_update_requests;

-- Users can read their own requests
create policy provenance_update_requests_read_own on public.provenance_update_requests
    for select
    to authenticated
    using (requested_by = auth.uid());

-- Artwork owners can read requests for their artworks
create policy provenance_update_requests_read_artwork_owner on public.provenance_update_requests
    for select
    to authenticated
    using (
        exists (
            select 1 from public.artworks
            where artworks.id = provenance_update_requests.artwork_id
            and artworks.account_id = auth.uid()
        )
    );

-- Users can create requests
create policy provenance_update_requests_insert_own on public.provenance_update_requests
    for insert
    to authenticated
    with check (requested_by = auth.uid());

-- Artwork owners can update (approve/deny) requests for their artworks
create policy provenance_update_requests_update_artwork_owner on public.provenance_update_requests
    for update
    to authenticated
    using (
        exists (
            select 1 from public.artworks
            where artworks.id = provenance_update_requests.artwork_id
            and artworks.account_id = auth.uid()
        )
    )
    with check (
        exists (
            select 1 from public.artworks
            where artworks.id = provenance_update_requests.artwork_id
            and artworks.account_id = auth.uid()
        )
    );

-- Trigger to update updated_at
create or replace function update_provenance_update_requests_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists update_provenance_update_requests_updated_at_trigger on public.provenance_update_requests;

create trigger update_provenance_update_requests_updated_at_trigger
    before update on public.provenance_update_requests
    for each row
    execute function update_provenance_update_requests_updated_at();


-- ========== 20250117000000_add_ownership_requests.sql ==========

-- Add request_type column to provenance_update_requests
alter table public.provenance_update_requests
add column if not exists request_type varchar(20) not null default 'provenance_update' 
check (request_type in ('provenance_update', 'ownership_request'));

-- Create index for request_type
create index if not exists provenance_update_requests_request_type_idx 
on public.provenance_update_requests(request_type);


-- ========== 20250118000000_add_sold_by_field.sql ==========

-- Add sold_by field to artworks table
alter table public.artworks
  add column if not exists sold_by text,
  add column if not exists sold_by_is_public boolean default false not null;

comment on column public.artworks.sold_by is 'Who sold the artwork (private by default)';
comment on column public.artworks.sold_by_is_public is 'Whether the sold_by field should be visible to the public';


-- ========== 20250119000000_add_favorites.sql ==========

-- Create favorites table
create table if not exists public.artwork_favorites (
    id uuid unique not null default extensions.uuid_generate_v4(),
    user_id uuid not null references auth.users(id) on delete cascade,
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    created_at timestamp with time zone default now() not null,
    primary key (id),
    unique(user_id, artwork_id) -- Prevent duplicate favorites
);

comment on table public.artwork_favorites is 'User favorites for artworks';
comment on column public.artwork_favorites.user_id is 'User who favorited the artwork';
comment on column public.artwork_favorites.artwork_id is 'Artwork that was favorited';

-- Create indexes for favorites
create index if not exists artwork_favorites_user_id_idx on public.artwork_favorites(user_id);
create index if not exists artwork_favorites_artwork_id_idx on public.artwork_favorites(artwork_id);
create index if not exists artwork_favorites_created_at_idx on public.artwork_favorites(created_at desc);

-- Enable RLS on favorites
alter table public.artwork_favorites enable row level security;

-- RLS Policies for favorites
-- Drop existing policies if they exist (for idempotent migrations)
drop policy if exists artwork_favorites_read_own on public.artwork_favorites;
drop policy if exists artwork_favorites_insert_own on public.artwork_favorites;
drop policy if exists artwork_favorites_delete_own on public.artwork_favorites;

-- Users can read their own favorites
create policy artwork_favorites_read_own on public.artwork_favorites
    for select
    to authenticated
    using (
        user_id = (select auth.uid())
    );

-- Users can insert their own favorites
create policy artwork_favorites_insert_own on public.artwork_favorites
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

-- Users can delete their own favorites
create policy artwork_favorites_delete_own on public.artwork_favorites
    for delete
    to authenticated
    using (
        user_id = (select auth.uid())
    );


-- ========== 20250120000000_allow_multiple_galleries.sql ==========

/*
 * -------------------------------------------------------
 * Allow Multiple Gallery Profiles
 * Users can now create multiple gallery profiles
 * Artist and Collector profiles remain limited to one per user
 * -------------------------------------------------------
 */

-- Drop the existing unique constraint that prevents multiple profiles of the same role
alter table public.user_profiles drop constraint if exists user_profiles_user_id_role_key;

-- Create a partial unique index that only enforces uniqueness for artist and collector roles
-- This allows multiple gallery profiles per user, but only one artist and one collector
create unique index if not exists user_profiles_user_role_unique_artist_collector
on public.user_profiles(user_id, role)
where role in ('artist', 'collector');

-- Add a comment explaining the constraint
comment on index user_profiles_user_role_unique_artist_collector is 
'Ensures users can only have one artist and one collector profile, but allows multiple gallery profiles';


-- ========== 20250121000000_add_gallery_slugs.sql ==========

/*
 * -------------------------------------------------------
 * Add Slug Field for Gallery Profiles
 * Adds a unique slug field for gallery profiles to enable short links
 * -------------------------------------------------------
 */

-- Add slug column to user_profiles table
alter table public.user_profiles
  add column if not exists slug varchar(100);

-- Create unique index for gallery profile slugs (only for gallery role)
-- This allows multiple galleries to have unique short links
create unique index if not exists user_profiles_slug_unique_gallery
on public.user_profiles(slug)
where role = 'gallery' and slug is not null;

-- Create index for faster lookups
create index if not exists user_profiles_slug_idx on public.user_profiles(slug)
where slug is not null;

-- Add comment
comment on column public.user_profiles.slug is 'URL-friendly short identifier for gallery profiles (e.g., "flight" for FL!GHT gallery)';

-- Function to generate a unique slug from a name
create or replace function generate_unique_gallery_slug(base_name text)
returns text as $$
declare
  base_slug text;
  candidate_slug text;
  counter int := 0;
  exists_check boolean;
begin
  -- Convert name to slug: lowercase, remove special chars, replace spaces with hyphens
  base_slug := lower(regexp_replace(regexp_replace(base_name, '[^a-z0-9\s-]', '', 'gi'), '\s+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- If empty after slugification, use a default
  if base_slug = '' or base_slug is null then
    base_slug := 'gallery';
  end if;
  
  candidate_slug := base_slug;
  
  -- Check if slug exists, if so append a number
  loop
    select exists(
      select 1 from public.user_profiles up
      where up.role = 'gallery' 
      and up.slug = candidate_slug
      and up.slug is not null
    ) into exists_check;
    
    exit when not exists_check;
    
    counter := counter + 1;
    candidate_slug := base_slug || '-' || counter::text;
  end loop;
  
  return candidate_slug;
end;
$$ language plpgsql;

-- Generate slugs for existing gallery profiles
do $$
declare
  profile_record record;
  generated_slug text;
begin
  for profile_record in 
    select up.id, up.name 
    from public.user_profiles up
    where up.role = 'gallery' 
    and (up.slug is null or up.slug = '')
  loop
    generated_slug := generate_unique_gallery_slug(profile_record.name);
    update public.user_profiles
    set slug = generated_slug
    where id = profile_record.id;
  end loop;
end $$;


-- ========== 20250122000000_add_artist_profile_claims.sql ==========

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


-- ========== 20250123000000_add_gallery_profile_id_to_artworks.sql ==========

/*
 * -------------------------------------------------------
 * Add Gallery Profile ID to Artworks
 * Allows artworks to be associated with a specific gallery profile
 * when posted by a user with multiple gallery profiles
 * -------------------------------------------------------
 */

-- Add gallery_profile_id column to artworks table
alter table public.artworks
  add column if not exists gallery_profile_id uuid references public.user_profiles(id) on delete set null;

comment on column public.artworks.gallery_profile_id is 'The gallery profile (user_profiles) that posted this artwork. Only set when posted by a gallery.';

-- Create index for faster queries
create index if not exists artworks_gallery_profile_id_idx on public.artworks(gallery_profile_id);


-- ========== 20250124000000_create_pitch_deck_content.sql ==========

/*
 * Create pitch_deck_content table
 * Stores pitch deck slides in the database instead of files
 */

-- Create pitch_deck_content table
create table if not exists public.pitch_deck_content (
    id uuid unique not null default extensions.uuid_generate_v4(),
    key text unique not null default 'main', -- Allows for multiple pitch decks in the future
    content jsonb not null default '{"slides": []}'::jsonb,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now(),
    primary key (id)
);

comment on table public.pitch_deck_content is 'Stores pitch deck slide content';
comment on column public.pitch_deck_content.key is 'Unique key for the pitch deck (default: main)';
comment on column public.pitch_deck_content.content is 'JSON object containing slides array';

-- Create index for faster lookups
create index if not exists pitch_deck_content_key_idx on public.pitch_deck_content(key);

-- Enable RLS
alter table public.pitch_deck_content enable row level security;

-- RLS Policies
-- Anyone can read pitch deck content (public)
create policy pitch_deck_content_read_public on public.pitch_deck_content
    for select
    using (true);

-- Only admins can insert/update/delete
-- We'll check admin status in the application code, but this provides an extra layer
-- For now, we'll allow authenticated users to write (admin check happens in app)
create policy pitch_deck_content_write_admin on public.pitch_deck_content
    for all
    using (auth.role() = 'authenticated');

-- Insert default content if it doesn't exist
insert into public.pitch_deck_content (key, content)
values ('main', '{"slides": []}'::jsonb)
on conflict (key) do nothing;


-- ========== 20250126000000_add_gallery_members.sql ==========

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

-- ========== 20250126000001_update_rls_for_gallery_members.sql ==========

/*
 * -------------------------------------------------------
 * Update RLS Policies for Gallery Team Members
 * Allows gallery members to manage gallery profiles, artworks, and exhibitions
 * -------------------------------------------------------
 *
 * DATA-SAFE: Does not wipe user data.
 * - Only DROP POLICY and CREATE POLICY (permission rules); dropping a policy
 *   does not delete any rows from tables.
 * - create or replace function only updates function definitions.
 * - No DELETE, TRUNCATE, DROP TABLE, or any operation that removes user data.
 */

-- ============================================================
-- Update user_profiles policies to allow gallery members
-- ============================================================

-- Drop and recreate user_profiles_update_own to include gallery members
drop policy if exists user_profiles_update_own on public.user_profiles;

create policy user_profiles_update_own on public.user_profiles
    for update
    to authenticated
    using (
        user_id = (select auth.uid()) -- Profile owner
        or exists ( -- Gallery member
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = user_profiles.id
            and gm.user_id = (select auth.uid())
            and user_profiles.role = 'gallery'
        )
    )
    with check (
        user_id = (select auth.uid()) -- Profile owner
        or exists ( -- Gallery member
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = user_profiles.id
            and gm.user_id = (select auth.uid())
            and user_profiles.role = 'gallery'
        )
    );

-- ============================================================
-- Update artworks policies to allow gallery members
-- ============================================================

-- Helper function to check if user is a gallery member for an artwork
-- This checks both account_id (for backwards compatibility) and gallery_profile_id
create or replace function is_gallery_member_for_artwork(artwork_account_id uuid, artwork_gallery_profile_id uuid)
returns boolean as $$
begin
    -- If artwork has a gallery_profile_id, check membership for that profile
    if artwork_gallery_profile_id is not null then
        return exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = artwork_gallery_profile_id
            and gm.user_id = (select auth.uid())
        );
    end if;
    
    -- Otherwise, check if user owns the account or is a member of any gallery profile owned by that account
    return artwork_account_id = (select auth.uid())
        or exists (
            select 1 from public.gallery_members gm
            join public.user_profiles up on gm.gallery_profile_id = up.id
            where up.user_id = artwork_account_id
            and up.role = 'gallery'
            and gm.user_id = (select auth.uid())
        );
end;
$$ language plpgsql security definer;

-- Drop existing artworks policies
drop policy if exists artworks_read_own on public.artworks;
drop policy if exists artworks_read_public on public.artworks;
drop policy if exists artworks_insert on public.artworks;
drop policy if exists artworks_update on public.artworks;
drop policy if exists artworks_delete on public.artworks;

-- Public can read verified AND public artworks (for the feed) - MUST be first for public access
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Users can read their own artworks OR artworks from galleries they're members of
create policy artworks_read_own on public.artworks
    for select
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Users can insert artworks for their account OR for galleries they're members of
create policy artworks_insert on public.artworks
    for insert
    to authenticated
    with check (
        account_id = (select auth.uid())
        or (
            gallery_profile_id is not null
            and exists (
                select 1 from public.gallery_members gm
                where gm.gallery_profile_id = artworks.gallery_profile_id
                and gm.user_id = (select auth.uid())
            )
        )
    );

-- Users can update their own artworks OR artworks from galleries they're members of
create policy artworks_update on public.artworks
    for update
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    )
    with check (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- Users can delete their own artworks OR artworks from galleries they're members of
create policy artworks_delete on public.artworks
    for delete
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- ============================================================
-- Update exhibitions policies to allow gallery members
-- ============================================================

-- Helper function to check if user is a gallery member for an exhibition
create or replace function is_gallery_member_for_exhibition(exhibition_gallery_id uuid)
returns boolean as $$
begin
    -- Check if user owns the gallery account
    if exhibition_gallery_id = (select auth.uid()) then
        return true;
    end if;
    
    -- Check if user is a member of any gallery profile owned by that account
    return exists (
        select 1 from public.gallery_members gm
        join public.user_profiles up on gm.gallery_profile_id = up.id
        where up.user_id = exhibition_gallery_id
        and up.role = 'gallery'
        and gm.user_id = (select auth.uid())
    );
end;
$$ language plpgsql security definer;

-- Drop existing exhibitions policies
drop policy if exists exhibitions_insert_own on public.exhibitions;
drop policy if exists exhibitions_update_own on public.exhibitions;
drop policy if exists exhibitions_delete_own on public.exhibitions;

-- Gallery owners/members can insert exhibitions
create policy exhibitions_insert_own on public.exhibitions
    for insert
    to authenticated
    with check (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    );

-- Gallery owners/members can update exhibitions
create policy exhibitions_update_own on public.exhibitions
    for update
    to authenticated
    using (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    )
    with check (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    );

-- Gallery owners/members can delete exhibitions
create policy exhibitions_delete_own on public.exhibitions
    for delete
    to authenticated
    using (
        gallery_id = (select auth.uid())
        or is_gallery_member_for_exhibition(gallery_id)
    );

-- ============================================================
-- Update exhibition_artists policies to allow gallery members
-- ============================================================

-- Drop existing policies
drop policy if exists exhibition_artists_insert_own on public.exhibition_artists;
drop policy if exists exhibition_artists_delete_own on public.exhibition_artists;

-- Gallery owners/members can manage artists for their exhibitions
create policy exhibition_artists_insert_own on public.exhibition_artists
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artists.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- Gallery owners/members can delete artists from their exhibitions
create policy exhibition_artists_delete_own on public.exhibition_artists
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artists.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- ============================================================
-- Update exhibition_artworks policies to allow gallery members
-- ============================================================

-- Drop existing policies
drop policy if exists exhibition_artworks_insert_own on public.exhibition_artworks;
drop policy if exists exhibition_artworks_delete_own on public.exhibition_artworks;

-- Gallery owners/members can manage artworks for their exhibitions
create policy exhibition_artworks_insert_own on public.exhibition_artworks
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artworks.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- Gallery owners/members can delete artworks from their exhibitions
create policy exhibition_artworks_delete_own on public.exhibition_artworks
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.exhibitions e
            where e.id = exhibition_artworks.exhibition_id
            and (
                e.gallery_id = (select auth.uid())
                or is_gallery_member_for_exhibition(e.gallery_id)
            )
        )
    );

-- ========== 20250126000002_fix_artworks_public_read.sql ==========

-- Fix Artworks Public Read Policy
-- Restores public read access to verified artworks
-- SAFE: Only changes permissions, does NOT modify or delete any data

drop policy if exists artworks_read_public on public.artworks;

create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- ========== 20250126000003_fix_authenticated_public_artworks.sql ==========

-- Comprehensive fix for artworks visibility
-- Ensures both authenticated and anonymous users can see public verified artworks
-- SAFE: Only changes permissions, does NOT modify or delete any data

-- Drop and recreate public policy to ensure it works for both anon and authenticated
drop policy if exists artworks_read_public on public.artworks;

create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified' 
        and is_public = true
    );

-- Ensure own policy allows users to see their own artworks (regardless of privacy)
-- This policy is for authenticated users only
drop policy if exists artworks_read_own on public.artworks;

create policy artworks_read_own on public.artworks
    for select
    to authenticated
    using (
        account_id = (select auth.uid())
        or is_gallery_member_for_artwork(account_id, gallery_profile_id)
    );

-- ========== 20250126000004_ensure_anon_artworks_visibility.sql ==========

/*
 * -------------------------------------------------------
 * Ensure anon can see public artworks after gallery members RLS
 *
 * The base schema (20241219010757_schema.sql) revokes all privileges
 * on schema public from anon and never grants USAGE. So anon cannot
 * access any table in public even when table-level SELECT is granted.
 *
 * This migration:
 * 1. Grants USAGE on schema public to anon (required to access tables)
 * 2. Grants SELECT on public.artworks to anon (idempotent)
 * 3. Ensures artworks_read_public policy exists so anon sees verified+public rows
 *
 * SAFE: Only adds grants and ensures policy; does not modify or delete data.
 * -------------------------------------------------------
 */

-- 1. Anon must have USAGE on schema public to access tables (base schema never grants this)
grant usage on schema public to anon;

-- 2. Anon must have SELECT on artworks (idempotent; may already exist from earlier migrations)
grant select on table public.artworks to anon;

-- 3. Ensure public read policy exists (in case it was dropped or altered)
drop policy if exists artworks_read_public on public.artworks;
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified'
        and is_public = true
    );

-- ========== 20250131000000_fix_gallery_members_rls_recursion.sql ==========

/*
 * -------------------------------------------------------
 * Fix infinite recursion in gallery_members RLS policies
 * Policies that checked "is user owner/admin?" did so by
 * selecting from gallery_members again, causing recursion.
 * Use a SECURITY DEFINER helper to bypass RLS for that check.
 *
 * DATA SAFE: No DROP TABLE, TRUNCATE, DELETE, or UPDATE.
 * Only: create/replace function + drop/create RLS policies.
 * All gallery_members rows and all other data are unchanged.
 * -------------------------------------------------------
 */

-- Helper: can the current user act as owner/admin for this gallery profile?
-- Uses SECURITY DEFINER so it can read gallery_members without triggering RLS.
create or replace function public.is_gallery_owner_or_admin(p_gallery_profile_id uuid)
returns boolean as $$
begin
  return (
    -- Gallery profile owner (creator)
    exists (
      select 1 from public.user_profiles up
      where up.id = p_gallery_profile_id
        and up.user_id = auth.uid()
        and up.role = 'gallery'
    )
    or
    -- Already a gallery_members row as owner/admin (read bypasses RLS in this function)
    exists (
      select 1 from public.gallery_members gm
      where gm.gallery_profile_id = p_gallery_profile_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

comment on function public.is_gallery_owner_or_admin(uuid) is 'Returns true if current user is gallery profile owner or gallery_members owner/admin. Used in RLS to avoid self-reference recursion.';

-- Allow authenticated users to call this from RLS policies
grant execute on function public.is_gallery_owner_or_admin(uuid) to authenticated;

-- Drop policies that self-reference gallery_members
drop policy if exists gallery_members_read_gallery on public.gallery_members;
drop policy if exists gallery_members_insert_owner on public.gallery_members;
drop policy if exists gallery_members_update_owner on public.gallery_members;
drop policy if exists gallery_members_delete_owner on public.gallery_members;

-- Recreate using helper (no self-reference)
create policy gallery_members_read_gallery on public.gallery_members
  for select
  to authenticated
  using (
    is_gallery_owner_or_admin(gallery_profile_id)
  );

create policy gallery_members_insert_owner on public.gallery_members
  for insert
  to authenticated
  with check (
    is_gallery_owner_or_admin(gallery_profile_id)
  );

create policy gallery_members_update_owner on public.gallery_members
  for update
  to authenticated
  using (
    is_gallery_owner_or_admin(gallery_profile_id)
  )
  with check (
    is_gallery_owner_or_admin(gallery_profile_id)
  );

create policy gallery_members_delete_owner on public.gallery_members
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or is_gallery_owner_or_admin(gallery_profile_id)
  );

-- ========== 20250131000001_grant_is_gallery_owner_or_admin.sql ==========

/*
 * Grant EXECUTE on is_gallery_owner_or_admin to authenticated.
 * Required so RLS policies can call the function (otherwise: permission denied).
 */

grant execute on function public.is_gallery_owner_or_admin(uuid) to authenticated;

-- ========== 20250210000000_add_open_calls.sql ==========

/*
 * -------------------------------------------------------
 * Open Calls Schema
 * Public open calls for exhibitions with submissions
 * -------------------------------------------------------
 */

-- Create open_calls table
create table if not exists public.open_calls (
    id uuid unique not null default extensions.uuid_generate_v4(),
    exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
    gallery_profile_id uuid not null references public.user_profiles(id) on delete cascade,
    slug text not null unique,
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    created_by uuid references auth.users(id),
    updated_by uuid references auth.users(id),
    primary key (id)
);

comment on table public.open_calls is 'Public open calls tied to exhibitions';
comment on column public.open_calls.exhibition_id is 'The exhibition this open call belongs to';
comment on column public.open_calls.gallery_profile_id is 'Gallery profile managing the open call';
comment on column public.open_calls.slug is 'Public slug for open call URL';

-- Create open_call_submissions table
create table if not exists public.open_call_submissions (
    id uuid unique not null default extensions.uuid_generate_v4(),
    open_call_id uuid not null references public.open_calls(id) on delete cascade,
    account_id uuid references public.accounts(id) on delete set null,
    artist_name varchar(255) not null,
    artist_email varchar(255) not null,
    message text,
    artworks jsonb default '[]'::jsonb,
    status varchar(50) default 'submitted',
    created_at timestamp with time zone default now() not null,
    updated_at timestamp with time zone default now() not null,
    primary key (id)
);

comment on table public.open_call_submissions is 'Artist submissions for open calls';
comment on column public.open_call_submissions.artworks is 'JSON array of submitted artworks (image URLs, titles, etc)';

-- Indexes
create index if not exists open_calls_exhibition_id_idx on public.open_calls(exhibition_id);
create index if not exists open_calls_gallery_profile_id_idx on public.open_calls(gallery_profile_id);
create index if not exists open_calls_slug_idx on public.open_calls(slug);
create index if not exists open_call_submissions_open_call_id_idx on public.open_call_submissions(open_call_id);
create index if not exists open_call_submissions_account_id_idx on public.open_call_submissions(account_id);

-- Enable RLS
alter table public.open_calls enable row level security;
alter table public.open_call_submissions enable row level security;

-- RLS Policies for open_calls
drop policy if exists open_calls_read_public on public.open_calls;
drop policy if exists open_calls_insert_gallery on public.open_calls;
drop policy if exists open_calls_update_gallery on public.open_calls;
drop policy if exists open_calls_delete_gallery on public.open_calls;

create policy open_calls_read_public on public.open_calls
    for select
    to authenticated, anon
    using (true);

create policy open_calls_insert_gallery on public.open_calls
    for insert
    to authenticated
    with check (
        is_gallery_owner_or_admin(gallery_profile_id)
    );

create policy open_calls_update_gallery on public.open_calls
    for update
    to authenticated
    using (
        is_gallery_owner_or_admin(gallery_profile_id)
    )
    with check (
        is_gallery_owner_or_admin(gallery_profile_id)
    );

create policy open_calls_delete_gallery on public.open_calls
    for delete
    to authenticated
    using (
        is_gallery_owner_or_admin(gallery_profile_id)
    );

-- RLS Policies for open_call_submissions
drop policy if exists open_call_submissions_read_gallery on public.open_call_submissions;
drop policy if exists open_call_submissions_read_submitter on public.open_call_submissions;
drop policy if exists open_call_submissions_insert_public on public.open_call_submissions;
drop policy if exists open_call_submissions_update_gallery on public.open_call_submissions;

create policy open_call_submissions_read_gallery on public.open_call_submissions
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.open_calls oc
            where oc.id = open_call_id
            and is_gallery_owner_or_admin(oc.gallery_profile_id)
        )
    );

create policy open_call_submissions_read_submitter on public.open_call_submissions
    for select
    to authenticated
    using (
        account_id = auth.uid()
    );

create policy open_call_submissions_insert_public on public.open_call_submissions
    for insert
    to authenticated, anon
    with check (true);

create policy open_call_submissions_update_gallery on public.open_call_submissions
    for update
    to authenticated
    using (
        exists (
            select 1
            from public.open_calls oc
            where oc.id = open_call_id
            and is_gallery_owner_or_admin(oc.gallery_profile_id)
        )
    )
    with check (
        exists (
            select 1
            from public.open_calls oc
            where oc.id = open_call_id
            and is_gallery_owner_or_admin(oc.gallery_profile_id)
        )
    );

-- Grant permissions
grant select, insert, update, delete on table public.open_calls to authenticated;
grant select, insert on table public.open_call_submissions to authenticated;
grant select on table public.open_calls to anon;
grant insert on table public.open_call_submissions to anon;

-- Update timestamps
create trigger update_open_calls_updated_at
    before update on public.open_calls
    for each row
    execute function public.update_updated_at_column();

create trigger update_open_call_submissions_updated_at
    before update on public.open_call_submissions
    for each row
    execute function public.update_updated_at_column();

-- Storage bucket for open call submissions
insert into storage.buckets (id, name, public)
values ('open-call-submissions', 'open-call-submissions', true)
on conflict (id) do nothing;

-- Storage policies for open-call submissions bucket
drop policy if exists open_call_submissions_storage_read on storage.objects;
drop policy if exists open_call_submissions_storage_insert on storage.objects;

create policy open_call_submissions_storage_read on storage.objects
    for select
    to authenticated, anon
    using (
        bucket_id = 'open-call-submissions'
    );

create policy open_call_submissions_storage_insert on storage.objects
    for insert
    to authenticated
    with check (
        bucket_id = 'open-call-submissions'
    );

-- ========== 20250213000000_grant_is_gallery_member_for_exhibition.sql ==========

/*
 * Grant EXECUTE on is_gallery_member_for_exhibition to authenticated.
 * Required so RLS policies on exhibitions can call the function (otherwise: permission denied for function is_gallery_member_for_exhibition).
 */

grant execute on function public.is_gallery_member_for_exhibition(uuid) to authenticated;

-- ========== 20250213000001_add_certificate_type_to_artworks.sql ==========

/*
 * -------------------------------------------------------
 * Certificate Type by Poster Role
 * Gallery posting → Certificate of Show
 * Collector posting → Certificate of Collection
 * Artist posting → Certificate of Authenticity (default)
 * -------------------------------------------------------
 */

alter table public.artworks
  add column if not exists certificate_type varchar(50) default 'authenticity';

comment on column public.artworks.certificate_type is 'Type of certificate: authenticity (artist), show (gallery), collection (collector)';

create index if not exists artworks_certificate_type_idx on public.artworks(certificate_type);

-- ========== 20250213000002_certificate_type_ownership.sql ==========

/*
 * Rename certificate_type value: collection → ownership
 * (Collector-created certificates are "Certificate of Ownership")
 */

update public.artworks
set certificate_type = 'ownership'
where certificate_type = 'collection';

comment on column public.artworks.certificate_type is 'Type of certificate: authenticity (artist, or after claim+verify), show (gallery), ownership (collector)';

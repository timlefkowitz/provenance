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


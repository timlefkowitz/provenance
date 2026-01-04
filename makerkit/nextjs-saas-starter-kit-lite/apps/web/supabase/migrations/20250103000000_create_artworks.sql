/*
 * -------------------------------------------------------
 * Artworks and Collectibles Schema
 * This schema supports provenance tracking for artworks and collectibles
 * -------------------------------------------------------
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


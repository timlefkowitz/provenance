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


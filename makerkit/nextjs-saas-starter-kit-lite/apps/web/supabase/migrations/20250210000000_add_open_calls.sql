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

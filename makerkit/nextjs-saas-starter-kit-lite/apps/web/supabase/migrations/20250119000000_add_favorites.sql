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


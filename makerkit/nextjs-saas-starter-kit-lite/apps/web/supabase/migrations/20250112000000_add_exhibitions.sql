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


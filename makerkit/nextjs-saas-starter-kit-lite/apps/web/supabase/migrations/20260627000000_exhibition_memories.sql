/*
 * -------------------------------------------------------
 * Exhibition Memories
 *
 * User-generated "memories" (photos + a short note) that visitors can post
 * about an exhibition. Renders in a "Memories" tab on the exhibition page.
 *
 * DATA SAFETY (additive, no loss/change to existing data):
 * - CREATE TABLE IF NOT EXISTS only; no ALTER/DELETE/UPDATE on existing tables.
 * - Reuses the existing public `artworks` storage bucket for images (handled
 *   in the server action via the shared image uploader), so no storage changes
 *   are required here.
 * -------------------------------------------------------
 */

create table if not exists public.exhibition_memories (
    id uuid unique not null default extensions.uuid_generate_v4(),
    exhibition_id uuid not null references public.exhibitions(id) on delete cascade,
    user_id uuid not null references auth.users(id) on delete cascade,
    author_name text,
    author_avatar_url text,
    body text,
    image_urls text[] not null default '{}'::text[],
    created_at timestamp with time zone default now() not null,
    primary key (id)
);

comment on table public.exhibition_memories is 'Visitor-posted memories (photos + note) about an exhibition';
comment on column public.exhibition_memories.exhibition_id is 'The exhibition this memory belongs to';
comment on column public.exhibition_memories.user_id is 'The user who posted the memory';
comment on column public.exhibition_memories.author_name is 'Display name of the author, denormalised for fast reads';
comment on column public.exhibition_memories.author_avatar_url is 'Avatar URL of the author, denormalised for fast reads';
comment on column public.exhibition_memories.body is 'Optional text note attached to the memory';
comment on column public.exhibition_memories.image_urls is 'Public URLs of photos attached to the memory';

create index if not exists exhibition_memories_exhibition_id_idx on public.exhibition_memories(exhibition_id);
create index if not exists exhibition_memories_user_id_idx on public.exhibition_memories(user_id);
create index if not exists exhibition_memories_created_at_idx on public.exhibition_memories(created_at desc);

alter table public.exhibition_memories enable row level security;

drop policy if exists exhibition_memories_read_public on public.exhibition_memories;
drop policy if exists exhibition_memories_insert_own on public.exhibition_memories;
drop policy if exists exhibition_memories_delete_own_or_host on public.exhibition_memories;

-- Anyone can read memories (exhibitions are public).
create policy exhibition_memories_read_public on public.exhibition_memories
    for select
    to authenticated, anon
    using (true);

-- Signed-in users can post a memory as themselves.
create policy exhibition_memories_insert_own on public.exhibition_memories
    for insert
    to authenticated
    with check (
        user_id = (select auth.uid())
    );

-- The author or the exhibition host can delete a memory.
create policy exhibition_memories_delete_own_or_host on public.exhibition_memories
    for delete
    to authenticated
    using (
        user_id = (select auth.uid())
        or exists (
            select 1 from public.exhibitions
            where id = exhibition_id
            and gallery_id = (select auth.uid())
        )
    );

grant select, insert, delete on table public.exhibition_memories to authenticated;
grant select on table public.exhibition_memories to anon;

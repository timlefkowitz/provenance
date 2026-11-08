/*
 * -------------------------------------------------------
 * Artwork Lists
 * Private, named lists a user keeps of their own artworks — e.g. a
 * "To print" queue for wall labels, or "Needs info" for works scanned
 * by photo that still lack a title/artist. Lists are personal (owner
 * only) and never public.
 * -------------------------------------------------------
 */

create table if not exists public.artwork_lists (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references auth.users(id) on delete cascade,
    name text not null check (char_length(btrim(name)) between 1 and 80),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create unique index if not exists artwork_lists_account_id_lower_name_idx
    on public.artwork_lists (account_id, lower(name));

create table if not exists public.artwork_list_items (
    list_id uuid not null references public.artwork_lists(id) on delete cascade,
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    added_at timestamptz not null default now(),
    primary key (list_id, artwork_id)
);

create index if not exists artwork_list_items_artwork_id_idx on public.artwork_list_items (artwork_id);

alter table public.artwork_lists enable row level security;
alter table public.artwork_list_items enable row level security;

drop policy if exists artwork_lists_read_own on public.artwork_lists;
create policy artwork_lists_read_own on public.artwork_lists
    for select
    to authenticated
    using (account_id = (select auth.uid()));

drop policy if exists artwork_lists_insert on public.artwork_lists;
create policy artwork_lists_insert on public.artwork_lists
    for insert
    to authenticated
    with check (account_id = (select auth.uid()));

drop policy if exists artwork_lists_update on public.artwork_lists;
create policy artwork_lists_update on public.artwork_lists
    for update
    to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

drop policy if exists artwork_lists_delete on public.artwork_lists;
create policy artwork_lists_delete on public.artwork_lists
    for delete
    to authenticated
    using (account_id = (select auth.uid()));

drop policy if exists artwork_list_items_read_own on public.artwork_list_items;
create policy artwork_list_items_read_own on public.artwork_list_items
    for select
    to authenticated
    using (
        exists (
            select 1 from public.artwork_lists l
            where l.id = artwork_list_items.list_id
              and l.account_id = (select auth.uid())
        )
    );

drop policy if exists artwork_list_items_insert on public.artwork_list_items;
create policy artwork_list_items_insert on public.artwork_list_items
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.artwork_lists l
            where l.id = artwork_list_items.list_id
              and l.account_id = (select auth.uid())
        )
        and exists (
            select 1 from public.artworks a
            where a.id = artwork_list_items.artwork_id
              and a.account_id = (select auth.uid())
        )
    );

drop policy if exists artwork_list_items_delete on public.artwork_list_items;
create policy artwork_list_items_delete on public.artwork_list_items
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.artwork_lists l
            where l.id = artwork_list_items.list_id
              and l.account_id = (select auth.uid())
        )
    );

comment on table public.artwork_lists is 'Private named lists of a user''s own artworks (e.g. a wall-label print queue).';
comment on table public.artwork_list_items is 'Artworks in an artwork_list, ordered by added_at.';

/*
 * -------------------------------------------------------
 * Artwork Tags
 * Lets a user classify their own artworks (e.g. by medium: "Street
 * Photography", "Portraiture") so they can be grouped/filtered on the
 * user's profile_sites website and used to scope a private share link.
 * -------------------------------------------------------
 */

create table if not exists public.tags (
    id uuid primary key default gen_random_uuid(),
    account_id uuid not null references auth.users(id) on delete cascade,
    name text not null,
    slug text not null,
    created_at timestamptz not null default now()
);

create unique index if not exists tags_account_id_lower_name_idx
    on public.tags (account_id, lower(name));

create table if not exists public.artwork_tags (
    artwork_id uuid not null references public.artworks(id) on delete cascade,
    tag_id uuid not null references public.tags(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (artwork_id, tag_id)
);

create index if not exists artwork_tags_tag_id_idx on public.artwork_tags (tag_id);

alter table public.tags enable row level security;
alter table public.artwork_tags enable row level security;

create policy tags_read_own on public.tags
    for select
    to authenticated
    using (account_id = (select auth.uid()));

create policy tags_read_public on public.tags
    for select
    to anon, authenticated
    using (
        exists (
            select 1
            from public.artwork_tags at
            join public.artworks a on a.id = at.artwork_id
            where at.tag_id = tags.id
              and a.status = 'verified'
              and a.is_public = true
        )
    );

create policy tags_insert on public.tags
    for insert
    to authenticated
    with check (account_id = (select auth.uid()));

create policy tags_update on public.tags
    for update
    to authenticated
    using (account_id = (select auth.uid()))
    with check (account_id = (select auth.uid()));

create policy tags_delete on public.tags
    for delete
    to authenticated
    using (account_id = (select auth.uid()));

create policy artwork_tags_read_own on public.artwork_tags
    for select
    to authenticated
    using (
        exists (
            select 1 from public.artworks a
            where a.id = artwork_tags.artwork_id
              and a.account_id = (select auth.uid())
        )
    );

create policy artwork_tags_read_public on public.artwork_tags
    for select
    to anon, authenticated
    using (
        exists (
            select 1 from public.artworks a
            where a.id = artwork_tags.artwork_id
              and a.status = 'verified'
              and a.is_public = true
        )
    );

create policy artwork_tags_insert on public.artwork_tags
    for insert
    to authenticated
    with check (
        exists (
            select 1 from public.artworks a
            where a.id = artwork_tags.artwork_id
              and a.account_id = (select auth.uid())
        )
        and exists (
            select 1 from public.tags t
            where t.id = artwork_tags.tag_id
              and t.account_id = (select auth.uid())
        )
    );

create policy artwork_tags_delete on public.artwork_tags
    for delete
    to authenticated
    using (
        exists (
            select 1 from public.artworks a
            where a.id = artwork_tags.artwork_id
              and a.account_id = (select auth.uid())
        )
    );

comment on table public.tags is 'User-defined tags (e.g. medium/series) for grouping their own artworks.';
comment on table public.artwork_tags is 'Many-to-many join between artworks and tags.';

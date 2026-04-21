/*
 * Extra photos/documents attached to a certificate (artwork).
 * Files live in storage bucket "artworks" under {userId}/attachments/{artworkId}/...
 */

create table if not exists public.artwork_attachments (
  id uuid primary key default extensions.uuid_generate_v4(),
  artwork_id uuid not null references public.artworks(id) on delete cascade,
  account_id uuid not null references public.accounts(id),
  file_url text not null,
  file_name text not null,
  file_type text not null check (file_type in ('image', 'document')),
  created_at timestamptz not null default now()
);

comment on table public.artwork_attachments is 'Additional images or PDFs shown on the certificate page';

create index if not exists artwork_attachments_artwork_id_idx
  on public.artwork_attachments(artwork_id);

alter table public.artwork_attachments enable row level security;

-- Read: same visibility as viewing the parent artwork (verified+public, own, or gallery team)
create policy artwork_attachments_select on public.artwork_attachments
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.artworks w
      where w.id = artwork_attachments.artwork_id
      and (
        (w.status = 'verified' and w.is_public = true)
        or w.account_id = (select auth.uid())
        or is_gallery_member_for_artwork(w.account_id, w.gallery_profile_id)
      )
    )
  );

-- Insert: uploader must be auth.uid() and able to edit the artwork (owner or gallery team)
create policy artwork_attachments_insert on public.artwork_attachments
  for insert
  to authenticated
  with check (
    account_id = (select auth.uid())
    and exists (
      select 1 from public.artworks w
      where w.id = artwork_attachments.artwork_id
      and (
        w.account_id = (select auth.uid())
        or is_gallery_member_for_artwork(w.account_id, w.gallery_profile_id)
      )
    )
  );

-- Delete: uploader, artwork owner, or gallery team member for that artwork
create policy artwork_attachments_delete on public.artwork_attachments
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.artworks w
      where w.id = artwork_attachments.artwork_id
      and (
        artwork_attachments.account_id = (select auth.uid())
        or w.account_id = (select auth.uid())
        or is_gallery_member_for_artwork(w.account_id, w.gallery_profile_id)
      )
    )
  );

grant select on table public.artwork_attachments to anon, authenticated;
grant insert, delete on table public.artwork_attachments to authenticated;

-- Allow PDFs on the artworks bucket (certificate attachments)
update storage.buckets
set allowed_mime_types = array[
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf'
]::text[]
where id = 'artworks';

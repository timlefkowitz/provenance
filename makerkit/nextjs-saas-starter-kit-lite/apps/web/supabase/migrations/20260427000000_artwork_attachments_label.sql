/*
 * Add label and is_public fields to artwork_attachments.
 * - label: optional human-readable display name (falls back to file_name when null)
 * - is_public: when false the attachment is only visible to the artwork owner / gallery team
 */

alter table public.artwork_attachments
  add column if not exists label text,
  add column if not exists is_public boolean not null default true;

comment on column public.artwork_attachments.label is 'Optional display name shown on the certificate; falls back to file_name when null';
comment on column public.artwork_attachments.is_public is 'When false the attachment is only shown to the owner / gallery team, not the public';

-- Re-apply select policy so it filters private attachments for non-owners
drop policy if exists artwork_attachments_select on public.artwork_attachments;

create policy artwork_attachments_select on public.artwork_attachments
  for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.artworks w
      where w.id = artwork_attachments.artwork_id
      and (
        -- Owner or gallery team always see all attachments (public or private)
        w.account_id = (select auth.uid())
        or is_gallery_member_for_artwork(w.account_id, w.gallery_profile_id)
        -- Public visitors only see public attachments on verified public artworks
        or (
          artwork_attachments.is_public = true
          and w.status = 'verified'
          and w.is_public = true
        )
      )
    )
  );

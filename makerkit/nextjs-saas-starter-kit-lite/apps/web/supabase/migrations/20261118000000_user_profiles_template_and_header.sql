-- Per-profile page template and header image.
-- Before this, the profile-page template lived on accounts.public_data.template,
-- so one account's artist + gallery profiles shared a single choice and gallery
-- profiles could not pick one at all.

alter table public.user_profiles
  add column if not exists template text,
  add column if not exists header_image_url text;

comment on column public.user_profiles.template is
  'Public profile page template id (manifesto, darkroom, ...). Null = default layout.';
comment on column public.user_profiles.header_image_url is
  'Wide banner image shown across the top of the public profile page.';

-- Carry an artist's existing account-level template onto their artist profile(s).
update public.user_profiles up
set template = a.public_data ->> 'template'
from public.accounts a
where up.user_id = a.id
  and up.role = 'artist'
  and up.template is null
  and coalesce(a.public_data ->> 'template', '') <> '';

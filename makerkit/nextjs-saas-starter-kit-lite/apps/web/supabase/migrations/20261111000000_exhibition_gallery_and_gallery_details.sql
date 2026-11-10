/*
 * -------------------------------------------------------
 * Exhibition venue + gallery visitor details
 *
 * exhibitions.gallery_profile_id: the gallery (or institution) profile a show
 *   is at. A curator can put a show at one of their galleries; the show is
 *   listed on that gallery's page and its Certificates of Show are filed under
 *   it. Null keeps the old behaviour (the owner account's first gallery).
 *
 * user_profiles: public visitor info for galleries — street address, opening
 *   hours, photos of the space, and an opt-in to show the contact email
 *   (mirrors show_phone).
 * -------------------------------------------------------
 */

alter table public.exhibitions
  add column if not exists gallery_profile_id uuid
    references public.user_profiles(id) on delete set null;

create index if not exists exhibitions_gallery_profile_id_idx
  on public.exhibitions(gallery_profile_id);

comment on column public.exhibitions.gallery_profile_id is
  'Gallery/institution profile the show is at. Null = the owner account''s default gallery profile.';

alter table public.user_profiles
  add column if not exists address text,
  add column if not exists opening_hours text,
  add column if not exists photos text[] not null default '{}',
  add column if not exists show_contact_email boolean not null default false;

comment on column public.user_profiles.address is 'Street address (galleries/institutions), shown publicly';
comment on column public.user_profiles.opening_hours is 'Free-form opening hours, one line per day range';
comment on column public.user_profiles.photos is 'Public photos of the space (gallery/institution)';
comment on column public.user_profiles.show_contact_email is 'Owner opted in to showing contact_email publicly';

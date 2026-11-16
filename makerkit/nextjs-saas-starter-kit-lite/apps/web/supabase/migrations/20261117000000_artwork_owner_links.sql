/*
 * Link "Owned by" to a real person, the way sold_to_account_id sits beside
 * sold_to_name. owned_by stays as the display name; the ids say who it is.
 * Picking an owner on Provenance sends them an ownership invite; the work
 * only moves to their account (account_id) when they accept.
 */
alter table public.artworks
  add column if not exists owned_by_account_id uuid references public.accounts(id) on delete set null,
  add column if not exists owned_by_profile_id uuid references public.user_profiles(id) on delete set null;

comment on column public.artworks.owned_by_account_id is 'Account named in owned_by, when the owner is on Provenance';
comment on column public.artworks.owned_by_profile_id is 'Profile named in owned_by (may be a managed collection nobody has claimed yet)';

create index if not exists artworks_owned_by_account_id_idx
  on public.artworks(owned_by_account_id) where owned_by_account_id is not null;

/* People search and duplicate checks match names case-insensitively per role. */
create index if not exists user_profiles_role_lower_name_idx
  on public.user_profiles(role, lower(name)) where is_active;

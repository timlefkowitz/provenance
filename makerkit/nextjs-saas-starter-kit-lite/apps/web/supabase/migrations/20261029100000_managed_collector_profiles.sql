/*
 * -------------------------------------------------------
 * Managed collector profiles
 * A user can build a collection on behalf of someone else (an advisor for a
 * client, a gallery for a buyer). The collection is a collector user_profiles
 * row with is_claimed = false, user_id = the creator, and the real owner's
 * name/email in managed_for_*. A later handoff invite moves it to the owner.
 *
 * user_id stays set to the creator (unlike unclaimed artist profiles, which
 * use null) so every existing account_id = auth.uid() policy keeps working
 * while the creator builds the collection.
 *
 * Data-safe: adds nullable columns and swaps a partial unique index. Existing
 * rows all have is_claimed = true, so the new index enforces the same rule.
 * -------------------------------------------------------
 */

alter table public.user_profiles
  add column if not exists managed_for_name text,
  add column if not exists managed_for_email text;

comment on column public.user_profiles.managed_for_name is
  'Managed collector profiles: the real owner''s name, shown on certificates until the handoff';
comment on column public.user_profiles.managed_for_email is
  'Managed collector profiles: the real owner''s email, used for the handoff invite';

-- One claimed artist/collector profile per user; any number of managed (unclaimed) collections.
drop index if exists public.user_profiles_user_role_unique_artist_collector;

create unique index if not exists user_profiles_user_role_unique_artist_collector
  on public.user_profiles(user_id, role)
  where role in ('artist', 'collector') and is_claimed;

comment on index public.user_profiles_user_role_unique_artist_collector is
  'One claimed artist and one claimed collector profile per user. Managed collections (is_claimed = false) are excluded.';

create index if not exists user_profiles_managed_collections_idx
  on public.user_profiles(user_id)
  where role = 'collector' and not is_claimed;

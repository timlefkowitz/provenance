/*
 * -------------------------------------------------------
 * Institution accounts and institution teams
 *
 * 1. Locked institution accounts. An admin marks an account with
 *    public_data.account_type = 'institution' (service role only). A locked
 *    account always stays in institution mode and can only own institution
 *    profiles, so it can never post as an artist, collector, or gallery.
 * 2. Institution teams. The gallery_members team system (owner/admin/member)
 *    now covers institution profiles as well as gallery profiles.
 *
 * DATA SAFE: No DROP TABLE, TRUNCATE, DELETE, or UPDATE of existing rows.
 * Only: create/replace functions and triggers, drop/create one RLS policy,
 * and an insert-if-missing backfill of owner rows for institution profiles.
 * -------------------------------------------------------
 */

-- ============================================================
-- 1. Locked institution accounts
-- ============================================================

-- accounts: users cannot set or clear account_type themselves, and a locked
-- account's role (current mode) must stay 'institution'.
create or replace function kit.protect_institution_account_lock()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Only enforce when an authenticated role (not service_role) modifies the row.
  if current_setting('role', true) = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.public_data ->> 'account_type' is not null then
        raise exception 'Unauthorized: account type can only be set by an admin';
      end if;
    elsif (new.public_data ->> 'account_type') is distinct from (old.public_data ->> 'account_type') then
      raise exception 'Unauthorized: account type can only be changed by an admin';
    end if;

    if new.public_data ->> 'account_type' = 'institution'
       and coalesce(new.public_data ->> 'role', '') <> 'institution' then
      raise exception 'Institution accounts can only use institution mode';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_institution_account_lock_trigger on public.accounts;

create trigger protect_institution_account_lock_trigger
  before insert or update on public.accounts
  for each row
  execute function kit.protect_institution_account_lock();

-- user_profiles: a locked institution account can only own institution profiles.
-- Unclaimed artist profiles an institution creates for its artists have
-- user_id null, so they are unaffected.
create or replace function kit.protect_institution_account_profiles()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('role', true) = 'authenticated'
     and new.user_id is not null
     and new.role <> 'institution'
     and exists (
       select 1 from public.accounts a
       where a.id = new.user_id
         and a.public_data ->> 'account_type' = 'institution'
     ) then
    raise exception 'Institution accounts can only have institution profiles';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_institution_account_profiles_trigger on public.user_profiles;

create trigger protect_institution_account_profiles_trigger
  before insert or update of role, user_id on public.user_profiles
  for each row
  execute function kit.protect_institution_account_profiles();

-- ============================================================
-- 2. Institution teams: gallery checks also accept institution profiles
-- ============================================================

create or replace function public.is_gallery_owner_or_admin(p_gallery_profile_id uuid)
returns boolean as $$
begin
  return (
    -- Gallery / institution profile owner (creator)
    exists (
      select 1 from public.user_profiles up
      where up.id = p_gallery_profile_id
        and up.user_id = auth.uid()
        and up.role in ('gallery', 'institution')
    )
    or
    -- Already a gallery_members row as owner/admin (read bypasses RLS in this function)
    exists (
      select 1 from public.gallery_members gm
      where gm.gallery_profile_id = p_gallery_profile_id
        and gm.user_id = auth.uid()
        and gm.role in ('owner', 'admin')
    )
  );
end;
$$ language plpgsql security definer set search_path = public;

create or replace function is_gallery_member_for_artwork(artwork_account_id uuid, artwork_gallery_profile_id uuid)
returns boolean as $$
begin
    -- If artwork has a gallery_profile_id, check membership for that profile
    if artwork_gallery_profile_id is not null then
        return exists (
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = artwork_gallery_profile_id
            and gm.user_id = (select auth.uid())
        );
    end if;

    -- Otherwise, check if user owns the account or is a member of any gallery/institution profile owned by that account
    return artwork_account_id = (select auth.uid())
        or exists (
            select 1 from public.gallery_members gm
            join public.user_profiles up on gm.gallery_profile_id = up.id
            where up.user_id = artwork_account_id
            and up.role in ('gallery', 'institution')
            and gm.user_id = (select auth.uid())
        );
end;
$$ language plpgsql security definer;

create or replace function is_gallery_member_for_exhibition(exhibition_gallery_id uuid)
returns boolean as $$
begin
    -- Check if user owns the gallery/institution account
    if exhibition_gallery_id = (select auth.uid()) then
        return true;
    end if;

    -- Check if user is a member of any gallery/institution profile owned by that account
    return exists (
        select 1 from public.gallery_members gm
        join public.user_profiles up on gm.gallery_profile_id = up.id
        where up.user_id = exhibition_gallery_id
        and up.role in ('gallery', 'institution')
        and gm.user_id = (select auth.uid())
    );
end;
$$ language plpgsql security definer;

-- Team members can edit their gallery/institution profile
drop policy if exists user_profiles_update_own on public.user_profiles;

create policy user_profiles_update_own on public.user_profiles
    for update
    to authenticated
    using (
        user_id = (select auth.uid()) -- Profile owner
        or exists ( -- Gallery / institution team member
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = user_profiles.id
            and gm.user_id = (select auth.uid())
            and user_profiles.role in ('gallery', 'institution')
        )
    )
    with check (
        user_id = (select auth.uid()) -- Profile owner
        or exists ( -- Gallery / institution team member
            select 1 from public.gallery_members gm
            where gm.gallery_profile_id = user_profiles.id
            and gm.user_id = (select auth.uid())
            and user_profiles.role in ('gallery', 'institution')
        )
    );

-- Creator of a gallery or institution profile becomes its team owner
create or replace function auto_add_gallery_owner()
returns trigger as $$
begin
    if new.role in ('gallery', 'institution') and new.user_id is not null then
        insert into public.gallery_members (gallery_profile_id, user_id, role, joined_at)
        values (new.id, new.user_id, 'owner', now())
        on conflict (gallery_profile_id, user_id) do nothing;
    end if;
    return new;
end;
$$ language plpgsql security definer;

drop trigger if exists auto_add_gallery_owner_trigger on public.user_profiles;
create trigger auto_add_gallery_owner_trigger
    after insert on public.user_profiles
    for each row
    when (new.role in ('gallery', 'institution'))
    execute function auto_add_gallery_owner();

-- Backfill: existing institution profile creators become owners
insert into public.gallery_members (gallery_profile_id, user_id, role, joined_at)
select id, user_id, 'owner', created_at
from public.user_profiles
where role = 'institution'
and user_id is not null
and not exists (
    select 1 from public.gallery_members gm
    where gm.gallery_profile_id = user_profiles.id
    and gm.user_id = user_profiles.user_id
);

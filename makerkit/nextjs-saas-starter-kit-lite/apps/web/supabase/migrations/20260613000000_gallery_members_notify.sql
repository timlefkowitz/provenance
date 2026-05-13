-- Migration: notify gallery team members when they are added
--
-- Creates an AFTER INSERT trigger on public.gallery_members that writes a
-- notifications row for the newly-added member whenever they are not the
-- gallery profile creator (the auto-owner backfill from the previous
-- migration does not need a notification because the creator already knows).
--
-- This guarantees that admin/seed paths (direct DB inserts) also deliver
-- the notification, not just the inviteGalleryMember server action.

create or replace function notify_gallery_member_added()
returns trigger
language plpgsql
security definer
as $$
declare
  v_gallery_name text;
  v_profile_owner_user_id uuid;
begin
  -- Resolve the gallery profile name and owner
  select name, user_id
  into v_gallery_name, v_profile_owner_user_id
  from public.user_profiles
  where id = new.gallery_profile_id
    and role = 'gallery'
  limit 1;

  -- Skip notification when the new member IS the gallery profile creator
  -- (the trigger fires for the auto-owner backfill row too, and for newly
  -- created profiles where the creator is added as owner automatically).
  if new.user_id = v_profile_owner_user_id then
    return new;
  end if;

  -- Skip if we couldn't resolve the gallery (defensive)
  if v_gallery_name is null then
    return new;
  end if;

  raise notice '[Notifications] gallery_team_invite trigger fired for user % on gallery %', new.user_id, new.gallery_profile_id;

  insert into public.notifications (
    user_id,
    type,
    title,
    message,
    artwork_id,
    related_user_id,
    metadata,
    read
  ) values (
    new.user_id,
    'gallery_team_invite',
    'You were added to ' || v_gallery_name,
    'You have been added as a ' || new.role || ' to the gallery "' || v_gallery_name || '". Switch to Gallery mode to manage exhibitions and certificates.',
    null,
    v_profile_owner_user_id,
    jsonb_build_object(
      'galleryProfileId', new.gallery_profile_id::text,
      'role', new.role,
      'galleryName', v_gallery_name
    ),
    false
  )
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_gallery_member_added on public.gallery_members;

create trigger on_gallery_member_added
  after insert on public.gallery_members
  for each row
  execute function notify_gallery_member_added();

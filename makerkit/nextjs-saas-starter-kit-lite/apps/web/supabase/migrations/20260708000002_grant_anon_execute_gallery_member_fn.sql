-- Grant anonymous role permission to execute this function so the
-- artwork_attachments_select RLS policy (which applies to anon) can
-- evaluate it. The function is SECURITY DEFINER and returns false for
-- anonymous callers (auth.uid() = null), so this is safe.
grant execute on function public.is_gallery_member_for_artwork(uuid, uuid) to anon;

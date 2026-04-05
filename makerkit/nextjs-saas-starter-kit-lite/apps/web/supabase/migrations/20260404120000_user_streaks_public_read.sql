-- Allow anyone to read streak stats for public artist profiles (RLS previously blocked non-owners).

drop policy if exists user_streaks_read_public on public.user_streaks;

create policy user_streaks_read_public on public.user_streaks
  for select
  to anon, authenticated
  using (true);

grant select on table public.user_streaks to anon;

comment on policy user_streaks_read_public on public.user_streaks is
  'Public read for profile pages; insert/update/delete remain restricted to row owner.';

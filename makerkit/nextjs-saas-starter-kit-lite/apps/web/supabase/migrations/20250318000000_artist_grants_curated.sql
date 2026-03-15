/*
 * Allow curated (shared) grants on artist_grants.
 * - user_id NULL = curated grant visible to all authenticated users
 * - RLS: users can read their own rows (user_id = auth.uid()) or curated rows (user_id IS NULL)
 * - Inserts/updates/deletes for curated rows require service role or run seed as DB owner.
 *
 * DATA-SAFE: additive only. Existing rows unchanged.
 */

alter table public.artist_grants
  alter column user_id drop not null;

comment on column public.artist_grants.user_id is 'Owner of this grant row; NULL = curated grant visible to all artists';

drop policy if exists artist_grants_select_own on public.artist_grants;
create policy artist_grants_select_own on public.artist_grants
  for select to authenticated
  using (user_id = auth.uid() or user_id is null);

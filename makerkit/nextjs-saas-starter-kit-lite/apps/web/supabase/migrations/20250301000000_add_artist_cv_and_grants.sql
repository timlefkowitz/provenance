/*
 * -------------------------------------------------------
 * Artist CV and Grants
 * - Add artist CV fields to user_profiles (for grant discovery)
 * - Create artist_grants table for persisted grant recommendations
 * - Storage bucket for artist CV uploads (PDF/DOCX/TXT)
 * -------------------------------------------------------
 */

-- 1. Add artist CV columns to user_profiles
alter table public.user_profiles
  add column if not exists artist_cv_json jsonb,
  add column if not exists artist_cv_file_url text,
  add column if not exists artist_cv_uploaded_at timestamp with time zone;

comment on column public.user_profiles.artist_cv_json is 'Structured CV/resume extract (location, education, exhibitions, etc.) for grant matching';
comment on column public.user_profiles.artist_cv_file_url is 'Storage URL of uploaded CV file';
comment on column public.user_profiles.artist_cv_uploaded_at is 'When the CV was uploaded';

-- 2. Create artist_grants table
create table if not exists public.artist_grants (
  id uuid primary key default extensions.uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist_profile_id uuid references public.user_profiles(id) on delete set null,
  name text not null,
  description text,
  deadline date,
  amount text,
  eligible_locations text[] default '{}',
  url text,
  discipline text[] default '{}',
  source text default 'openai',
  raw_response jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.artist_grants is 'Grant recommendations for artists, populated by AI from artist CV context';
comment on column public.artist_grants.eligible_locations is 'Locations where the grant is available (for filtering)';

create index if not exists artist_grants_user_id_idx on public.artist_grants(user_id);
create index if not exists artist_grants_artist_profile_id_idx on public.artist_grants(artist_profile_id);
create index if not exists artist_grants_deadline_idx on public.artist_grants(deadline);
create index if not exists artist_grants_eligible_locations_idx on public.artist_grants using gin(eligible_locations);

alter table public.artist_grants enable row level security;

drop policy if exists artist_grants_select_own on public.artist_grants;
drop policy if exists artist_grants_insert_own on public.artist_grants;
drop policy if exists artist_grants_update_own on public.artist_grants;
drop policy if exists artist_grants_delete_own on public.artist_grants;

create policy artist_grants_select_own on public.artist_grants
  for select to authenticated using (user_id = auth.uid());

create policy artist_grants_insert_own on public.artist_grants
  for insert to authenticated with check (user_id = auth.uid());

create policy artist_grants_update_own on public.artist_grants
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy artist_grants_delete_own on public.artist_grants
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on table public.artist_grants to authenticated;

-- Trigger for updated_at
create or replace function update_artist_grants_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_artist_grants_updated_at_trigger on public.artist_grants;
create trigger update_artist_grants_updated_at_trigger
  before update on public.artist_grants
  for each row execute function update_artist_grants_updated_at();

-- 3. Storage bucket for artist CVs
insert into storage.buckets (id, name, public)
values ('artist-cvs', 'artist-cvs', false)
on conflict (id) do nothing;

drop policy if exists artist_cvs_storage_select on storage.objects;
drop policy if exists artist_cvs_storage_insert on storage.objects;
drop policy if exists artist_cvs_storage_update on storage.objects;
drop policy if exists artist_cvs_storage_delete on storage.objects;

create policy artist_cvs_storage_select on storage.objects
  for select to authenticated
  using (bucket_id = 'artist-cvs' and split_part(name, '/', 1) = auth.uid()::text);

create policy artist_cvs_storage_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'artist-cvs' and split_part(name, '/', 1) = auth.uid()::text);

create policy artist_cvs_storage_update on storage.objects
  for update to authenticated
  using (bucket_id = 'artist-cvs' and split_part(name, '/', 1) = auth.uid()::text)
  with check (bucket_id = 'artist-cvs' and split_part(name, '/', 1) = auth.uid()::text);

create policy artist_cvs_storage_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'artist-cvs' and split_part(name, '/', 1) = auth.uid()::text);

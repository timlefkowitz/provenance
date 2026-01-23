/*
 * -------------------------------------------------------
 * Add Slug Field for Gallery Profiles
 * Adds a unique slug field for gallery profiles to enable short links
 * -------------------------------------------------------
 */

-- Add slug column to user_profiles table
alter table public.user_profiles
  add column if not exists slug varchar(100);

-- Create unique index for gallery profile slugs (only for gallery role)
-- This allows multiple galleries to have unique short links
create unique index if not exists user_profiles_slug_unique_gallery
on public.user_profiles(slug)
where role = 'gallery' and slug is not null;

-- Create index for faster lookups
create index if not exists user_profiles_slug_idx on public.user_profiles(slug)
where slug is not null;

-- Add comment
comment on column public.user_profiles.slug is 'URL-friendly short identifier for gallery profiles (e.g., "flight" for FL!GHT gallery)';

-- Function to generate a unique slug from a name
create or replace function generate_unique_gallery_slug(base_name text)
returns text as $$
declare
  base_slug text;
  candidate_slug text;
  counter int := 0;
  exists_check boolean;
begin
  -- Convert name to slug: lowercase, remove special chars, replace spaces with hyphens
  base_slug := lower(regexp_replace(regexp_replace(base_name, '[^a-z0-9\s-]', '', 'gi'), '\s+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  
  -- If empty after slugification, use a default
  if base_slug = '' or base_slug is null then
    base_slug := 'gallery';
  end if;
  
  candidate_slug := base_slug;
  
  -- Check if slug exists, if so append a number
  loop
    select exists(
      select 1 from public.user_profiles up
      where up.role = 'gallery' 
      and up.slug = candidate_slug
      and up.slug is not null
    ) into exists_check;
    
    exit when not exists_check;
    
    counter := counter + 1;
    candidate_slug := base_slug || '-' || counter::text;
  end loop;
  
  return candidate_slug;
end;
$$ language plpgsql;

-- Generate slugs for existing gallery profiles
do $$
declare
  profile_record record;
  generated_slug text;
begin
  for profile_record in 
    select up.id, up.name 
    from public.user_profiles up
    where up.role = 'gallery' 
    and (up.slug is null or up.slug = '')
  loop
    generated_slug := generate_unique_gallery_slug(profile_record.name);
    update public.user_profiles
    set slug = generated_slug
    where id = profile_record.id;
  end loop;
end $$;


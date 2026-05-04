/*
 * -------------------------------------------------------
 * Profile Sites
 * Creator-website builder: one row per user_profiles row.
 * Stores template choice, theme, section visibility, CTA,
 * and (v1.5) custom domain fields.
 * -------------------------------------------------------
 */

create table if not exists public.profile_sites (
  profile_id uuid primary key references public.user_profiles(id) on delete cascade,
  handle     text not null unique,
  template_id text not null default 'studio'
    check (template_id in ('editorial', 'studio', 'atelier')),
  theme jsonb not null default '{}'::jsonb,
  sections jsonb not null default '{
    "bio": true,
    "artworks": true,
    "exhibitions": true,
    "press": true,
    "cv": false,
    "contact": true
  }'::jsonb,
  cta jsonb,
  published_at timestamp with time zone,
  -- v1.5 custom domain fields
  custom_domain text unique,
  custom_domain_verified_at timestamp with time zone,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null
);

comment on table public.profile_sites is
  'One creator-website config per user_profiles row. handle is the subdomain (handle.provenance.app).';

comment on column public.profile_sites.handle is
  'Unique subdomain label (a-z0-9, hyphens). e.g. "jane-doe" → jane-doe.provenance.app';

comment on column public.profile_sites.template_id is
  'Visual template: editorial (gallery/institution), studio (artist grid), atelier (narrative scroll)';

comment on column public.profile_sites.theme is
  'JSON: { accent: string, font_pairing: string }. Constrained to a small palette.';

comment on column public.profile_sites.sections is
  'JSON booleans controlling which content blocks render: bio, artworks, exhibitions, press, cv, contact.';

comment on column public.profile_sites.cta is
  'Optional external call-to-action: { label: string, url: string }';

comment on column public.profile_sites.custom_domain is
  '(v1.5) BYOD domain e.g. myartist.com. Set after Vercel Domains API verification.';

-- Faster handle lookups from middleware
create index if not exists profile_sites_handle_idx on public.profile_sites(handle);
create index if not exists profile_sites_custom_domain_idx on public.profile_sites(custom_domain)
  where custom_domain is not null;

-- Timestamps auto-update trigger
create or replace function public.profile_sites_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profile_sites_updated_at on public.profile_sites;
create trigger profile_sites_updated_at
  before update on public.profile_sites
  for each row execute function public.profile_sites_set_updated_at();

-- Row Level Security
alter table public.profile_sites enable row level security;

-- Owners read their own site config
drop policy if exists profile_sites_select_own on public.profile_sites;
create policy profile_sites_select_own on public.profile_sites
  for select using (
    profile_id in (
      select id from public.user_profiles where user_id = auth.uid()
    )
  );

-- Owners insert their own site config
drop policy if exists profile_sites_insert_own on public.profile_sites;
create policy profile_sites_insert_own on public.profile_sites
  for insert with check (
    profile_id in (
      select id from public.user_profiles where user_id = auth.uid()
    )
  );

-- Owners update their own site config
drop policy if exists profile_sites_update_own on public.profile_sites;
create policy profile_sites_update_own on public.profile_sites
  for update using (
    profile_id in (
      select id from public.user_profiles where user_id = auth.uid()
    )
  );

-- Published sites are publicly readable (for the visitor-facing subdomain)
drop policy if exists profile_sites_select_published on public.profile_sites;
create policy profile_sites_select_published on public.profile_sites
  for select using (published_at is not null);

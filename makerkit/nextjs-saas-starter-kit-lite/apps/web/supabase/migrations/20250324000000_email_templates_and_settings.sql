/*
 * Email templates (markdown) + global theme for transactional emails.
 * Admin edits via /admin/emails; server uses service role to read when sending.
 */

create table if not exists public.email_settings (
  id uuid primary key default gen_random_uuid(),
  parchment text not null default '#F5F1E8',
  ink text not null default '#111111',
  wine text not null default '#4A2F25',
  ink_subtitle text not null default '#2a2a2a',
  ink_muted text not null default '#555555',
  masthead_title text not null default 'PROVENANCE',
  masthead_subtitle text not null default 'PRESERVING CULTURAL HERITAGE',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

insert into public.email_settings (parchment, ink, wine, ink_subtitle, ink_muted, masthead_title, masthead_subtitle)
select '#F5F1E8', '#111111', '#4A2F25', '#2a2a2a', '#555555', 'PROVENANCE', 'PRESERVING CULTURAL HERITAGE'
where not exists (select 1 from public.email_settings limit 1);

create table if not exists public.email_templates (
  template_key text primary key,
  subject text not null,
  body_markdown text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

comment on table public.email_settings is 'Global colors and masthead text for transactional emails';
comment on table public.email_templates is 'Markdown body per template; placeholders {{name}}, {{siteUrl}}, etc.';

alter table public.email_settings enable row level security;
alter table public.email_templates enable row level security;

-- No policies: only service role (bypasses RLS) can read/write from app server.

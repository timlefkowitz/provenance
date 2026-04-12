/*
 * Marketing blog posts: public read for published rows only; writes via service_role (dashboard / server admin).
 * DATA-SAFE: create if not exists, no destructive DDL on existing objects.
 */

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  canonical_path text,
  body_markdown text not null,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  published_at timestamptz,
  og_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.blog_posts is 'Public marketing blog; SEO pages for published posts only';
comment on column public.blog_posts.slug is 'URL segment under /blog/{slug}';
comment on column public.blog_posts.description is 'Meta description / excerpt';
comment on column public.blog_posts.canonical_path is 'Optional path override for rel=canonical (leading slash, e.g. /blog/foo)';
comment on column public.blog_posts.body_markdown is 'Post body as Markdown';
comment on column public.blog_posts.published_at is 'When the post went live; must be set for public visibility';

create index if not exists blog_posts_status_published_at_idx
  on public.blog_posts (status, published_at desc);

create or replace function public.update_blog_posts_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists update_blog_posts_updated_at_trigger on public.blog_posts;
create trigger update_blog_posts_updated_at_trigger
  before update on public.blog_posts
  for each row
  execute function public.update_blog_posts_updated_at();

alter table public.blog_posts enable row level security;

drop policy if exists blog_posts_select_published on public.blog_posts;
create policy blog_posts_select_published on public.blog_posts
  for select
  to anon, authenticated
  using (
    status = 'published'
    and published_at is not null
    and published_at <= now()
  );

grant select on table public.blog_posts to anon, authenticated;
grant select, insert, update, delete on table public.blog_posts to service_role;

insert into public.blog_posts (
  slug,
  title,
  description,
  body_markdown,
  status,
  published_at
)
values
  (
    'welcome',
    'Welcome to the blog',
    'Ideas, product updates, and stories from our team.',
    E'# Welcome\n\nThis is a sample **published** post. Replace it or add more rows in Supabase.\n\n- Edit in the dashboard\n- Set `status` to `published` and `published_at` when you go live',
    'published',
    now() - interval '2 days'
  ),
  (
    'why-provenance-matters',
    'Why provenance matters',
    'A short read on authenticity and trust for collectors and artists.',
    E'## Trust is the product\n\nCollectors and galleries need a clear chain of custody. Provenance turns claims into evidence.\n\n> Ship stories that rank—and that people actually want to read.',
    'published',
    now() - interval '1 day'
  )
on conflict (slug) do nothing;

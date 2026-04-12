/*
 * Blog post byline: who wrote it (display + optional link to auth user).
 * DATA-SAFE: add columns only; existing rows get default author_name.
 */

alter table public.blog_posts
  add column if not exists author_name text not null default 'Provenance';

alter table public.blog_posts
  add column if not exists author_user_id uuid references auth.users(id) on delete set null;

comment on column public.blog_posts.author_name is 'Public byline (e.g. admin display name) for article and JSON-LD';
comment on column public.blog_posts.author_user_id is 'auth.users id of creator when posted from admin app';

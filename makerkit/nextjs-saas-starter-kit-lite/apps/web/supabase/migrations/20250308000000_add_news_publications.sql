/*
 * Add news_publications to user_profiles
 * Stores press/news links for artists and galleries (title, url, publication_name, date).
 */

alter table public.user_profiles
  add column if not exists news_publications jsonb not null default '[]';

comment on column public.user_profiles.news_publications is 'List of news/press publications: [{ title, url, publication_name?, date? }]';

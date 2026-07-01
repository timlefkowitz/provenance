-- Add image_urls array to collectibles so a single collectible can have
-- multiple photos. image_url (singular) is kept as the primary/first photo
-- so existing thumbnails, OG tags, and certificate queries continue to work.
alter table public.collectibles
  add column if not exists image_urls text[] not null default '{}'::text[];

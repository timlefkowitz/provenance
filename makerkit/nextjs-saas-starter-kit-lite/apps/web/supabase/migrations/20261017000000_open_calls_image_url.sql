/*
 * Open call main image.
 *
 * open_calls.image_url: public URL of the image the organiser picked to lead
 * their open call (hero on the open call page, thumbnail in browse, social
 * preview). Stored in the public 'artworks' bucket via ArtworkImageUploader.
 *
 * DATA-SAFE: additive only. Nullable column; existing calls render as before.
 */

alter table public.open_calls
  add column if not exists image_url text;

comment on column public.open_calls.image_url is 'Main image shown at the top of the open call page';

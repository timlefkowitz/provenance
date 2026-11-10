-- Non-destructive photo edits on certificates.
-- image_url stays the photo every page shows. When it is a crop / rotation of
-- another photo, original_image_url points at that untouched upload, so edits
-- always restart from it and it can be restored. Null means image_url is
-- itself the original. Old storage objects are never deleted on edit.
alter table public.artworks
  add column if not exists original_image_url text;

comment on column public.artworks.original_image_url is
  'Untouched upload that image_url was cropped/rotated from; null when image_url is the original.';

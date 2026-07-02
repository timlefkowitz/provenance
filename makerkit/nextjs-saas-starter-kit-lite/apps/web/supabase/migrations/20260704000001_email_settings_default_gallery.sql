-- Make the Gallery preset the default email design.
-- 1. New installs / resets default to 'gallery'.
-- 2. Existing rows are switched to 'gallery' so the change applies immediately
--    to all outgoing transactional emails.

alter table public.email_settings
  alter column layout_preset set default 'gallery';

update public.email_settings
set layout_preset = 'gallery',
    updated_at = now();

comment on column public.email_settings.layout_preset is
  'Active email design preset. Valid values: atelier | gallery | editorial | pop | pastel | mono | sunset | midnight. Unknown values fall back to gallery at runtime.';

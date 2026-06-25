-- Update email_settings.layout_preset default and comment to reflect the 8 design presets.
--
-- Intentionally does NOT add a CHECK constraint so:
--   1. Existing rows with legacy values (studio, heritage, archive, minimal) are not invalidated.
--   2. Future presets can be added without a new migration.
-- Unknown values are normalised to 'atelier' at read time in email-layout-presets.ts.

alter table public.email_settings
  alter column layout_preset set default 'atelier';

comment on column public.email_settings.layout_preset is
  'Active email design preset. Valid values: atelier | gallery | editorial | pop | pastel | mono | sunset | midnight. Unknown values fall back to atelier at runtime.';

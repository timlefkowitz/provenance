-- Add an optional display name override for creator sites.
-- When set, this replaces profile.name in the site header/logo.
-- Allows e.g. "FLIGHT" to appear instead of the profile name "Fl!ght".

ALTER TABLE profile_sites
  ADD COLUMN IF NOT EXISTS display_name text;

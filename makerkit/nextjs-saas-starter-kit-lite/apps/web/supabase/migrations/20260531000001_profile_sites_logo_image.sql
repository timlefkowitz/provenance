-- Add an optional logo image URL for creator sites.
-- When set, templates render this image instead of the text site name
-- in the hero / header area.

ALTER TABLE profile_sites
  ADD COLUMN IF NOT EXISTS logo_image_url text;

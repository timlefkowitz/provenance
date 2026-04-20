/*
 * -------------------------------------------------------
 * Artwork Featured on Homepage
 * Adds featured flag to artworks so admins can queue
 * a work for display on the landing page.
 * -------------------------------------------------------
 *
 * DATA SAFETY (review checklist):
 * - No DELETE, TRUNCATE, or DROP on user tables.
 * - Existing artworks: new columns only; all rows get featured = false and
 *   featured_at = NULL until an admin sets them (no mass update).
 * - Idempotent: ADD COLUMN / CREATE INDEX use IF NOT EXISTS; safe to retry.
 * - Email template: INSERT ... ON CONFLICT DO NOTHING so we never overwrite
 *   a row operators may have edited after first deploy (seed once only).
 */

-- Add featured columns to artworks
alter table public.artworks
  add column if not exists featured boolean not null default false,
  add column if not exists featured_at timestamptz;

comment on column public.artworks.featured is
  'True when this artwork is queued for display on the homepage';
comment on column public.artworks.featured_at is
  'Timestamp when an admin featured this artwork';

create index if not exists artworks_featured_idx on public.artworks(featured)
  where featured = true;

-- -------------------------------------------------------
-- Email template for artwork-featured notification
-- -------------------------------------------------------
insert into public.email_templates (template_key, subject, body_markdown)
values (
  'artwork_featured',
  'Congratulations – Your Work Has Been Queued for Our Landing Page!',
  E'Dear {{artistName}},\n\nWe are thrilled to share some wonderful news: your artwork **"{{artworkTitle}}"** has been selected and is now queued to be featured on the Provenance landing page.\n\nOur team personally reviews every piece that appears on the homepage, and yours stood out for its exceptional quality and provenance story. This is a remarkable achievement and a testament to the work you bring to the platform.\n\nYou can view your artwork at any time here: {{artworkUrl}}\n\nThank you for being a part of the Provenance community.\n\nWarm regards,\n**The Provenance Team**'
)
on conflict (template_key) do nothing;

/*
 * -------------------------------------------------------
 * CRM: add estimated_value, follow_up_date, source to artist_leads
 * DATA-SAFE: additive only (add column if not exists)
 * -------------------------------------------------------
 */

alter table public.artist_leads
  add column if not exists estimated_value numeric(12, 2),
  add column if not exists follow_up_date  date,
  add column if not exists source          text;

comment on column public.artist_leads.estimated_value is 'Estimated deal value in the artist''s currency';
comment on column public.artist_leads.follow_up_date  is 'Date to follow up with this contact';
comment on column public.artist_leads.source          is 'How the contact was acquired: art_fair, gallery, social_media, referral, website, direct, other';

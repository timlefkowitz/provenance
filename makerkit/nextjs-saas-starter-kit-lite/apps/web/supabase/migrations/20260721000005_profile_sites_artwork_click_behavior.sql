/*
 * Add artwork_click_behavior column to profile_sites.
 *
 * Controls what happens when a visitor clicks an artwork thumbnail on a
 * creator site.  Three modes:
 *   'page'     – navigate to the /works/[id] detail page (default, existing behavior)
 *   'modal'    – open a quick-view popup with image, title, price, inquire/buy CTAs
 *   'lightbox' – open a full-screen lightbox gallery with prev/next navigation
 *
 * DATA SAFETY:
 * - No DELETE, TRUNCATE, or DROP TABLE.
 * - No existing column data is modified.
 * - All existing rows receive the 'page' default, preserving current behavior.
 * - RLS policies, triggers, indexes, handles, and CHECK constraints are not touched.
 */

alter table public.profile_sites
  add column if not exists artwork_click_behavior text not null default 'page'
  check (artwork_click_behavior in ('page', 'modal', 'lightbox'));

comment on column public.profile_sites.artwork_click_behavior is
  'What happens when a visitor clicks an artwork thumbnail: page (detail page), modal (quick-view popup), or lightbox (full-screen gallery with prev/next).';

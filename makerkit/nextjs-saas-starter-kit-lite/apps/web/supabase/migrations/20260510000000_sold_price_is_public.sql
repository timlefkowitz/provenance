/*
 * -------------------------------------------------------
 * Add sold_price_is_public to artworks and sales_ledger
 *
 * Sale prices are private by default (false). The seller can opt-in
 * to showing the price publicly when recording a sale. This controls
 * visibility on the public certificate / provenance page.
 * -------------------------------------------------------
 */

alter table public.artworks
  add column if not exists sold_price_is_public boolean not null default false;

comment on column public.artworks.sold_price_is_public is
  'When false (default) the sold_price_cents is only visible to the seller and buyer. Set to true to show it publicly on the certificate.';

alter table public.sales_ledger
  add column if not exists price_is_public boolean not null default false;

comment on column public.sales_ledger.price_is_public is
  'Mirrors artworks.sold_price_is_public at time of sale creation. When false (default) the price is only shown to the seller and buyer.';

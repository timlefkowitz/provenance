-- Collectors page data fix, 2026-11-09.
-- Built from the live rows. Every statement targets exact ids, so it is safe to
-- re-run. Paste into the Supabase SQL editor. Ends with ROLLBACK: check the
-- final select, then change ROLLBACK to COMMIT and run again.

begin;

-- ───────── 1. Remove the $1,000,000 Bryson Brooks buy ─────────
-- "Dawn over the Valley" (b2c8948c…). The ledger price was already cleared;
-- the $1,000,000 came from the "value" on Bryson's Certificate of Ownership
-- (bcd1cf1b…), which the page used as the price.

delete from public.provenance_events
where event_type = 'sale'
  and (artwork_id = 'b2c8948c-b7a5-48cb-8f81-36a418b30c64'
       or metadata->>'sale_id' = '44f3c7da-bcae-4699-94ba-a292e964b45f');

delete from public.sales_ledger
where id = '44f3c7da-bcae-4699-94ba-a292e964b45f';

update public.artworks
set is_sold = false, sold_at = null, sold_price_cents = null,
    sold_to_account_id = null, sold_to_email = null, sold_to_name = null
where id = 'b2c8948c-b7a5-48cb-8f81-36a418b30c64';

update public.artworks
set value = null
where source_artwork_id = 'b2c8948c-b7a5-48cb-8f81-36a418b30c64'
  and value = '1,000,000';


-- ───────── 2. Record the sale prices that were only estimated ─────────
-- These sales had no price, so the page showed "incl. est." using each work's
-- show list price. This records that list price as the sale price.
-- ASSUMPTION: each work sold at its list price. Edit any amount that differs.

with prices(sale_id, artwork_id, cents) as (values
  ('26abc88f-6cae-45df-859e-cb76aa310199'::uuid, '7cbe5dcf-9670-4240-9447-6cf8198c39be'::uuid,  45000), -- Gran Errores Y Chicharrones → jason.patrick.lincoln
  ('ed9a7965-f091-4140-905b-1d94165da590',       '95232dd9-8f9f-4ae8-bdc6-cd2636f018c4',       260000), -- Free Luigi → rachael.s.oelsen
  ('da2a5c52-ca3b-4e2a-8cd8-b9b593c573d7',       '43dc4a98-d950-4fde-9a32-5be12cb34e99',       225000), -- She Was a Fighter → Brian Feinstein
  ('d8374f81-ef3f-4f50-9dd9-edff0e8b99bb',       'e41c6484-7c09-4920-bda6-b3cdd60bf97f',        30800), -- Star Mommy → gamblers.anonymous
  ('4b026fe4-9cfa-4a66-83c3-fd9c970b3ac5',       '1a737646-57fa-469b-925c-83903350efaf',        30800), -- Gone West → ruthie.edmondson.us
  ('353be207-e557-4529-b533-8d5507711925',       '72919391-f750-4f48-a11f-41c6907c5133',        30800), -- Up&Up → cixdr
  ('4ce1d8e4-2b87-4551-b698-6e8a41c03cd3',       'd102e233-b52e-4f56-abc6-b364b3945684',        20000), -- Globular Cluster 1 (3) → kstroempl
  ('c4faf242-93f9-469c-864c-c9f2cd474a7c',       'cb31c799-951b-4d2d-b273-4a6f08571a93',        75000), -- Bully Moon II → obiwanmd
  ('26cfcedf-d8e5-40c0-8fd3-8825be22fe2a',       '5299f971-f3b0-4b78-983a-a1b89a226d05',        35000), -- Untitled Head #4 → obiwanmd
  ('603decd2-4221-4ad0-a30e-87e445d9eece',       '01dfdc81-3c95-4b76-9a80-426e949d5932',        35000), -- Untitled Head #2 → jamessteinlemusic
  ('ba2aefcf-10ae-4c46-af18-9847a4b0a7b3',       '36ca0e68-c222-46b5-9eb8-7c38c434878d',        75000), -- Chinny Chin Chin → coach.wadsworth
  ('40289c7b-41e0-4063-abef-8d10c6105eaa',       '4030ca28-cfcd-45fd-bb5d-76d97fbed935',        75000), -- Mezzanine → jesse@180grams
  ('4c95b6c6-3125-4e2b-9213-c45147ebe7d1',       'bbd68b08-4749-432a-a6cc-fdcf544e59d1',        75000), -- Glowray → luke.hill246
  ('e578e846-1f26-4f7a-bfa3-271811a737db',       '8db75448-8cb2-47b9-8817-d5fe72908c55',        10000)  -- IMG_4791 → davidn@weitzmangroup
),
ledger as (
  update public.sales_ledger s
  set price_cents = p.cents
  from prices p
  where s.id = p.sale_id and s.price_cents is null
  returning s.id
),
events as (
  update public.provenance_events e
  set metadata = jsonb_set(e.metadata, '{price_cents}', to_jsonb(p.cents))
  from prices p
  where e.event_type = 'sale'
    and e.metadata->>'sale_id' = p.sale_id::text
    and e.metadata->>'price_cents' is null
  returning e.id
)
update public.artworks a
set sold_price_cents = p.cents
from prices p
where a.id = p.artwork_id and a.sold_price_cents is null;


-- ───────── 3. Remove a broken $0 valuation ─────────
-- Up&Up has one valuation row with estimated_value_cents = 0.
delete from public.artwork_valuations
where artwork_id = '72919391-f750-4f48-a11f-41c6907c5133'
  and estimated_value_cents = 0;


-- ───────── 4. Still missing: needs your input ─────────
-- Jason Blake bought "Untited" by Bryson Brooks (Apr 23, 2026) with no price
-- and no value anywhere. Fill in the amount (in cents) and uncomment:
-- update public.sales_ledger set price_cents = 0000
--   where id = '45ff935b-9110-49d4-bc8b-0077d5a13975';
-- update public.artworks set sold_price_cents = 0000
--   where id = 'be305c8b-3847-4517-8837-c29a5adcdc9b';


-- ───────── Check ─────────
select a.title, s.sold_to_name, s.sold_to_email, s.price_cents / 100.0 as price, a.sold_price_cents / 100.0 as artwork_price
from public.sales_ledger s
join public.artworks a on a.id = s.artwork_id
where s.id in (
  '26abc88f-6cae-45df-859e-cb76aa310199','ed9a7965-f091-4140-905b-1d94165da590','da2a5c52-ca3b-4e2a-8cd8-b9b593c573d7',
  'd8374f81-ef3f-4f50-9dd9-edff0e8b99bb','4b026fe4-9cfa-4a66-83c3-fd9c970b3ac5','353be207-e557-4529-b533-8d5507711925',
  '4ce1d8e4-2b87-4551-b698-6e8a41c03cd3','c4faf242-93f9-469c-864c-c9f2cd474a7c','26cfcedf-d8e5-40c0-8fd3-8825be22fe2a',
  '603decd2-4221-4ad0-a30e-87e445d9eece','ba2aefcf-10ae-4c46-af18-9847a4b0a7b3','40289c7b-41e0-4063-abef-8d10c6105eaa',
  '4c95b6c6-3125-4e2b-9213-c45147ebe7d1','e578e846-1f26-4f7a-bfa3-271811a737db','45ff935b-9110-49d4-bc8b-0077d5a13975',
  '44f3c7da-bcae-4699-94ba-a292e964b45f')
order by a.title;
-- Expect 15 rows (the Bryson Brooks one is gone), all priced except "Untited".

rollback;  -- change to COMMIT once the check looks right

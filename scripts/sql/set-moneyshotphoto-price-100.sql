-- Set price and value to $100 on every artwork owned by the user "moneyshotphoto".
-- Run in the Supabase SQL editor. Step 1 is read-only; run it first and check
-- that it returns exactly the 5 photos you expect before running step 2.

-- ── Step 1: preview ─────────────────────────────────────────────────────────
select a.id, a.title, a.value, a.sale_price, a.for_sale,
       acc.name as account_name, acc.email
from public.artworks a
join public.accounts acc on acc.id = a.account_id
where acc.email ilike 'moneyshotphoto%'
   or acc.name ilike '%moneyshotphoto%'
   or acc.id in (select up.user_id from public.user_profiles up
                 where up.name ilike '%moneyshotphoto%')
order by a.created_at;

-- ── Step 2: update (all-or-nothing; aborts unless exactly 5 rows match) ────
do $$
declare
  n int;
begin
  update public.artworks a
     set value      = '$100',
         sale_price = 100.00,
         updated_at = now()
    from public.accounts acc
   where acc.id = a.account_id
     and (acc.email ilike 'moneyshotphoto%'
          or acc.name ilike '%moneyshotphoto%'
          or acc.id in (select up.user_id from public.user_profiles up
                        where up.name ilike '%moneyshotphoto%'));
  get diagnostics n = row_count;
  if n <> 5 then
    raise exception 'Expected 5 artworks, matched %; rolled back', n;
  end if;
  raise notice 'Updated % artworks', n;
end $$;

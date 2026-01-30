# Why /artworks might show no items (170 in DB)

The `/artworks` page only shows rows that match **both**:

- `status = 'verified'`
- `is_public = true`

Anonymous and signed-in users both rely on RLS policies that allow `SELECT` only for those rows. So “no artworks” can be due to:

1. **RLS / grants** – `anon` can’t `SELECT`, or policies are missing/wrong.
2. **Data** – No rows have `status = 'verified'` and `is_public = true` (e.g. all `draft` or `is_public = false`).

## Step 1: Run the diagnostic

In **Supabase → SQL Editor**, run:

**`ARTWORKS_VISIBILITY_DIAGNOSTIC.sql`**

Check the result of **query 4** (“Data: counts that drive visibility”):

- **`visible_in_feed_count`** = number of rows that satisfy the app + RLS filter.
- If **`visible_in_feed_count` = 0** but **`total_rows` > 0**, look at **query 5** and **6** to see actual `status` and `is_public` values.

Interpretation:

- **`visible_in_feed_count` = 0** and most rows have `status = 'draft'` (or not `'verified'`) or `is_public = false`  
  → **Data issue.** Fix by updating data (see Step 3) and/or ensure new artworks are created with `status: 'verified'` and `is_public: true`.

- **`visible_in_feed_count` > 0** but the site still shows nothing  
  → **RLS/grants issue.** Fix by running the visibility fix script (Step 2).

- In **query 3**, if **`anon`** does **not** have **`SELECT`** on `public.artworks`  
  → Run the fix script (Step 2) so anon can read.

## Step 2: Fix RLS and grants (if diagnostic says so)

In **Supabase → SQL Editor**, run:

**`FIX_ARTWORKS_VISIBILITY.sql`**

This script:

- Grants `SELECT` on `public.artworks` to `anon`.
- Ensures the gallery helper function exists (for `artworks_read_own`).
- Recreates `artworks_read_public` and `artworks_read_own` so that:
  - Anyone (anon + authenticated) can see rows with `status = 'verified'` and `is_public = true`.
  - Authenticated users can also see their own rows (and gallery-member rows).

If you don’t have a `gallery_members` table and the script fails on the function or policy, use the “If you don’t have gallery_members” block at the bottom of the script (simpler `artworks_read_own` with only `account_id = auth.uid()`).

## Step 3: Fix data (only if diagnostic shows a data issue)

Use **`ARTWORKS_DATA_FIX_IF_NEEDED.sql`** only after confirming from the diagnostic that the problem is missing `status = 'verified'` or `is_public = true`.

- **Option A**: Set all existing artworks to `verified` + public (uncomment and run only if that’s correct for your app).
- **Option B**: Set only certain rows (e.g. those with `certificate_number`) to `verified` + public; adjust the `WHERE` clause to match your rules.

After any update, re-run the diagnostic **query 4** to confirm `visible_in_feed_count` is as expected.

## Summary

| Diagnostic result | Action |
|-------------------|--------|
| `anon` missing `SELECT` or policies wrong | Run **FIX_ARTWORKS_VISIBILITY.sql** |
| `visible_in_feed_count` = 0, wrong `status`/`is_public` | Run **ARTWORKS_DATA_FIX_IF_NEEDED.sql** (and optionally fix script) |
| Both | Run fix script first, then data fix if still 0 visible |

Your app already creates new artworks with `status: 'verified'` and (where applicable) public; the data fix is only for existing rows that were created before that or by another path.

/*
 * -------------------------------------------------------
 * Ensure anon can see public artworks after gallery members RLS
 *
 * The base schema (20241219010757_schema.sql) revokes all privileges
 * on schema public from anon and never grants USAGE. So anon cannot
 * access any table in public even when table-level SELECT is granted.
 *
 * This migration:
 * 1. Grants USAGE on schema public to anon (required to access tables)
 * 2. Grants SELECT on public.artworks to anon (idempotent)
 * 3. Ensures artworks_read_public policy exists so anon sees verified+public rows
 *
 * SAFE: Only adds grants and ensures policy; does not modify or delete data.
 * -------------------------------------------------------
 */

-- 1. Anon must have USAGE on schema public to access tables (base schema never grants this)
grant usage on schema public to anon;

-- 2. Anon must have SELECT on artworks (idempotent; may already exist from earlier migrations)
grant select on table public.artworks to anon;

-- 3. Ensure public read policy exists (in case it was dropped or altered)
drop policy if exists artworks_read_public on public.artworks;
create policy artworks_read_public on public.artworks
    for select
    to anon, authenticated
    using (
        status = 'verified'
        and is_public = true
    );

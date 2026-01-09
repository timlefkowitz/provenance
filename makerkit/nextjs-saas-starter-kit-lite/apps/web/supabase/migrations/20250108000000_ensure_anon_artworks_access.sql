/*
 * -------------------------------------------------------
 * Ensure Anonymous Access to Artworks
 * 
 * This migration ensures that anonymous users can read public artworks
 * even if the base schema revoked privileges from anon role.
 * 
 * SAFE MIGRATION - This migration:
 * - Only ADDS grants (does not delete or modify existing data)
 * - Only affects read access (SELECT), not write access
 * - Safe to run multiple times (idempotent)
 * - Does NOT modify RLS policies (those are handled by other migrations)
 * -------------------------------------------------------
 */

-- Ensure anon role can select from artworks table
-- This is needed because the base schema (20241219010757_schema.sql) 
-- revokes all privileges from anon role, so we need to explicitly grant it back
grant select on table public.artworks to anon;

-- Note: RLS policies are handled by:
-- 1. 20250103000000_create_artworks.sql - creates initial policy for verified artworks
-- 2. 20250106000000_add_artwork_privacy.sql - updates policy to also check is_public
-- This migration only ensures the grant is in place


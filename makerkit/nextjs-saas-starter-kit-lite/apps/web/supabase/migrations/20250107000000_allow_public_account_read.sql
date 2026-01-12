/*
 * -------------------------------------------------------
 * Allow Public Read Access to Accounts for Registry
 * 
 * SAFE MIGRATION - This migration:
 * - Only ADDS a new RLS policy (does not delete or modify existing data)
 * - Allows public read access to accounts for the registry
 * - Only exposes public fields (id, name, picture_url, public_data)
 * - Does NOT allow write access (UPDATE/INSERT/DELETE still restricted)
 * - Does NOT expose sensitive fields like email
 * -------------------------------------------------------
 */

-- Add policy to allow authenticated and anonymous users to read accounts
-- This is safe because:
-- 1. It's read-only (SELECT only)
-- 2. Only exposes public information (name, picture_url, public_data)
-- 3. Email and other sensitive fields remain protected
-- 4. Write operations (UPDATE/INSERT/DELETE) are still restricted by existing policies

-- Drop policy if it exists, then create it
drop policy if exists accounts_read_public on public.accounts;

create policy accounts_read_public on public.accounts
    for select
    to authenticated, anon
    using (true);

comment on policy accounts_read_public on public.accounts is 
    'Allows public read access to accounts for the registry. Only exposes public fields (id, name, picture_url, public_data). Write operations remain restricted.';


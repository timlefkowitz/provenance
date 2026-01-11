/*
 * -------------------------------------------------------
 * Welcome Email Support
 * 
 * Note: Welcome emails are sent from the auth callback route
 * in the application (src/app/auth/callback/route.ts) which
 * checks if an account was created in the last 2 minutes.
 * 
 * This migration is kept for future use if we want to add
 * database-level email sending via pg_net extension.
 * -------------------------------------------------------
 */

-- This migration is intentionally minimal.
-- The welcome email functionality is handled in the application
-- layer (auth callback route) for simplicity and reliability.


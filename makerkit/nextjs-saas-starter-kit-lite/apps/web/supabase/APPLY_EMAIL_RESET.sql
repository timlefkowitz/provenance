/*
 * APPLY_EMAIL_RESET.sql
 *
 * Run in the Supabase SQL Editor to pick up the new minimal email design defaults.
 *
 * WHAT THIS DOES:
 * - Deletes saved email template rows so the app falls back to code defaults in src/lib/email-defaults.ts
 * - Resets email_settings to the minimal theme masthead
 *
 * SAFE: only touches email_templates and email_settings — no user/artwork data.
 *
 * After running, visit /admin/emails to preview and optionally re-save templates.
 */

-- Clear admin-overridden template copy (code defaults will be used)
delete from public.email_templates;

-- Reset global theme to minimal defaults
delete from public.email_settings;

insert into public.email_settings (
  layout_preset,
  parchment,
  ink,
  wine,
  ink_subtitle,
  ink_muted,
  masthead_title,
  masthead_subtitle
) values (
  'minimal',
  '#FAFAFA',
  '#111111',
  '#111111',
  '#737373',
  '#737373',
  'PROVENANCE',
  'Artwork registry'
);

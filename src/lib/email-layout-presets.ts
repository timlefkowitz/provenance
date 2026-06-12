/**
 * Single minimal transactional email theme — shared Markdown → HTML pipeline.
 */

import type { EmailLayoutPresetId, EmailTheme } from './email-layout';

export const EMAIL_LAYOUT_PRESET_IDS = ['minimal'] as const;

/** UI label — admin (single design, no picker). */
export const EMAIL_LAYOUT_PRESET_LABELS: Record<EmailLayoutPresetId, string> = {
  minimal: 'Minimal',
};

/** Legacy DB values (studio / heritage / archive) all resolve to minimal. */
export function normalizeEmailLayoutPreset(_value: unknown): EmailLayoutPresetId {
  return 'minimal';
}

/** Persisted editable fields (= `email_settings` row). Masthead only — colors are fixed. */
export type AdminEmailThemeDraft = {
  masthead_title: string;
  masthead_subtitle: string;
};

const MINIMAL_THEME: EmailTheme = {
  preset: 'minimal',
  parchment: '#FAFAFA',
  cardBg: '#FFFFFF',
  cardBorder: '#E5E5E5',
  ink: '#111111',
  wine: '#111111',
  inkSubtitle: '#737373',
  inkMuted: '#737373',
  surfaceMuted: '#F5F5F5',
  mastheadTitle: 'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyHeading:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  footerRule: '#E5E5E5',
};

export function getPresetThemeDefaults(_preset: EmailLayoutPresetId = 'minimal'): EmailTheme {
  return MINIMAL_THEME;
}

/**
 * Merge stored `email_settings` masthead onto the minimal skeleton.
 * Legacy color overrides in the DB are ignored so the design stays consistent.
 */
export function mergeEmailSettingsIntoTheme(row: {
  layout_preset?: string | null;
  parchment?: string | null;
  ink?: string | null;
  wine?: string | null;
  ink_subtitle?: string | null;
  ink_muted?: string | null;
  masthead_title?: string | null;
  masthead_subtitle?: string | null;
}): EmailTheme {
  const base = MINIMAL_THEME;
  return {
    ...base,
    mastheadTitle: row.masthead_title?.trim() || base.mastheadTitle,
    mastheadSubtitle: row.masthead_subtitle?.trim() || base.mastheadSubtitle,
  };
}

/** Admin form → rendered transactional theme (single source for preview + production). */
export function resolveEmailThemeFromAdminDraft(draft: AdminEmailThemeDraft): EmailTheme {
  return mergeEmailSettingsIntoTheme(draft);
}

/** Default admin draft when DB has no row. */
export function defaultAdminEmailThemeDraft(): AdminEmailThemeDraft {
  const p = MINIMAL_THEME;
  return {
    masthead_title: p.mastheadTitle,
    masthead_subtitle: p.mastheadSubtitle,
  };
}

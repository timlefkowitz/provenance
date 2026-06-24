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
  // Luxe-dark palette
  parchment: '#0E0B0A',       // deep espresso canvas
  cardBg: '#171311',          // warm charcoal card
  cardBorder: '#3A2E25',      // warm hairline
  ink: '#F3ECDD',             // warm cream text
  wine: '#C9A24B',            // gold accent (buttons, links, wordmark)
  accentText: '#FFFFFF',      // white label on gold button
  inkSubtitle: '#B8A98C',     // muted cream subtitle
  inkMuted: '#9B8E78',        // footer / hint text
  surfaceMuted: '#241C16',    // blockquote / code tint
  mastheadTitle: 'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontFamilyHeading:
    "'Playfair Display', Georgia, 'Times New Roman', serif",
  footerRule: '#3A2E25',
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

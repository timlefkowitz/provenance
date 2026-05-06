/**
 * Three art-platform transactional email presets — distinct typography,
 * palettes, and layout chrome while sharing the same Markdown → HTML pipeline.
 */

import type { EmailLayoutPresetId, EmailTheme } from './email-layout';

export const EMAIL_LAYOUT_PRESET_IDS = ['studio', 'heritage', 'archive'] as const;

/** UI labels — admin picker */
export const EMAIL_LAYOUT_PRESET_LABELS: Record<EmailLayoutPresetId, string> = {
  studio: 'Studio — Editorial (museum black bar)',
  heritage: 'Heritage — Letterpress warmth',
  archive: 'Archive — Institutional registrar record',
};

export function normalizeEmailLayoutPreset(value: unknown): EmailLayoutPresetId {
  const s = typeof value === 'string' ? value.toLowerCase().trim() : '';
  if (s === 'heritage' || s === 'studio' || s === 'archive') {
    return s;
  }
  return 'studio';
}

/** Persisted editable fields (= `email_settings` row + preset). Mirrors admin form keys. */
export type AdminEmailThemeDraft = {
  layout_preset: EmailLayoutPresetId;
  parchment: string;
  ink: string;
  wine: string;
  ink_subtitle: string;
  ink_muted: string;
  masthead_title: string;
  masthead_subtitle: string;
};

/** Full semantic tokens per preset (before merging DB overrides). */
const PRESET_THEME: Record<EmailLayoutPresetId, EmailTheme> = {
  studio: {
    preset: 'studio',
    parchment: '#F5F5F7',
    cardBg: '#FFFFFF',
    cardBorder: '#E4E4E7',
    ink: '#18181B',
    wine: '#09090B',
    inkSubtitle: '#A1A1AA',
    inkMuted: '#71717A',
    surfaceMuted: '#F4F4F5',
    mastheadTitle: 'PROVENANCE',
    mastheadSubtitle: 'ARTWORK REGISTRY PLATFORM',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyHeading:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    footerRule: '#E4E4E7',
    bannerBg: '#09090B',
    bannerText: '#FAFAFA',
    bannerMuted: '#A1A1AA',
    accentLine: undefined,
    mastheadMonoLabel: undefined,
  },
  heritage: {
    preset: 'heritage',
    parchment: '#F5F3EE',
    cardBg: '#FFFCF7',
    cardBorder: '#E8E4DD',
    ink: '#292524',
    wine: '#6B3630',
    inkSubtitle: '#78716C',
    inkMuted: '#78716C',
    surfaceMuted: '#FBF9F6',
    mastheadTitle: 'PROVENANCE',
    mastheadSubtitle: 'PRESERVING CULTURAL HERITAGE',
    fontFamily:
      '"Iowan Old Style","Book Antiqua",Georgia,"Palatino Linotype","Times New Roman",serif',
    fontFamilyHeading:
      '"Iowan Old Style","Book Antiqua",Georgia,"Palatino Linotype","Times New Roman",serif',
    footerRule: '#D6CEC3',
    bannerBg: undefined,
    bannerText: undefined,
    bannerMuted: undefined,
    accentLine: '#C4A574',
    mastheadMonoLabel: undefined,
  },
  archive: {
    preset: 'archive',
    parchment: '#EAEDEF',
    cardBg: '#FFFFFF',
    cardBorder: '#D1D8E0',
    ink: '#0F172A',
    wine: '#1E293B',
    inkSubtitle: '#475569',
    inkMuted: '#64748B',
    surfaceMuted: '#F1F5F9',
    mastheadTitle: 'PROVENANCE',
    mastheadSubtitle: 'REGISTRY & CERTIFICATES',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontFamilyHeading:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    footerRule: '#CBD5E1',
    bannerBg: undefined,
    bannerText: undefined,
    bannerMuted: undefined,
    accentLine: '#475569',
    mastheadMonoLabel: 'REGISTRY MAIL',
  },
};

export function getPresetThemeDefaults(preset: EmailLayoutPresetId): EmailTheme {
  return PRESET_THEME[preset];
}

/**
 * Merge stored `email_settings` row colors/titles onto the selected preset skeleton.
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
  const preset = normalizeEmailLayoutPreset(row.layout_preset);
  const base = PRESET_THEME[preset];
  return {
    ...base,
    preset,
    parchment: row.parchment?.trim() || base.parchment,
    ink: row.ink?.trim() || base.ink,
    wine: row.wine?.trim() || base.wine,
    inkSubtitle: row.ink_subtitle?.trim() || base.inkSubtitle,
    inkMuted: row.ink_muted?.trim() || base.inkMuted,
    mastheadTitle: row.masthead_title?.trim() || base.mastheadTitle,
    mastheadSubtitle: row.masthead_subtitle?.trim() || base.mastheadSubtitle,
  };
}

/** Admin form → rendered transactional theme (single source for preview + production). */
export function resolveEmailThemeFromAdminDraft(draft: AdminEmailThemeDraft): EmailTheme {
  return mergeEmailSettingsIntoTheme(draft);
}

/** Apply a new preset selection and reset swatches to its defaults (recommended UX when switching designs). */
export function adminDraftDefaultsForPreset(
  preset: EmailLayoutPresetId,
): Omit<AdminEmailThemeDraft, 'masthead_title' | 'masthead_subtitle'> {
  const p = PRESET_THEME[preset];
  return {
    layout_preset: preset,
    parchment: p.parchment,
    ink: p.ink,
    wine: p.wine,
    ink_subtitle: p.inkSubtitle,
    ink_muted: p.inkMuted,
  };
}

/** Default admin draft when DB has no row. */
export function defaultAdminEmailThemeDraft(): AdminEmailThemeDraft {
  const p = PRESET_THEME.studio;
  return {
    layout_preset: 'studio',
    parchment: p.parchment,
    ink: p.ink,
    wine: p.wine,
    ink_subtitle: p.inkSubtitle,
    ink_muted: p.inkMuted,
    masthead_title: p.mastheadTitle,
    masthead_subtitle: p.mastheadSubtitle,
  };
}

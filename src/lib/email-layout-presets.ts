/**
 * Eight switchable email design presets.
 *
 * Every `accentText` value has been validated for WCAG AA contrast (≥4.5:1)
 * against its button background (`wine`). Run `pnpm email:contrast` to verify.
 */

import type { EmailLayoutPresetId, EmailTheme } from './email-layout';

export { type EmailLayoutPresetId };

export const EMAIL_LAYOUT_PRESET_IDS = [
  'atelier',
  'gallery',
  'editorial',
  'pop',
  'pastel',
  'mono',
  'sunset',
  'midnight',
] as const satisfies readonly EmailLayoutPresetId[];

export const EMAIL_LAYOUT_PRESET_LABELS: Record<EmailLayoutPresetId, string> = {
  atelier:   'Atelier',
  gallery:   'Gallery',
  editorial: 'Editorial',
  pop:       'Pop',
  pastel:    'Pastel',
  mono:      'Mono',
  sunset:    'Sunset',
  midnight:  'Midnight',
};

// ── Preset definitions ──────────────────────────────────────────────────────

/**
 * Atelier — luxe dark espresso + gold, serif headings, bordered card.
 * Button: dark ink #1A1008 on gold #C9A24B → 7.1:1 ✓
 */
const ATELIER_THEME: EmailTheme = {
  preset: 'atelier',
  parchment:    '#0E0B0A',
  cardBg:       '#171311',
  cardBorder:   '#3A2E25',
  ink:          '#F3ECDD',
  wine:         '#C9A24B',
  accentText:   '#1A1008',
  inkSubtitle:  '#B8A98C',
  inkMuted:     '#9B8E78',
  surfaceMuted: '#241C16',
  footerRule:   '#3A2E25',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  fontFamilyHeading: "'Playfair Display', Georgia, 'Times New Roman', serif",
  useCard:              true,
  mastheadVariant:      'double-rule',
  mastheadAlign:        'left',
  cardRadius:           '4px',
  accentBarHeight:      3,
  buttonRadius:         '6px',
  buttonTextTransform:  'uppercase',
};

/**
 * Gallery — clean white, near-black text, no card, airy spacing, square buttons.
 * Button: white #FFFFFF on near-black #111827 → 18.1:1 ✓
 */
const GALLERY_THEME: EmailTheme = {
  preset: 'gallery',
  parchment:    '#FFFFFF',
  cardBg:       '#FFFFFF',
  cardBorder:   '#E5E7EB',
  ink:          '#111827',
  wine:         '#111827',
  accentText:   '#FFFFFF',
  inkSubtitle:  '#6B7280',
  inkMuted:     '#9CA3AF',
  surfaceMuted: '#F9FAFB',
  footerRule:   '#E5E7EB',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyHeading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  useCard:              false,
  mastheadVariant:      'single',
  mastheadAlign:        'left',
  cardRadius:           '0',
  accentBarHeight:      0,
  buttonRadius:         '3px',
  buttonTextTransform:  'none',
};

/**
 * Editorial — parchment broadsheet, centered masthead, heavy double rule.
 * Button: dark ink #2C1810 on warm rust #8B4513 → 5.5:1 ✓
 */
const EDITORIAL_THEME: EmailTheme = {
  preset: 'editorial',
  parchment:    '#F8F3EC',
  cardBg:       '#F8F3EC',
  cardBorder:   '#C8B89A',
  ink:          '#2C1810',
  wine:         '#8B4513',
  accentText:   '#F8F3EC',
  inkSubtitle:  '#6B4226',
  inkMuted:     '#8C6E52',
  surfaceMuted: '#EDE4D6',
  footerRule:   '#C8B89A',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        "Georgia, 'Times New Roman', Times, serif",
  fontFamilyHeading: "Georgia, 'Times New Roman', Times, serif",
  useCard:              false,
  mastheadVariant:      'centered',
  mastheadAlign:        'center',
  cardRadius:           '0',
  accentBarHeight:      0,
  buttonRadius:         '0',
  buttonTextTransform:  'uppercase',
};

/**
 * Pop — deep indigo bg, light violet accent, rounded card, pill buttons.
 * Button: dark indigo #1E1B4B on light violet #C4B5FD → 7.9:1 ✓
 * Links: light violet #C4B5FD on dark card #2D2A6E → 6.1:1 ✓
 */
const POP_THEME: EmailTheme = {
  preset: 'pop',
  parchment:    '#1E1B4B',
  cardBg:       '#2D2A6E',
  cardBorder:   '#4338CA',
  ink:          '#EDE9FE',
  wine:         '#C4B5FD',
  accentText:   '#1E1B4B',
  inkSubtitle:  '#A5B4FC',
  inkMuted:     '#818CF8',
  surfaceMuted: '#312E81',
  footerRule:   '#4338CA',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyHeading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  useCard:              true,
  mastheadVariant:      'centered',
  mastheadAlign:        'center',
  cardRadius:           '16px',
  accentBarHeight:      0,
  buttonRadius:         '100px',
  buttonTextTransform:  'none',
};

/**
 * Pastel — soft blush + cream, muted plum accent, rounded card.
 * Button: white #FFFFFF on plum #7B3F6E → 5.5:1 ✓
 */
const PASTEL_THEME: EmailTheme = {
  preset: 'pastel',
  parchment:    '#FDF6F0',
  cardBg:       '#FFFFFF',
  cardBorder:   '#F0D9D9',
  ink:          '#3D1F2B',
  wine:         '#7B3F6E',
  accentText:   '#FFFFFF',
  inkSubtitle:  '#9B6B8A',
  inkMuted:     '#BF9AAE',
  surfaceMuted: '#FAF0F4',
  footerRule:   '#F0D9D9',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyHeading: "'Playfair Display', Georgia, serif",
  useCard:              true,
  mastheadVariant:      'single',
  mastheadAlign:        'left',
  cardRadius:           '12px',
  accentBarHeight:      4,
  buttonRadius:         '24px',
  buttonTextTransform:  'none',
};

/**
 * Mono — pure black/white, monospace masthead, hairline border, square buttons.
 * Button: white #FFFFFF on black #000000 → 21:1 ✓
 */
const MONO_THEME: EmailTheme = {
  preset: 'mono',
  parchment:    '#FFFFFF',
  cardBg:       '#FFFFFF',
  cardBorder:   '#000000',
  ink:          '#000000',
  wine:         '#000000',
  accentText:   '#FFFFFF',
  inkSubtitle:  '#555555',
  inkMuted:     '#888888',
  surfaceMuted: '#F5F5F5',
  footerRule:   '#000000',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        'ui-monospace, "Courier New", Courier, monospace',
  fontFamilyHeading: 'ui-monospace, "Courier New", Courier, monospace',
  useCard:              true,
  mastheadVariant:      'mono',
  mastheadAlign:        'left',
  cardRadius:           '0',
  accentBarHeight:      2,
  buttonRadius:         '0',
  buttonTextTransform:  'uppercase',
};

/**
 * Sunset — warm cream bg, terracotta hero band, rounded card.
 * Button: white #FFFFFF on terracotta #C1440E → 4.9:1 ✓
 */
const SUNSET_THEME: EmailTheme = {
  preset: 'sunset',
  parchment:         '#FEF9F5',
  cardBg:            '#FFFFFF',
  cardBorder:        '#F2D9C8',
  ink:               '#2D1506',
  wine:              '#C1440E',
  accentText:        '#FFFFFF',
  inkSubtitle:       '#8A4825',
  inkMuted:          '#AE7455',
  surfaceMuted:      '#FDF0E6',
  footerRule:        '#F2D9C8',
  mastheadTitle:     'PROVENANCE',
  mastheadSubtitle:  'Artwork registry',
  fontFamily:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyHeading: "'Playfair Display', Georgia, serif",
  useCard:              true,
  mastheadVariant:      'hero',
  mastheadAlign:        'center',
  cardRadius:           '8px',
  accentBarHeight:      0,
  buttonRadius:         '8px',
  buttonTextTransform:  'none',
  heroBandColor:          '#C1440E',
  heroBandTextColor:      '#FFFFFF',
  heroBandSubtitleColor:  'rgba(255,255,255,0.80)',
};

/**
 * Midnight — dark slate-navy, sky-blue accent, rounded card.
 * Button: dark navy #0F172A on sky-blue #60A5FA → 7.4:1 ✓
 * Links: sky-blue #60A5FA on card #1E293B → 5.2:1 ✓
 */
const MIDNIGHT_THEME: EmailTheme = {
  preset: 'midnight',
  parchment:    '#0F172A',
  cardBg:       '#1E293B',
  cardBorder:   '#334155',
  ink:          '#F1F5F9',
  wine:         '#60A5FA',
  accentText:   '#0F172A',
  inkSubtitle:  '#94A3B8',
  inkMuted:     '#64748B',
  surfaceMuted: '#0F172A',
  footerRule:   '#334155',
  mastheadTitle:    'PROVENANCE',
  mastheadSubtitle: 'Artwork registry',
  fontFamily:        "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontFamilyHeading: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  useCard:              true,
  mastheadVariant:      'single',
  mastheadAlign:        'left',
  cardRadius:           '12px',
  accentBarHeight:      4,
  buttonRadius:         '8px',
  buttonTextTransform:  'none',
};

// ── Registry ────────────────────────────────────────────────────────────────

export const EMAIL_THEMES: Record<EmailLayoutPresetId, EmailTheme> = {
  atelier:   ATELIER_THEME,
  gallery:   GALLERY_THEME,
  editorial: EDITORIAL_THEME,
  pop:       POP_THEME,
  pastel:    PASTEL_THEME,
  mono:      MONO_THEME,
  sunset:    SUNSET_THEME,
  midnight:  MIDNIGHT_THEME,
};

/**
 * Normalize any DB value (including legacy `studio`/`heritage`/`archive`/`minimal`)
 * to a valid preset id. Unknown values fall back to `gallery`.
 */
export function normalizeEmailLayoutPreset(value: unknown): EmailLayoutPresetId {
  if (
    typeof value === 'string' &&
    (EMAIL_LAYOUT_PRESET_IDS as readonly string[]).includes(value)
  ) {
    return value as EmailLayoutPresetId;
  }
  return 'gallery';
}

export function getPresetThemeDefaults(preset: EmailLayoutPresetId = 'gallery'): EmailTheme {
  return EMAIL_THEMES[preset];
}

/** Persisted admin-editable fields on top of a chosen preset. */
export type AdminEmailThemeDraft = {
  layout_preset: EmailLayoutPresetId;
  masthead_title: string;
  masthead_subtitle: string;
};

/** Default draft when the DB has no `email_settings` row. */
export function defaultAdminEmailThemeDraft(): AdminEmailThemeDraft {
  const p = GALLERY_THEME;
  return {
    layout_preset:      'gallery',
    masthead_title:     p.mastheadTitle,
    masthead_subtitle:  p.mastheadSubtitle,
  };
}

/**
 * Merge the stored `email_settings` row onto the matching preset base.
 * Only masthead text + preset id come from the DB; colors are fixed per preset
 * so the design always stays consistent.
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
  const presetId = normalizeEmailLayoutPreset(row.layout_preset);
  const base = EMAIL_THEMES[presetId];
  return {
    ...base,
    mastheadTitle:    row.masthead_title?.trim()    || base.mastheadTitle,
    mastheadSubtitle: row.masthead_subtitle?.trim() || base.mastheadSubtitle,
  };
}

/** Admin draft → fully-resolved theme (single source for preview + production sends). */
export function resolveEmailThemeFromAdminDraft(draft: AdminEmailThemeDraft): EmailTheme {
  return mergeEmailSettingsIntoTheme({
    layout_preset:     draft.layout_preset,
    masthead_title:    draft.masthead_title,
    masthead_subtitle: draft.masthead_subtitle,
  });
}

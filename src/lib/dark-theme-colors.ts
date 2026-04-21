/**
 * dark-theme-colors.ts
 *
 * Shared utilities for the user-customisable dark/system theme colors.
 * Colors are persisted to localStorage and applied as CSS custom properties
 * on <html> so they cascade everywhere without per-component changes.
 *
 * Only four tokens drive the entire dark UI:
 *   accent   → --color-wine   (logo, headings, CTAs, link hovers, borders)
 *   body     → --color-ink    (body copy, nav links)
 *   surface  → --color-parchment (nav bg, card bg, elevated surfaces)
 *   canvas   → --background   (deepest page background)
 *
 * Additional Shadcn tokens (--foreground, --primary, --card, --ring …) are
 * kept in sync by applyDarkThemeColors() so Shadcn components also adapt.
 */

export type DarkThemeColors = {
  /** Accent: logo, headings, CTA fill, link hover, borders */
  accent: string;
  /** Body text: paragraphs, nav links, secondary text */
  body: string;
  /** Surface: nav bg, card bg, elevated panels */
  surface: string;
  /** Canvas: deepest page background */
  canvas: string;
};

/** Tokyo Night defaults — matches what we ship in .dark in shadcn-ui.css */
export const DARK_THEME_DEFAULTS: DarkThemeColors = {
  accent: '#7DCFFF',
  body:   '#C0CAF5',
  surface: '#16161E',
  canvas: '#1A1B26',
};

export const DARK_COLORS_KEY = 'provenance-dark-colors';
export const DARK_COLORS_CHANGED_EVENT = 'dark-theme-colors-changed';

/** Read saved colors from localStorage, falling back to defaults. */
export function readDarkThemeColors(): DarkThemeColors {
  if (typeof window === 'undefined') return DARK_THEME_DEFAULTS;
  try {
    const raw = localStorage.getItem(DARK_COLORS_KEY);
    if (!raw) return DARK_THEME_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DarkThemeColors>;
    return {
      accent:  parsed.accent  ?? DARK_THEME_DEFAULTS.accent,
      body:    parsed.body    ?? DARK_THEME_DEFAULTS.body,
      surface: parsed.surface ?? DARK_THEME_DEFAULTS.surface,
      canvas:  parsed.canvas  ?? DARK_THEME_DEFAULTS.canvas,
    };
  } catch {
    return DARK_THEME_DEFAULTS;
  }
}

/** Persist colors and fire a cross-component event so the applier reacts. */
export function saveDarkThemeColors(colors: DarkThemeColors): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DARK_COLORS_KEY, JSON.stringify(colors));
  window.dispatchEvent(new CustomEvent(DARK_COLORS_CHANGED_EVENT, { detail: colors }));
}

/** Reset to defaults (removes localStorage entry) and fire event. */
export function resetDarkThemeColors(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(DARK_COLORS_KEY);
  window.dispatchEvent(
    new CustomEvent(DARK_COLORS_CHANGED_EVENT, { detail: DARK_THEME_DEFAULTS }),
  );
}

/**
 * Inject (or update) the four brand tokens plus the Shadcn semantic tokens
 * that depend on them as inline styles on <html>. Safe to call on every
 * render — it only sets `style` properties, never touches the stylesheet.
 *
 * Call with `null` to remove all overrides (restores the stylesheet defaults).
 */
export function applyDarkThemeColors(colors: DarkThemeColors | null): void {
  if (typeof document === 'undefined') return;
  const el = document.documentElement;

  if (!colors) {
    // Remove every property we might have set
    const keys = [
      '--color-wine', '--color-ink', '--color-parchment',
      '--background', '--foreground',
      '--card', '--card-foreground',
      '--popover', '--popover-foreground',
      '--primary', '--primary-foreground',
      '--secondary', '--secondary-foreground',
      '--muted', '--muted-foreground',
      '--border', '--input', '--ring',
      '--sidebar-background', '--sidebar-foreground',
      '--sidebar-primary', '--sidebar-primary-foreground',
      '--sidebar-accent', '--sidebar-accent-foreground',
      '--sidebar-border', '--sidebar-ring',
    ];
    for (const k of keys) el.style.removeProperty(k);
    return;
  }

  const { accent, body, surface, canvas } = colors;

  // Brand tokens
  el.style.setProperty('--color-wine',      accent);
  el.style.setProperty('--color-ink',       body);
  el.style.setProperty('--color-parchment', surface);

  // Shadcn semantic tokens
  el.style.setProperty('--background',         canvas);
  el.style.setProperty('--foreground',         body);
  el.style.setProperty('--card',               surface);
  el.style.setProperty('--card-foreground',    body);
  el.style.setProperty('--popover',            surface);
  el.style.setProperty('--popover-foreground', body);
  el.style.setProperty('--primary',            accent);
  el.style.setProperty('--primary-foreground', canvas);
  el.style.setProperty('--ring',               accent);

  // Sidebar
  el.style.setProperty('--sidebar-background',         canvas);
  el.style.setProperty('--sidebar-foreground',         body);
  el.style.setProperty('--sidebar-primary',            accent);
  el.style.setProperty('--sidebar-primary-foreground', canvas);
  el.style.setProperty('--sidebar-ring',               accent);
}

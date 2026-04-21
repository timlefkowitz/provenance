'use client';

/**
 * DarkThemeColorApplier
 *
 * Invisible component that lives at the root of the app.
 * Reads the user's saved dark-theme color overrides from localStorage and
 * applies them as CSS custom properties on <html> whenever the active theme
 * is dark (or system + OS prefers dark).
 *
 * - On mount: applies saved colors (or defaults) immediately so there is no
 *   flash of un-customised color after hydration.
 * - Listens for `dark-theme-colors-changed` (fired by saveDarkThemeColors /
 *   resetDarkThemeColors) to apply updates instantly across the whole app
 *   without a page reload.
 * - Listens for `storage` events so cross-tab changes also propagate.
 * - Removes all overrides when the user switches to a non-dark theme so the
 *   stylesheet defaults (parchment / light) are unaffected.
 */

import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import {
  readDarkThemeColors,
  applyDarkThemeColors,
  DARK_COLORS_CHANGED_EVENT,
  type DarkThemeColors,
} from '~/lib/dark-theme-colors';

export function DarkThemeColorApplier() {
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const isDark = resolvedTheme === 'dark';

    if (isDark) {
      applyDarkThemeColors(readDarkThemeColors());
    } else {
      applyDarkThemeColors(null);
    }
  }, [resolvedTheme]);

  useEffect(() => {
    const onColorsChanged = (e: Event) => {
      const { resolvedTheme: currentResolved } = { resolvedTheme };
      if (currentResolved !== 'dark') return;
      const colors = (e as CustomEvent<DarkThemeColors>).detail;
      applyDarkThemeColors(colors);
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key !== 'provenance-dark-colors') return;
      if (resolvedTheme !== 'dark') return;
      applyDarkThemeColors(readDarkThemeColors());
    };

    window.addEventListener(DARK_COLORS_CHANGED_EVENT, onColorsChanged);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(DARK_COLORS_CHANGED_EVENT, onColorsChanged);
      window.removeEventListener('storage', onStorage);
    };
  }, [resolvedTheme]);

  return null;
}

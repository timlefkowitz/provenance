'use client';

/**
 * SiteDesignSync
 *
 * In edit mode: watches design overrides from the bridge (accent, surface)
 * and updates CSS custom properties in-place without an iframe reload.
 */

import { useEffect } from 'react';
import { useSiteEdit } from './site-edit-context';
import { resolveAccent, resolveSurface } from '../_templates/palette';

export function SiteDesignSync() {
  const { isEditMode, overrides } = useSiteEdit();

  useEffect(() => {
    if (!isEditMode) return;

    if (overrides.accent) {
      const color = resolveAccent(overrides.accent);
      document.documentElement.style.setProperty('--site-accent', color);
    }

    if (overrides.surface_color !== undefined) {
      const surface = resolveSurface(overrides.surface_color);
      document.documentElement.style.setProperty('--site-surface-bg', surface.bg);
      document.documentElement.style.setProperty('--site-surface-ink', surface.ink);
    }
  }, [isEditMode, overrides.accent, overrides.surface_color]);

  return null;
}

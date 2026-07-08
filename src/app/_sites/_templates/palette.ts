/** Shared accent + surface resolution for all site templates. */

import { SITE_ACCENTS, SITE_FONT_PAIRINGS, SITE_SURFACES } from '../types';

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

export function resolveAccent(key: string): string {
  if (HEX_COLOR.test(key)) return key;
  const found = SITE_ACCENTS.find((a) => a.key === key);
  return found?.value ?? SITE_ACCENTS[0]?.value ?? '#4A2F25';
}

export function isCustomAccent(key: string): boolean {
  return HEX_COLOR.test(key);
}

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/**
 * Resolve the surface background and ink (text) color.
 * When inkOverride is a valid hex it replaces the surface's default ink.
 */
export function resolveSurface(key: string | null, inkOverride?: string | null): { bg: string; ink: string } {
  const map: Record<string, { bg: string; ink: string }> = {
    parchment: { bg: '#F5F1E8', ink: '#111111' },
    cream: { bg: '#FAF7F0', ink: '#1A1A1A' },
    white: { bg: '#FFFFFF', ink: '#111111' },
    slate: { bg: '#F1F4F7', ink: '#0F1419' },
    charcoal: { bg: '#1A1A1A', ink: '#F5F5F5' },
    ink: { bg: '#0F0F12', ink: '#F0EBE0' },
  };
  const surface = map[key ?? 'white'] ?? map.white;
  if (inkOverride && HEX_COLOR.test(inkOverride)) {
    return { bg: surface.bg, ink: inkOverride };
  }
  return surface;
}

export function isValidSurfaceKey(key: string): boolean {
  return SITE_SURFACES.some((s) => s.key === key);
}

export function isDarkSurface(key: string | null): boolean {
  return ['charcoal', 'ink'].includes(key ?? '');
}

export function borderColor(surfaceKey: string | null): string {
  return isDarkSurface(surfaceKey) ? '#333' : '#e4e4e4';
}

/**
 * Muted/secondary text color.
 * When inkOverride is set, derive muted color as a semi-transparent version of it.
 */
export function mutedText(surfaceKey: string | null, inkOverride?: string | null): string {
  if (inkOverride && HEX_COLOR.test(inkOverride)) {
    return `${inkOverride}99`;
  }
  return isDarkSurface(surfaceKey) ? 'rgba(255,255,255,0.6)' : '#888';
}

export type ResolvedFontPairing = {
  heading: string | null;
  body: string | null;
  googleFamilies: string[];
};

export function resolveFontPairing(key: string): ResolvedFontPairing {
  const found = SITE_FONT_PAIRINGS.find((fp) => fp.key === key);
  if (!found || found.key === 'default') {
    return { heading: null, body: null, googleFamilies: [] };
  }
  return {
    heading: found.heading,
    body: found.body,
    googleFamilies: found.googleFamilies,
  };
}

export function isValidFontPairingKey(key: string): boolean {
  return SITE_FONT_PAIRINGS.some((fp) => fp.key === key);
}

/** Build a Google Fonts CSS2 URL for the given family names. */
export function buildGoogleFontsUrl(families: string[]): string | null {
  if (families.length === 0) return null;
  const query = families
    .map((name) => `family=${encodeURIComponent(name)}:wght@400;500;600;700`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

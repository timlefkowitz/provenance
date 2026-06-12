/** Shared accent + surface resolution for all site templates. */

import { SITE_ACCENTS, SITE_FONT_PAIRINGS, SITE_SURFACES } from '../types';

const HEX_ACCENT = /^#[0-9A-Fa-f]{6}$/;

export function resolveAccent(key: string): string {
  if (HEX_ACCENT.test(key)) return key;
  const found = SITE_ACCENTS.find((a) => a.key === key);
  return found?.value ?? SITE_ACCENTS[0]?.value ?? '#4A2F25';
}

export function isCustomAccent(key: string): boolean {
  return HEX_ACCENT.test(key);
}

export function resolveSurface(key: string | null): { bg: string; ink: string } {
  const map: Record<string, { bg: string; ink: string }> = {
    parchment: { bg: '#F5F1E8', ink: '#111111' },
    cream: { bg: '#FAF7F0', ink: '#1A1A1A' },
    white: { bg: '#FFFFFF', ink: '#111111' },
    slate: { bg: '#F1F4F7', ink: '#0F1419' },
    charcoal: { bg: '#1A1A1A', ink: '#F5F5F5' },
    ink: { bg: '#0F0F12', ink: '#F0EBE0' },
  };
  return map[key ?? 'white'] ?? map.white;
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

export function mutedText(surfaceKey: string | null): string {
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

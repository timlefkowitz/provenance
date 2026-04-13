/**
 * Brand tokens for next/og persona images (used by render-persona-og.tsx).
 *
 * Do not import this file from app/opengraph-image.tsx: Next metadata-image-loader
 * requires that file to stay import-free. Keep gradientDefault in sync with the OG
 * constant in opengraph-image.tsx when you change defaults.
 *
 * Spot-check after deploy:
 *   curl -sI https://provenance.guru/opengraph-image
 *   curl -sI https://provenance.guru/lp/artist/opengraph-image
 */
export const OG_BRAND = {
  wordmark: 'Provenance',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
  text: '#fafaf9',
  gradientDefault:
    'linear-gradient(120deg, #0c0a09 0%, #1c1917 45%, #44403c 100%)',
  gradientPersona:
    'linear-gradient(125deg, #0c0a09 0%, #422006 42%, #881337 100%)',
  logoPath: null as string | null,
} as const;

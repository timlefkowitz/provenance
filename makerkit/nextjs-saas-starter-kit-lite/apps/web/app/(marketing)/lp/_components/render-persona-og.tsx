import { ImageResponse } from 'next/og';

import { OG_BRAND } from '../../../../config/og-brand';

export const PERSONA_OG_SIZE = { width: 1200, height: 630 } as const;

type PersonaOgParts = {
  /** Short line under the wordmark (e.g. “Artists & studios”). */
  roleLine: string;
  /** Supporting line (kept short for legibility at 1200×630). */
  tagline: string;
};

/**
 * Shared 1200×630 Open Graph art for persona landing routes (`/lp/*`).
 * Brand tokens live in config/og-brand.ts.
 */
export function renderPersonaOpenGraphImage(parts: PersonaOgParts) {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          padding: 64,
          background: OG_BRAND.gradientPersona,
          color: OG_BRAND.text,
          fontFamily: OG_BRAND.fontFamily,
        }}
      >
        <div
          style={{
            fontSize: 36,
            fontWeight: 700,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
            opacity: 0.85,
          }}
        >
          {OG_BRAND.wordmark}
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            marginTop: 20,
            maxWidth: 1000,
            lineHeight: 1.08,
            letterSpacing: '-0.03em',
          }}
        >
          {parts.roleLine}
        </div>
        <div
          style={{
            fontSize: 30,
            marginTop: 28,
            opacity: 0.92,
            maxWidth: 980,
            lineHeight: 1.35,
          }}
        >
          {parts.tagline}
        </div>
      </div>
    ),
    { ...PERSONA_OG_SIZE },
  );
}

import { ImageResponse } from 'next/og';

/** Keep this file import-free: next-metadata-image-loader rejects cross-module imports here. Sync colors with config/og-brand.ts. */
const OG = {
  wordmark: 'Provenance',
  fontFamily:
    'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
  text: '#fafaf9',
  gradientDefault:
    'linear-gradient(120deg, #0c0a09 0%, #1c1917 45%, #44403c 100%)',
} as const;

export const alt = 'Provenance - certificates, provenance, and collection records';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
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
          background: OG.gradientDefault,
          color: OG.text,
          fontFamily: OG.fontFamily,
        }}
      >
        <div
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: '0.32em',
            textTransform: 'uppercase',
            opacity: 0.9,
          }}
        >
          {OG.wordmark}
        </div>
        <div
          style={{
            fontSize: 58,
            fontWeight: 700,
            marginTop: 24,
            maxWidth: 1020,
            lineHeight: 1.05,
            letterSpacing: '-0.035em',
          }}
        >
          Certificates & provenance that travel with the work
        </div>
        <div
          style={{
            fontSize: 30,
            marginTop: 28,
            opacity: 0.9,
            maxWidth: 960,
            lineHeight: 1.35,
          }}
        >
          Artists, collectors, galleries, and institutions - one registry-shaped record.
        </div>
      </div>
    ),
    { ...size },
  );
}

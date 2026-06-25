import { ImageResponse } from 'next/og';

import { getExhibitionShareMeta } from '../_actions/get-exhibition-share-meta';

export const alt = 'Exhibition on Provenance';
export const size = { width: 1200, height: 630 } as const;
export const contentType = 'image/png';

// Branded Open Graph fallback for exhibition link previews. When an exhibition
// has no image of its own, this guarantees previews (iMessage, etc.) show a
// Provenance-branded card with the gallery brand name (e.g. "FL!GHT") rather
// than the default app/Vercel favicon.
export default async function Image({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let title = 'Exhibition';
  let ownerName: string | null = null;
  let dateRange: string | null = null;
  let location: string | null = null;

  try {
    const meta = await getExhibitionShareMeta(id);
    if (meta) {
      title = meta.title;
      ownerName = meta.ownerName;
      location = meta.location;
      if (meta.startDate) {
        const opts: Intl.DateTimeFormatOptions = {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        };
        const start = new Date(meta.startDate).toLocaleDateString('en-US', opts);
        dateRange = meta.endDate
          ? `${start} – ${new Date(meta.endDate).toLocaleDateString('en-US', opts)}`
          : start;
      }
    }
  } catch (err) {
    console.error('[Exhibitions] opengraph-image failed to load meta', err);
  }

  const metaLine = [dateRange, location].filter(Boolean).join('  ·  ');

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 72,
          background:
            'linear-gradient(125deg, #0c0a09 0%, #422006 42%, #881337 100%)',
          color: '#fafaf9',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: '#f4efe5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#4b3224',
              fontSize: 44,
              fontWeight: 700,
            }}
          >
            P
          </div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              opacity: 0.9,
            }}
          >
            Provenance
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {ownerName ? (
            <div
              style={{
                fontSize: 30,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                opacity: 0.85,
                marginBottom: 18,
              }}
            >
              {ownerName}
            </div>
          ) : null}
          <div
            style={{
              fontSize: 76,
              fontWeight: 700,
              lineHeight: 1.05,
              letterSpacing: '-0.03em',
              maxWidth: 1040,
            }}
          >
            {title}
          </div>
          {metaLine ? (
            <div
              style={{
                fontSize: 28,
                marginTop: 28,
                opacity: 0.85,
              }}
            >
              {metaLine}
            </div>
          ) : null}
        </div>
      </div>
    ),
    { ...size },
  );
}

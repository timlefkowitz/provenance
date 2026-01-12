'use client';

import { QRCodeSVG } from 'qrcode.react';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  creation_date: string | null;
  certificate_number: string;
};

export function ArtworkTags({
  artworks,
  siteUrl,
}: {
  artworks: Artwork[];
  siteUrl: string;
}) {
  const getYear = (creationDate: string | null) => {
    if (!creationDate) return '';
    try {
      const date = new Date(creationDate);
      return date.getFullYear().toString();
    } catch {
      return '';
    }
  };

  const getCertificateUrl = (artworkId: string) => {
    return `${siteUrl}/artworks/${artworkId}/certificate`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:gap-4">
      {artworks.map((artwork) => {
        const year = getYear(artwork.creation_date);
        const certificateUrl = getCertificateUrl(artwork.id);

        return (
          <div
            key={artwork.id}
            className="border-2 border-dashed border-wine/30 p-6 print:border-wine print:p-4 print:border-solid break-inside-avoid"
            style={{
              pageBreakInside: 'avoid',
              minHeight: 'fit-content',
            }}
          >
            {/* Artist Name */}
            <div className="mb-3">
              <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Artist</p>
              <p className="text-xl font-display font-bold text-wine print:text-wine">
                {artwork.artist_name || 'Unknown Artist'}
              </p>
            </div>

            {/* Art Title */}
            <div className="mb-3">
              <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Title</p>
              <p className="text-lg font-serif font-semibold text-ink print:text-ink">
                {artwork.title}
              </p>
            </div>

            {/* Year */}
            {year && (
              <div className="mb-3">
                <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Year</p>
                <p className="text-base font-serif text-ink print:text-ink">{year}</p>
              </div>
            )}

            {/* Description */}
            {artwork.description && (
              <div className="mb-4">
                <p className="text-sm text-ink/60 font-serif mb-1 print:text-ink">Description</p>
                <p className="text-sm font-serif text-ink whitespace-pre-wrap line-clamp-3 print:text-ink print:line-clamp-none">
                  {artwork.description}
                </p>
              </div>
            )}

            {/* QR Code */}
            <div className="mt-4 pt-4 border-t border-wine/20 print:border-wine">
              <div className="flex flex-col items-center">
                <QRCodeSVG
                  value={certificateUrl}
                  size={120}
                  level="M"
                  includeMargin={false}
                />
                <p className="text-xs text-ink/50 font-serif mt-2 text-center print:text-ink">
                  Scan to view certificate
                </p>
                <p className="text-xs text-ink/40 font-serif mt-1 text-center print:text-ink">
                  {artwork.certificate_number}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


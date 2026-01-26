'use client';

import { EditableArtworkTag } from './editable-artwork-tag';

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
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:gap-4">
      {artworks.map((artwork) => (
        <EditableArtworkTag key={artwork.id} artwork={artwork} siteUrl={siteUrl} />
      ))}
    </div>
  );
}


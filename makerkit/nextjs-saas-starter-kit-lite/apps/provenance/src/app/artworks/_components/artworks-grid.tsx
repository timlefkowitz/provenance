import { ArtworkCard } from './artwork-card';

export type ArtworkRow = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  account_id: string;
  is_sold?: boolean;
  view_count?: number | null;
};

type Props = {
  artworks: ArtworkRow[];
  currentUserId?: string;
};

export function ArtworksGrid({ artworks, currentUserId }: Props) {
  if (artworks.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {artworks.map((artwork) => (
        <ArtworkCard
          key={artwork.id}
          artwork={artwork}
          currentUserId={currentUserId}
        />
      ))}
    </div>
  );
}

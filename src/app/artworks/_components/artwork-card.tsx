import Image from 'next/image';
import Link from 'next/link';
import { Card, CardFooter, CardHeader } from '@kit/ui/card';
import { FollowButton } from './follow-button';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  account_id: string;
};

export function ArtworkCard({ 
  artwork, 
  currentUserId 
}: { 
  artwork: Artwork;
  currentUserId?: string;
}) {
  const isOwnArtwork = currentUserId === artwork.account_id;
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden h-full flex flex-col">
      <Link href={`/artworks/${artwork.id}/certificate`} className="cursor-pointer">
        <div className="relative aspect-square bg-parchment overflow-hidden">
          {artwork.image_url ? (
            <Image
              src={artwork.image_url}
              alt={artwork.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-ink/30 font-serif">
              No Image
            </div>
          )}
        </div>
      </Link>
      <CardHeader className="flex-1">
        <Link
          href={`/artworks/${artwork.id}/certificate`}
          className="cursor-pointer"
        >
          <h3 className="font-display font-bold text-wine text-lg mb-1 line-clamp-2 group-hover:text-wine/80 transition-colors">
            {artwork.title}
          </h3>
        </Link>
        {artwork.artist_name && (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={`/artists/${artwork.account_id}`}
              className="text-ink/70 font-serif text-sm hover:text-wine/80 transition-colors"
            >
              {artwork.artist_name}
            </Link>
            {currentUserId && !isOwnArtwork && (
              <FollowButton 
                artistId={artwork.account_id}
                currentUserId={currentUserId}
              />
            )}
          </div>
        )}
      </CardHeader>
      <CardFooter className="pt-0 pb-4">
        <div className="flex items-center justify-between w-full text-xs text-ink/50 font-serif">
          {isOwnArtwork ? (
            <span className="uppercase tracking-wider">
              {artwork.certificate_number}
            </span>
          ) : (
            <span className="uppercase tracking-wider text-ink/30">
              Certificate
            </span>
          )}
          <span>
            {new Date(artwork.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        </div>
      </CardFooter>
    </Card>
  );
}


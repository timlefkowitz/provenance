import Link from 'next/link';
import Image from 'next/image';
import { Card, CardFooter, CardHeader } from '@kit/ui/card';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
};

export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  return (
    <Link href={`/artworks/${artwork.id}/certificate`}>
      <Card className="group hover:shadow-lg transition-all duration-300 border-wine/20 hover:border-wine/40 bg-white overflow-hidden cursor-pointer h-full flex flex-col">
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
        <CardHeader className="flex-1">
          <h3 className="font-display font-bold text-wine text-lg mb-1 line-clamp-2 group-hover:text-wine/80 transition-colors">
            {artwork.title}
          </h3>
          {artwork.artist_name && (
            <p className="text-ink/70 font-serif text-sm">
              {artwork.artist_name}
            </p>
          )}
        </CardHeader>
        <CardFooter className="pt-0 pb-4">
          <div className="flex items-center justify-between w-full text-xs text-ink/50 font-serif">
            <span className="uppercase tracking-wider">
              {artwork.certificate_number}
            </span>
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
    </Link>
  );
}


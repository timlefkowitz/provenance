'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { toast } from '@kit/ui/sonner';
import Image from 'next/image';
import Link from 'next/link';
import { getQueuedArtworks } from '../../_actions/get-queued-artworks';
import { addFeaturedArtwork } from '../../_actions/manage-featured-artworks';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  status: string;
  is_public: boolean;
  certificate_number: string | null;
};

export function QueuedArtworksList() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ featuredCount: number; totalCount: number } | null>(null);

  // Load queued artworks
  useEffect(() => {
    async function loadQueuedArtworks() {
      try {
        const result = await getQueuedArtworks();
        if (result.artworks) {
          setArtworks(result.artworks);
        }
        if (result.featuredCount !== undefined && result.totalCount !== undefined) {
          setStats({
            featuredCount: result.featuredCount,
            totalCount: result.totalCount,
          });
        }
        if (result.error) {
          setError(result.error);
        }
      } catch (e) {
        console.error('Error loading queued artworks:', e);
        setError('Failed to load queued artworks');
      } finally {
        setLoading(false);
      }
    }
    loadQueuedArtworks();
  }, []);

  const handleAddToFeatured = (artworkId: string) => {
    startTransition(async () => {
      try {
        const result = await addFeaturedArtwork(artworkId);
        
        if (result.error) {
          toast.error(result.error);
        } else {
          // Remove from queued list
          setArtworks(artworks.filter(a => a.id !== artworkId));
          if (stats) {
            setStats({
              ...stats,
              featuredCount: stats.featuredCount + 1,
            });
          }
          toast.success('Artwork added to featured list');
          router.refresh();
        }
      } catch (e) {
        toast.error('Something went wrong. Please try again.');
        console.error(e);
      }
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-ink/70 font-serif">Loading queued artworks...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available Artworks</CardTitle>
        <CardDescription>
          {stats && (
            <span>
              {stats.featuredCount} featured, {stats.totalCount - stats.featuredCount} queued (out of {stats.totalCount} total verified artworks)
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {artworks.length === 0 ? (
          <div className="text-center py-8 border border-wine/20 rounded-lg bg-parchment/50">
            <p className="text-ink/70 font-serif">
              No queued artworks. All verified artworks are currently featured, or there are no verified artworks yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {artworks.map((artwork) => (
              <div
                key={artwork.id}
                className="relative border border-wine/20 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
              >
                <Link href={`/artworks/${artwork.id}/certificate`} className="block mb-3">
                  <div className="relative aspect-square bg-parchment rounded-lg overflow-hidden mb-3">
                    {artwork.image_url ? (
                      <Image
                        src={artwork.image_url}
                        alt={artwork.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-ink/30 font-serif text-sm">
                        No Image
                      </div>
                    )}
                  </div>
                  <h3 className="font-display font-bold text-wine text-sm mb-1 line-clamp-2">
                    {artwork.title}
                  </h3>
                  {artwork.artist_name && (
                    <p className="text-xs text-ink/60 font-serif mb-2">
                      {artwork.artist_name}
                    </p>
                  )}
                  {artwork.certificate_number && (
                    <p className="text-xs text-ink/50 font-serif">
                      Cert: {artwork.certificate_number}
                    </p>
                  )}
                </Link>
                
                <Button
                  onClick={() => handleAddToFeatured(artwork.id)}
                  disabled={pending}
                  className="w-full bg-wine text-parchment hover:bg-wine/90 text-sm"
                  size="sm"
                >
                  Add to Featured
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


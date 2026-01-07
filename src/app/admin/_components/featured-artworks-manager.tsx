'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { toast } from '@kit/ui/sonner';
import { X } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { getFeaturedArtworksList } from '../_actions/get-featured-entry';
import { removeFeaturedArtwork } from '../_actions/manage-featured-artworks';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
};

export function FeaturedArtworksManager() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load current featured artworks
  useEffect(() => {
    async function loadFeaturedArtworks() {
      try {
        const result = await getFeaturedArtworksList();
        if (result.artworks) {
          setArtworks(result.artworks);
        }
      } catch (e) {
        console.error('Error loading featured artworks:', e);
        setError('Failed to load featured artworks');
      } finally {
        setLoading(false);
      }
    }
    loadFeaturedArtworks();
  }, []);

  const handleRemove = (artworkId: string) => {
    startTransition(async () => {
      try {
        const result = await removeFeaturedArtwork(artworkId);
        
        if (result.error) {
          toast.error(result.error);
        } else {
          // Remove from local state
          setArtworks(artworks.filter(a => a.id !== artworkId));
          toast.success('Artwork removed from featured list');
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
          <p className="text-ink/70 font-serif">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Featured Artworks</CardTitle>
        <CardDescription>
          Manage up to 10 featured artworks. The homepage will randomly display one of these artworks each time it loads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-ink/70 font-serif">
              {artworks.length} of 10 artworks featured
            </p>
          </div>

          {artworks.length === 0 ? (
            <div className="text-center py-8 border border-wine/20 rounded-lg bg-parchment/50">
              <p className="text-ink/70 font-serif">
                No featured artworks yet. Use the "Feature on Homepage" button on any artwork page to add it.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {artworks.map((artwork) => (
                <div
                  key={artwork.id}
                  className="relative border border-wine/20 rounded-lg p-4 bg-white hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => handleRemove(artwork.id)}
                    disabled={pending}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 z-10"
                    aria-label="Remove from featured"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  
                  <Link href={`/artworks/${artwork.id}/certificate`} className="block">
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
                      <p className="text-xs text-ink/60 font-serif">
                        {artwork.artist_name}
                      </p>
                    )}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


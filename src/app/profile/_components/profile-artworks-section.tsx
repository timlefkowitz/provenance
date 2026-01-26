'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { SelectableArtworkCard } from './selectable-artwork-card';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  created_at: string;
  certificate_number: string;
  description: string | null;
  creation_date: string | null;
};

export function ProfileArtworksSection({ artworks }: { artworks: Artwork[] }) {
  const router = useRouter();
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<Set<string>>(new Set());

  const handleSelectChange = (artworkId: string, selected: boolean) => {
    setSelectedArtworkIds((prev) => {
      const newSet = new Set(prev);
      if (selected) {
        newSet.add(artworkId);
      } else {
        newSet.delete(artworkId);
      }
      return newSet;
    });
  };

  const handleCreateTags = () => {
    if (selectedArtworkIds.size === 0) {
      return;
    }
    const ids = Array.from(selectedArtworkIds);
    router.push(`/artworks/tags?ids=${ids.join(',')}`);
  };

  const handleEditProvenance = () => {
    if (selectedArtworkIds.size === 0) {
      return;
    }
    const ids = Array.from(selectedArtworkIds);
    router.push(`/artworks/edit-provenance?ids=${ids.join(',')}`);
  };

  if (artworks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Artworks</CardTitle>
          <CardDescription>
            Select artworks to create printable tags for art shows.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-ink/70 font-serif text-center py-8">
            You haven't added any artworks yet.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Your Artworks</CardTitle>
            <CardDescription>
              Select artworks to create printable tags for art shows.
            </CardDescription>
          </div>
          {selectedArtworkIds.size > 0 && (
            <div className="flex gap-2">
              <Button
                onClick={handleCreateTags}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                Create Tags ({selectedArtworkIds.size})
              </Button>
              <Button
                onClick={handleEditProvenance}
                variant="outline"
                className="font-serif border-wine text-wine hover:bg-wine/10"
              >
                Edit Provenance ({selectedArtworkIds.size})
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {artworks.map((artwork) => (
            <SelectableArtworkCard
              key={artwork.id}
              artwork={artwork}
              isSelected={selectedArtworkIds.has(artwork.id)}
              onSelectChange={handleSelectChange}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}



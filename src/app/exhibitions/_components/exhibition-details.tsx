'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, X, Image as ImageIcon } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { useRouter } from 'next/navigation';
import {
  addArtworkToExhibition,
  removeArtworkFromExhibition,
} from '../_actions/manage-exhibition-artworks';
import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';

export function ExhibitionDetails({
  exhibition,
  isOwner,
}: {
  exhibition: ExhibitionWithDetails;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleAddArtwork = async (artworkId: string) => {
    startTransition(async () => {
      try {
        await addArtworkToExhibition(exhibition.id, artworkId);
        toast.success('Artwork added to exhibition');
        router.refresh();
      } catch (error: any) {
        toast.error(error.message || 'Failed to add artwork');
      }
    });
  };

  const handleRemoveArtwork = async (artworkId: string) => {
    startTransition(async () => {
      try {
        await removeArtworkFromExhibition(exhibition.id, artworkId);
        toast.success('Artwork removed from exhibition');
        router.refresh();
      } catch (error: any) {
        toast.error(error.message || 'Failed to remove artwork');
      }
    });
  };

  return (
    <div>
      {/* Artworks Section */}
      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-xl text-wine flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Artworks
            </CardTitle>
            {isOwner && (
              <AddArtworkDialog
                exhibitionId={exhibition.id}
                onAdd={handleAddArtwork}
                existingArtworkIds={exhibition.artworks.map((a) => a.id)}
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          {exhibition.artworks.length === 0 ? (
            <p className="text-ink/60 font-serif text-sm">
              No artworks added yet
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {exhibition.artworks.map((artwork) => (
                <div
                  key={artwork.id}
                  className="relative group border border-wine/10 rounded-md overflow-hidden bg-white/50"
                >
                  <Link href={`/artworks/${artwork.id}/certificate`}>
                    {artwork.image_url ? (
                      <div className="relative aspect-square">
                        <Image
                          src={artwork.image_url}
                          alt={artwork.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                      </div>
                    ) : (
                      <div className="aspect-square flex items-center justify-center bg-wine/10">
                        <ImageIcon className="h-8 w-8 text-wine/50" />
                      </div>
                    )}
                    <div className="p-2">
                      <p className="text-xs font-serif text-ink line-clamp-1">
                        {artwork.title}
                      </p>
                    </div>
                  </Link>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveArtwork(artwork.id)}
                      className="absolute top-2 right-2 h-6 w-6 p-0 bg-white/90 hover:bg-white text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={pending}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Add Artwork Dialog Component
function AddArtworkDialog({
  exhibitionId,
  onAdd,
  existingArtworkIds,
}: {
  exhibitionId: string;
  onAdd: (artworkId: string) => void;
  existingArtworkIds: string[];
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [artworks, setArtworks] = useState<
    Array<{ id: string; title: string; image_url: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (query: string) => {
    if (query.length < 2) {
      setArtworks([]);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/search-artworks?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setArtworks(data.filter((a: any) => !existingArtworkIds.includes(a.id)));
      }
    } catch (error) {
      console.error('Error searching artworks:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="font-serif border-wine/30 hover:bg-wine/10"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Artwork
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Artwork to Exhibition</DialogTitle>
          <DialogDescription>
            Search for an artwork to add to this exhibition
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Search Artworks</Label>
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                handleSearch(e.target.value);
              }}
              placeholder="Type artwork title..."
              className="font-serif"
            />
          </div>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {loading ? (
              <p className="text-sm text-ink/60 font-serif">Searching...</p>
            ) : artworks.length === 0 ? (
              <p className="text-sm text-ink/60 font-serif">
                {search.length < 2
                  ? 'Type at least 2 characters to search'
                  : 'No artworks found'}
              </p>
            ) : (
              artworks.map((artwork) => (
                <Button
                  key={artwork.id}
                  variant="outline"
                  className="w-full justify-start font-serif"
                  onClick={() => {
                    onAdd(artwork.id);
                    setOpen(false);
                  }}
                >
                  {artwork.title}
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


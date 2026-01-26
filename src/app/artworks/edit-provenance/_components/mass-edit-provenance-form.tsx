'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Alert, AlertDescription } from '@kit/ui/alert';
import { IndividualArtworkEditForm } from './individual-artwork-edit-form';
import { batchUpdateProvenance } from '../_actions/batch-update-provenance';

type Artwork = {
  id: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  former_owners: string | null;
  auction_history: string | null;
  exhibition_history: string | null;
  historic_context: string | null;
  celebrity_notes: string | null;
  is_public: boolean | null;
  value: string | null;
  value_is_public: boolean | null;
  edition: string | null;
  production_location: string | null;
  owned_by: string | null;
  owned_by_is_public: boolean | null;
  sold_by: string | null;
  sold_by_is_public: boolean | null;
};

type ArtworkFormData = {
  artist_name: string;
  description: string;
  creation_date: string;
  medium: string;
  dimensions: string;
  former_owners: string;
  auction_history: string;
  exhibition_history: string;
  historic_context: string;
  celebrity_notes: string;
  is_public: boolean | null;
  value: string;
  value_is_public: boolean | null;
  edition: string;
  production_location: string;
  owned_by: string;
  owned_by_is_public: boolean | null;
  sold_by: string;
  sold_by_is_public: boolean | null;
};

export function MassEditProvenanceForm({ artworks }: { artworks: Artwork[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [artworkData, setArtworkData] = useState<Record<string, ArtworkFormData>>({});

  const handleArtworkDataChange = (artworkId: string, data: ArtworkFormData) => {
    setArtworkData((prev) => ({
      ...prev,
      [artworkId]: data,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (Object.keys(artworkData).length === 0) {
      setError('Please make at least one change to save');
      return;
    }

    startTransition(async () => {
      try {
        const updates: Array<{ artworkId: string; updates: any }> = [];

        // Build update objects for each artwork
        for (const [artworkId, data] of Object.entries(artworkData)) {
          const update: any = {};

          // Only include fields that have changed from original
          const artwork = artworks.find(a => a.id === artworkId);
          if (!artwork) continue;

          if (data.artist_name !== (artwork.artist_name || '')) {
            update.artist_name = data.artist_name.trim() || null;
          }
          if (data.description !== (artwork.description || '')) {
            update.description = data.description.trim() || null;
          }
          if (data.creation_date !== (artwork.creation_date ? artwork.creation_date.split('T')[0] : '')) {
            update.creationDate = data.creation_date || null;
          }
          if (data.medium !== (artwork.medium || '')) {
            update.medium = data.medium.trim() || null;
          }
          if (data.dimensions !== (artwork.dimensions || '')) {
            update.dimensions = data.dimensions.trim() || null;
          }
          if (data.former_owners !== (artwork.former_owners || '')) {
            update.formerOwners = data.former_owners.trim() || null;
          }
          if (data.auction_history !== (artwork.auction_history || '')) {
            update.auctionHistory = data.auction_history.trim() || null;
          }
          if (data.exhibition_history !== (artwork.exhibition_history || '')) {
            update.exhibitionHistory = data.exhibition_history.trim() || null;
          }
          if (data.historic_context !== (artwork.historic_context || '')) {
            update.historicContext = data.historic_context.trim() || null;
          }
          if (data.celebrity_notes !== (artwork.celebrity_notes || '')) {
            update.celebrityNotes = data.celebrity_notes.trim() || null;
          }
          if (data.value !== (artwork.value || '')) {
            update.value = data.value.trim() || null;
          }
          if (data.edition !== (artwork.edition || '')) {
            update.edition = data.edition.trim() || null;
          }
          if (data.production_location !== (artwork.production_location || '')) {
            update.productionLocation = data.production_location.trim() || null;
          }
          if (data.owned_by !== (artwork.owned_by || '')) {
            update.ownedBy = data.owned_by.trim() || null;
          }
          if (data.sold_by !== (artwork.sold_by || '')) {
            update.soldBy = data.sold_by.trim() || null;
          }
          if (data.is_public !== artwork.is_public) {
            update.isPublic = data.is_public;
          }
          if (data.value_is_public !== artwork.value_is_public) {
            update.valueIsPublic = data.value_is_public;
          }
          if (data.owned_by_is_public !== artwork.owned_by_is_public) {
            update.ownedByIsPublic = data.owned_by_is_public;
          }
          if (data.sold_by_is_public !== artwork.sold_by_is_public) {
            update.soldByIsPublic = data.sold_by_is_public;
          }

          if (Object.keys(update).length > 0) {
            updates.push({ artworkId, updates: update });
          }
        }

        if (updates.length === 0) {
          setError('No changes detected. Please make at least one change to save.');
          return;
        }

        // Update each artwork individually
        let successCount = 0;
        const errors: string[] = [];

        for (const { artworkId, updates: updateData } of updates) {
          try {
            const result = await batchUpdateProvenance([artworkId], updateData);
            if (result.error) {
              errors.push(`Artwork ${artworkId}: ${result.error}`);
            } else {
              successCount++;
            }
          } catch (e) {
            errors.push(`Artwork ${artworkId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
          }
        }

        if (errors.length > 0 && successCount === 0) {
          setError(`Failed to update artworks: ${errors.join(', ')}`);
        } else if (errors.length > 0) {
          setError(`Updated ${successCount} artworks, but some failed: ${errors.join(', ')}`);
        } else {
          setSuccess(true);
          setTimeout(() => {
            router.push('/artworks/my');
          }, 2000);
        }
      } catch (e) {
        setError('Something went wrong. Please try again.');
        console.error(e);
      }
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            Successfully updated artworks! Redirecting...
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-6">
        {/* Individual Artwork Forms */}
        {artworks.map((artwork) => (
          <IndividualArtworkEditForm
            key={artwork.id}
            artwork={artwork}
            onDataChange={handleArtworkDataChange}
          />
        ))}

        {/* Submit Button */}
        <div className="flex gap-4 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push('/artworks/my')}
            disabled={pending}
            className="font-serif"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={pending}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif"
          >
            {pending ? 'Updating...' : `Update ${artworks.length} ${artworks.length === 1 ? 'Artwork' : 'Artworks'}`}
          </Button>
        </div>
      </div>
    </form>
  );
}

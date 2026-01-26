'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription } from '@kit/ui/alert';
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
  image_url: string | null;
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

export function SpreadsheetEditForm({ artworks }: { artworks: Artwork[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [artworkData, setArtworkData] = useState<Record<string, ArtworkFormData>>(() => {
    const initial: Record<string, ArtworkFormData> = {};
    artworks.forEach((artwork) => {
      initial[artwork.id] = {
        artist_name: artwork.artist_name || '',
        description: artwork.description || '',
        creation_date: artwork.creation_date ? artwork.creation_date.split('T')[0] : '',
        medium: artwork.medium || '',
        dimensions: artwork.dimensions || '',
        former_owners: artwork.former_owners || '',
        auction_history: artwork.auction_history || '',
        exhibition_history: artwork.exhibition_history || '',
        historic_context: artwork.historic_context || '',
        celebrity_notes: artwork.celebrity_notes || '',
        is_public: artwork.is_public,
        value: artwork.value || '',
        value_is_public: artwork.value_is_public,
        edition: artwork.edition || '',
        production_location: artwork.production_location || '',
        owned_by: artwork.owned_by || '',
        owned_by_is_public: artwork.owned_by_is_public,
        sold_by: artwork.sold_by || '',
        sold_by_is_public: artwork.sold_by_is_public,
      };
    });
    return initial;
  });

  const updateField = (artworkId: string, field: keyof ArtworkFormData, value: any) => {
    setArtworkData((prev) => ({
      ...prev,
      [artworkId]: {
        ...prev[artworkId],
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const updates: Array<{ artworkId: string; updates: any }> = [];

        // Build update objects for each artwork
        for (const artwork of artworks) {
          const data = artworkData[artwork.id];
          if (!data) continue;

          const update: any = {};

          // Only include fields that have changed from original
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
            updates.push({ artworkId: artwork.id, updates: update });
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
              errors.push(`${artworks.find(a => a.id === artworkId)?.title || artworkId}: ${result.error}`);
            } else {
              successCount++;
            }
          } catch (e) {
            errors.push(`${artworks.find(a => a.id === artworkId)?.title || artworkId}: ${e instanceof Error ? e.message : 'Unknown error'}`);
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
    <form onSubmit={handleSubmit} className="space-y-6">
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

      {/* Spreadsheet Table */}
      <div className="overflow-x-auto border border-wine/20 rounded-lg bg-parchment/60">
        <table className="w-full min-w-[2000px]">
          <thead className="bg-wine/10 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-display text-wine font-bold border-b border-wine/20 sticky left-0 bg-wine/10 z-20 min-w-[200px]">
                Image & Title
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[150px]">
                Artist
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[200px]">
                Description
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[120px]">
                Date
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[150px]">
                Medium
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[150px]">
                Dimensions
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[200px]">
                Former Owners
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[200px]">
                Auction History
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[200px]">
                Exhibition History
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[200px]">
                Historic Context
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[200px]">
                Celebrity Notes
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[120px]">
                Value
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[100px]">
                Edition
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[150px]">
                Production Location
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[150px]">
                Owned By
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[150px]">
                Sold By
              </th>
              <th className="px-3 py-3 text-center font-serif text-sm text-wine font-semibold border-b border-wine/20 min-w-[100px]">
                Public
              </th>
            </tr>
          </thead>
          <tbody>
            {artworks.map((artwork, index) => {
              const data = artworkData[artwork.id];
              if (!data) return null;

              return (
                <tr
                  key={artwork.id}
                  className={`border-b border-wine/10 hover:bg-wine/5 ${index % 2 === 0 ? 'bg-parchment/30' : 'bg-parchment/50'}`}
                >
                  {/* Image & Title - Sticky Column */}
                  <td className="px-4 py-4 border-r border-wine/10 sticky left-0 bg-inherit z-10">
                    <div className="flex items-center gap-3">
                      {artwork.image_url ? (
                        <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden border border-wine/20">
                          <Image
                            src={artwork.image_url}
                            alt={artwork.title}
                            fill
                            className="object-cover"
                            sizes="64px"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-16 flex-shrink-0 rounded border border-wine/20 bg-ink/5 flex items-center justify-center">
                          <span className="text-ink/30 text-xs">No Image</span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="font-display font-semibold text-wine text-sm truncate">
                          {artwork.title}
                        </div>
                        <div className="text-xs text-ink/60 font-serif truncate">
                          {artwork.certificate_number}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Artist */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.artist_name}
                      onChange={(e) => updateField(artwork.id, 'artist_name', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="Artist name"
                    />
                  </td>

                  {/* Description */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Textarea
                      value={data.description}
                      onChange={(e) => updateField(artwork.id, 'description', e.target.value)}
                      className="font-serif text-sm min-h-[60px] border-wine/20 resize-none"
                      placeholder="Description"
                      rows={2}
                    />
                  </td>

                  {/* Date */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      type="date"
                      value={data.creation_date}
                      onChange={(e) => updateField(artwork.id, 'creation_date', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                    />
                  </td>

                  {/* Medium */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.medium}
                      onChange={(e) => updateField(artwork.id, 'medium', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="e.g., Oil on Canvas"
                    />
                  </td>

                  {/* Dimensions */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.dimensions}
                      onChange={(e) => updateField(artwork.id, 'dimensions', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="e.g., 24 x 36"
                    />
                  </td>

                  {/* Former Owners */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Textarea
                      value={data.former_owners}
                      onChange={(e) => updateField(artwork.id, 'former_owners', e.target.value)}
                      className="font-serif text-sm min-h-[60px] border-wine/20 resize-none"
                      placeholder="Former owners"
                      rows={2}
                    />
                  </td>

                  {/* Auction History */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Textarea
                      value={data.auction_history}
                      onChange={(e) => updateField(artwork.id, 'auction_history', e.target.value)}
                      className="font-serif text-sm min-h-[60px] border-wine/20 resize-none"
                      placeholder="Auction history"
                      rows={2}
                    />
                  </td>

                  {/* Exhibition History */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Textarea
                      value={data.exhibition_history}
                      onChange={(e) => updateField(artwork.id, 'exhibition_history', e.target.value)}
                      className="font-serif text-sm min-h-[60px] border-wine/20 resize-none"
                      placeholder="Exhibition history"
                      rows={2}
                    />
                  </td>

                  {/* Historic Context */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Textarea
                      value={data.historic_context}
                      onChange={(e) => updateField(artwork.id, 'historic_context', e.target.value)}
                      className="font-serif text-sm min-h-[60px] border-wine/20 resize-none"
                      placeholder="Historic context"
                      rows={2}
                    />
                  </td>

                  {/* Celebrity Notes */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Textarea
                      value={data.celebrity_notes}
                      onChange={(e) => updateField(artwork.id, 'celebrity_notes', e.target.value)}
                      className="font-serif text-sm min-h-[60px] border-wine/20 resize-none"
                      placeholder="Celebrity notes"
                      rows={2}
                    />
                  </td>

                  {/* Value */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.value}
                      onChange={(e) => updateField(artwork.id, 'value', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="$10,000"
                    />
                  </td>

                  {/* Edition */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.edition}
                      onChange={(e) => updateField(artwork.id, 'edition', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="1/10"
                    />
                  </td>

                  {/* Production Location */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.production_location}
                      onChange={(e) => updateField(artwork.id, 'production_location', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="Location"
                    />
                  </td>

                  {/* Owned By */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.owned_by}
                      onChange={(e) => updateField(artwork.id, 'owned_by', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="Owner"
                    />
                  </td>

                  {/* Sold By */}
                  <td className="px-3 py-2 border-r border-wine/10">
                    <Input
                      value={data.sold_by}
                      onChange={(e) => updateField(artwork.id, 'sold_by', e.target.value)}
                      className="font-serif text-sm h-8 border-wine/20"
                      placeholder="Seller"
                    />
                  </td>

                  {/* Public Toggle */}
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={data.is_public ?? false}
                      onCheckedChange={(checked) => updateField(artwork.id, 'is_public', checked)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Submit Button */}
      <div className="flex gap-4 justify-end sticky bottom-0 bg-parchment py-4 border-t border-wine/20">
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
          {pending ? 'Saving...' : `Save All Changes (${artworks.length} artworks)`}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Textarea } from '@kit/ui/textarea';
import { Switch } from '@kit/ui/switch';
import { Alert, AlertDescription } from '@kit/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { batchUpdateProvenance } from '../_actions/batch-update-provenance';

type LinkableExhibition = {
  id: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
};

type Artwork = {
  id: string;
  title: string;
  certificate_number: string | null;
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
  title: string;
  artist_name: string;
  description: string;
  creation_date: string;
  medium: string;
  dimensions: string;
  former_owners: string;
  auction_history: string;
  exhibition_id: string | null;
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

export function SpreadsheetEditForm({
  artworks,
  linkableExhibitions,
  initialExhibitionIdByArtworkId,
}: {
  artworks: Artwork[];
  linkableExhibitions: LinkableExhibition[];
  initialExhibitionIdByArtworkId: Record<string, string | null>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState('__all__');
  const [artworkSearchTerm, setArtworkSearchTerm] = useState('');
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<Set<string>>(() => {
    if (artworks.length === 0) {
      return new Set();
    }
    return new Set([artworks[0].id]);
  });
  const [artworkData, setArtworkData] = useState<Record<string, ArtworkFormData>>(() => {
    const initial: Record<string, ArtworkFormData> = {};
    artworks.forEach((artwork) => {
      initial[artwork.id] = {
        title: artwork.title || '',
        artist_name: artwork.artist_name || '',
        description: artwork.description || '',
        creation_date: artwork.creation_date ? artwork.creation_date.split('T')[0] : '',
        medium: artwork.medium || '',
        dimensions: artwork.dimensions || '',
        former_owners: artwork.former_owners || '',
        auction_history: artwork.auction_history || '',
        exhibition_id: initialExhibitionIdByArtworkId[artwork.id] ?? null,
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

  const linkableExhibitionById = new Map(
    linkableExhibitions.map((exhibition) => [exhibition.id, exhibition]),
  );
  const collectionIdsInUserArtworks = new Set<string>();
  for (const artwork of artworks) {
    const currentCollectionId = artworkData[artwork.id]?.exhibition_id ?? null;
    if (currentCollectionId) {
      collectionIdsInUserArtworks.add(currentCollectionId);
    }
  }
  const collectionOptions = [...collectionIdsInUserArtworks].map((collectionId) => {
    return (
      linkableExhibitionById.get(collectionId) ?? {
        id: collectionId,
        title: 'Current linked exhibition',
        start_date: null,
        end_date: null,
      }
    );
  });

  const collectionFilteredArtworks = artworks.filter((artwork) => {
    const collectionId = artworkData[artwork.id]?.exhibition_id ?? null;
    if (selectedCollectionFilter === '__all__') {
      return true;
    }
    if (selectedCollectionFilter === '__unassigned__') {
      return !collectionId;
    }
    return collectionId === selectedCollectionFilter;
  });

  const normalizedSearchTerm = artworkSearchTerm.trim().toLowerCase();
  const filteredArtworks = collectionFilteredArtworks.filter((artwork) => {
    if (!normalizedSearchTerm) {
      return true;
    }
    const title = (artwork.title || '').toLowerCase();
    const artistName = (artwork.artist_name || '').toLowerCase();
    const certificateNumber = (artwork.certificate_number || '').toLowerCase();
    return (
      title.includes(normalizedSearchTerm) ||
      artistName.includes(normalizedSearchTerm) ||
      certificateNumber.includes(normalizedSearchTerm)
    );
  });

  const visibleArtworks = filteredArtworks.filter((artwork) =>
    selectedArtworkIds.has(artwork.id),
  );

  const toggleArtworkSelection = (artworkId: string) => {
    setSelectedArtworkIds((prev) => {
      const next = new Set(prev);
      if (next.has(artworkId)) {
        next.delete(artworkId);
      } else {
        next.add(artworkId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedArtworkIds(new Set(filteredArtworks.map((artwork) => artwork.id)));
  };

  const handleClearSelection = () => {
    setSelectedArtworkIds(new Set());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        const updates: Array<{ artworkId: string; updates: any }> = [];
        const targetArtworks = visibleArtworks;

        if (targetArtworks.length === 0) {
          setError('Select at least one artwork to edit.');
          return;
        }

        for (const artwork of targetArtworks) {
          const data = artworkData[artwork.id];
          if (!data) continue;
          if (!data.title.trim()) {
            setError(
              `Title is required. Add a title for the row that currently shows "${artwork.title || 'Untitled'}".`,
            );
            return;
          }
        }

        // Build update objects for each artwork
        for (const artwork of targetArtworks) {
          const data = artworkData[artwork.id];
          if (!data) continue;

          const update: any = {};

          // Only include fields that have changed from original
          if (data.title.trim() !== (artwork.title || '')) {
            update.title = data.title.trim();
          }
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
          const initialExhibitionId =
            initialExhibitionIdByArtworkId[artwork.id] ?? null;
          if (data.exhibition_id !== initialExhibitionId) {
            update.exhibitionId = data.exhibition_id;
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
            console.error('[SpreadsheetEditForm] Batch update failed for artwork', artworkId, e);
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
        console.error('[SpreadsheetEditForm] Submit failed', e);
        setError('Something went wrong. Please try again.');
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-full overflow-x-hidden">
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

      <div className="space-y-2">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-sm text-ink/70 font-serif">
            Scroll to choose an artwork, then edit its details below.
          </p>
          <div className="grid w-full gap-2 sm:grid-cols-2 lg:w-auto">
            <div className="w-full sm:w-[280px]">
              <p className="text-xs text-ink/60 font-serif mb-1">Collection in viewer</p>
              <Select
                value={selectedCollectionFilter}
                onValueChange={setSelectedCollectionFilter}
              >
                <SelectTrigger className="font-serif h-9 border-wine/20">
                  <SelectValue placeholder="All collections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__" className="font-serif">
                    All collections
                  </SelectItem>
                  <SelectItem value="__unassigned__" className="font-serif">
                    Unassigned artworks
                  </SelectItem>
                  {collectionOptions.map((collection) => (
                    <SelectItem
                      key={collection.id}
                      value={collection.id}
                      className="font-serif"
                    >
                      {collection.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-full sm:w-[280px]">
              <p className="text-xs text-ink/60 font-serif mb-1">Search artworks</p>
              <Input
                value={artworkSearchTerm}
                onChange={(e) => setArtworkSearchTerm(e.target.value)}
                className="font-serif h-9 border-wine/20"
                placeholder="Title, artist, or cert #"
                aria-label="Search artworks in viewer"
              />
            </div>
          </div>
        </div>
        <div className="max-w-full overflow-x-auto pb-2">
          {filteredArtworks.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-ink/60 font-serif">
                No artworks found for this collection filter.
              </p>
            </div>
          ) : (
            <div className="flex w-max gap-3">
              {filteredArtworks.map((artwork) => {
                const isSelected = selectedArtworkIds.has(artwork.id);
                return (
                  <button
                    key={artwork.id}
                    type="button"
                    onClick={() => toggleArtworkSelection(artwork.id)}
                    className={`w-[132px] p-2 rounded-md border text-left transition-colors ${
                      isSelected
                        ? 'border-wine bg-wine/10'
                        : 'border-wine/25 bg-wine/10 hover:bg-wine/10 opacity-70'
                    }`}
                    aria-pressed={isSelected}
                  >
                    <div className="relative w-full h-[92px] rounded overflow-hidden border border-wine/20 bg-ink/5">
                      {artwork.image_url ? (
                        <Image
                          src={artwork.image_url}
                          alt={artwork.title || 'Artwork'}
                          fill
                          className="object-cover"
                          sizes="132px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <span className="text-ink/40 text-xs font-serif">No Image</span>
                        </div>
                      )}
                      {isSelected ? (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-wine text-parchment flex items-center justify-center">
                          <Check className="w-3.5 h-3.5" />
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs font-serif text-ink truncate">
                      {artwork.title || 'Untitled'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-ink/60 font-serif">
            {visibleArtworks.length} selected of {filteredArtworks.length} in view
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectAll}
              className="h-7 px-2 text-xs font-serif"
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearSelection}
              className="h-7 px-2 text-xs font-serif"
            >
              Clear
            </Button>
          </div>
        </div>
      </div>

      {/* Spreadsheet Table */}
      <div className="max-w-full overflow-x-auto border border-wine/20 rounded-lg bg-parchment/60">
        {visibleArtworks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-ink/70 font-serif">
              Select one or more artworks above to edit.
            </p>
          </div>
        ) : (
        <table className="w-full table-fixed">
          <thead className="bg-wine/10 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-display text-wine font-bold border-b border-wine/20 w-[200px]">
                Image & Title
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[150px]">
                Artist
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[200px]">
                Description
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[120px]">
                Date
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[150px]">
                Medium
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[150px]">
                Dimensions
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[200px]">
                Former Owners
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[200px]">
                Auction History
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[220px]">
                Exhibition
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[200px]">
                Exhibition History
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[200px]">
                Historic Context
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[200px]">
                Celebrity Notes
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[120px]">
                Value
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[100px]">
                Edition
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[150px]">
                Production Location
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[150px]">
                Owned By
              </th>
              <th className="px-3 py-3 text-left font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[150px]">
                Sold By
              </th>
              <th className="px-3 py-3 text-center font-serif text-sm text-wine font-semibold border-b border-wine/20 w-[100px]">
                Public
              </th>
            </tr>
          </thead>
          <tbody>
            {visibleArtworks.map((artwork) => {
              const data = artworkData[artwork.id];
              if (!data) return null;

              return (
                <tr
                  key={artwork.id}
                  className={`border-b border-wine/10 bg-wine/10 hover:bg-wine/10`}
                >
                  {/* Image & Title */}
                  <td className="px-4 py-4 border-r border-wine/10">
                    <div className="flex items-center gap-3">
                      {artwork.image_url ? (
                        <div className="relative w-16 h-16 flex-shrink-0 rounded overflow-hidden border border-wine/20">
                          <Image
                            src={artwork.image_url}
                            alt={data.title || artwork.title}
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
                      <div className="min-w-0 flex-1 space-y-1">
                        <Input
                          value={data.title}
                          onChange={(e) =>
                            updateField(artwork.id, 'title', e.target.value)
                          }
                          className="font-display font-semibold text-wine text-sm h-8 border-wine/20"
                          placeholder="Artwork title"
                          aria-label="Artwork title"
                        />
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

                  {/* Exhibition (link to gallery exhibition) */}
                  <td className="px-3 py-2 border-r border-wine/10 align-top">
                    {(() => {
                      const rowOptions = [...linkableExhibitions];
                      if (
                        data.exhibition_id &&
                        !rowOptions.some((e) => e.id === data.exhibition_id)
                      ) {
                        rowOptions.unshift({
                          id: data.exhibition_id,
                          title: 'Current linked exhibition',
                          start_date: null,
                          end_date: null,
                        });
                      }
                      return (
                        <Select
                          value={data.exhibition_id ?? '__none__'}
                          onValueChange={(v) =>
                            updateField(
                              artwork.id,
                              'exhibition_id',
                              v === '__none__' ? null : v,
                            )
                          }
                          disabled={rowOptions.length === 0}
                        >
                          <SelectTrigger
                            className="font-serif text-sm h-9 border-wine/20 w-[200px]"
                            aria-label="Link to exhibition"
                          >
                            <SelectValue
                              placeholder={
                                rowOptions.length === 0
                                  ? 'No exhibitions'
                                  : 'Select exhibition'
                              }
                            />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__" className="font-serif">
                              None
                            </SelectItem>
                            {rowOptions.map((ex) => {
                              const startDate = ex.start_date
                                ? new Date(ex.start_date)
                                : null;
                              return (
                                <SelectItem
                                  key={ex.id}
                                  value={ex.id}
                                  className="font-serif"
                                >
                                  {ex.title}
                                  {startDate ? (
                                    <span className="text-xs text-ink/60 ml-1">
                                      ({startDate.getFullYear()})
                                    </span>
                                  ) : null}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      );
                    })()}
                    <p className="text-[10px] text-ink/50 font-serif mt-1 max-w-[200px] leading-tight">
                      Gallery exhibitions you can manage. Optional; use Exhibition
                      History for text notes.
                    </p>
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
        )}
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
          disabled={pending || visibleArtworks.length === 0}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif"
        >
          {pending
            ? 'Saving...'
            : `Save All Changes (${visibleArtworks.length} artworks selected)`}
        </Button>
      </div>
    </form>
  );
}

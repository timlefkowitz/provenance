'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Plus, X, Image as ImageIcon, Search, ListPlus, Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@kit/ui/tabs';
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
import { createQuickExhibitionListings } from '../_actions/create-exhibition-listings';
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
  const [removingId, setRemovingId] = useState<string | null>(null);

  const handleAddArtwork = async (artworkId: string) => {
    startTransition(async () => {
      try {
        await addArtworkToExhibition(exhibition.id, artworkId);
        toast.success('Artwork added to exhibition');
        router.refresh();
      } catch (error: any) {
        console.error('[ExhibitionDetails] Error adding artwork', error);
        toast.error(error.message || 'Failed to add artwork');
      }
    });
  };

  const handleRemoveArtwork = async (artworkId: string) => {
    setRemovingId(artworkId);
    startTransition(async () => {
      try {
        await removeArtworkFromExhibition(exhibition.id, artworkId);
        toast.success('Artwork removed');
        router.refresh();
      } catch (error: any) {
        console.error('[ExhibitionDetails] Error removing artwork', error);
        toast.error(error.message || 'Failed to remove artwork');
      } finally {
        setRemovingId(null);
      }
    });
  };

  if (exhibition.artworks.length === 0 && !isOwner) {
    return (
      <div className="text-center py-24 border border-dashed border-wine/15 rounded-2xl">
        <p className="text-[10px] uppercase tracking-widest text-ink/25 font-serif mb-3">
          No Works Listed
        </p>
        <p className="text-ink/35 font-serif text-sm">Artworks will appear here once added.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Owner add-artwork button */}
      {isOwner && (
        <div className="flex justify-end mb-6">
          <AddArtworkDialog
            exhibitionId={exhibition.id}
            onAdd={handleAddArtwork}
            existingArtworkIds={exhibition.artworks.map((a) => a.id)}
          />
        </div>
      )}

      {exhibition.artworks.length === 0 && isOwner && (
        <div className="text-center py-24 border border-dashed border-wine/15 rounded-2xl">
          <p className="text-[10px] uppercase tracking-widest text-ink/25 font-serif mb-3">
            No Works Yet
          </p>
          <p className="text-ink/35 font-serif text-sm">Add artworks to this exhibition using the button above.</p>
        </div>
      )}

      {/* ── Artwork grid ────────────────────────────────────── */}
      {exhibition.artworks.length > 0 && (
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 md:gap-5 space-y-0">
          {exhibition.artworks.map((artwork) => (
            <div
              key={artwork.id}
              className="group relative break-inside-avoid mb-4 md:mb-5 rounded-lg bg-parchment/60 overflow-hidden"
            >
              {/* Image */}
              <Link href={`/artworks/${artwork.id}/certificate`} className="block relative overflow-hidden">
                {artwork.image_url ? (
                  <div className="relative w-full overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={artwork.image_url}
                      alt={artwork.title}
                      className="w-full h-auto object-cover block transition-transform duration-700 group-hover:scale-[1.02]"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] flex items-center justify-center bg-wine/5">
                    <ImageIcon className="h-10 w-10 text-wine/20" />
                  </div>
                )}

                {/* Subtle hover sheen over image */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </Link>

              {/* Below-image: title + optional description */}
              {(artwork.title || artwork.description) && (
                <Link
                  href={`/artworks/${artwork.id}/certificate`}
                  className="block px-4 pt-3 pb-4 border-t border-wine/10 hover:bg-wine/[0.03] transition-colors"
                >
                  {artwork.title && (
                    <p className="font-serif text-sm font-semibold text-ink leading-snug line-clamp-2 group-hover:text-wine transition-colors">
                      {artwork.title}
                    </p>
                  )}
                  {artwork.description && (
                    <p className="font-serif text-xs text-ink/50 leading-relaxed line-clamp-3 mt-1">
                      {artwork.description}
                    </p>
                  )}
                  {(artwork.listPriceDisplay || artwork.dimensions || (isOwner && artwork.status === 'draft')) && (
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-[11px] font-serif text-ink/45">
                      {artwork.listPriceDisplay && (
                        <span className="text-ink/55">{artwork.listPriceDisplay}</span>
                      )}
                      {artwork.dimensions && <span>{artwork.dimensions}</span>}
                      {isOwner && artwork.status === 'draft' && (
                        <span className="text-amber-800/90">Draft · visible to you until verified</span>
                      )}
                    </div>
                  )}
                </Link>
              )}

              {/* Owner remove button */}
              {isOwner && (
                <button
                  type="button"
                  onClick={() => handleRemoveArtwork(artwork.id)}
                  disabled={removingId === artwork.id || pending}
                  aria-label="Remove artwork"
                  className="absolute top-2.5 right-2.5 h-7 w-7 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm disabled:cursor-not-allowed"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Add Artwork Dialog ──────────────────────────────────────────────────────

type ManualRow = { key: string; title: string; price: string; dimensions: string };

function emptyManualRow(): ManualRow {
  return {
    key: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    title: '',
    price: '',
    dimensions: '',
  };
}

function AddArtworkDialog({
  exhibitionId,
  onAdd,
  existingArtworkIds,
}: {
  exhibitionId: string;
  onAdd: (artworkId: string) => void;
  existingArtworkIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [artworks, setArtworks] = useState<
    Array<{ id: string; title: string; image_url: string | null }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [manualRows, setManualRows] = useState<ManualRow[]>([emptyManualRow()]);
  const [manualPending, startManualTransition] = useTransition();

  const resetDialog = () => {
    setSearch('');
    setArtworks([]);
    setManualRows([emptyManualRow()]);
  };

  const handleSearch = async (query: string) => {
    if (query.length < 2) { setArtworks([]); return; }
    setLoading(true);
    try {
      const response = await fetch(`/api/search-artworks?q=${encodeURIComponent(query)}`);
      if (response.ok) {
        const data = await response.json();
        setArtworks(data.filter((a: any) => !existingArtworkIds.includes(a.id)));
      }
    } catch (error) {
      console.error('[ExhibitionDetails] Error searching artworks:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateManualRow = (key: string, field: keyof Pick<ManualRow, 'title' | 'price' | 'dimensions'>, value: string) => {
    setManualRows((rows) =>
      rows.map((r) => (r.key === key ? { ...r, [field]: value } : r)),
    );
  };

  const addManualRow = () => {
    setManualRows((rows) => [...rows, emptyManualRow()]);
  };

  const removeManualRow = (key: string) => {
    setManualRows((rows) => (rows.length <= 1 ? rows : rows.filter((r) => r.key !== key)));
  };

  const handleSaveManualListings = () => {
    const payload = manualRows
      .filter((r) => r.title.trim().length > 0)
      .map((r) => ({
        title: r.title.trim(),
        price: r.price.trim(),
        dimensions: r.dimensions.trim(),
      }));

    if (payload.length === 0) {
      toast.error('Add at least one artwork with a title.');
      return;
    }

    startManualTransition(async () => {
      try {
        const result = await createQuickExhibitionListings(exhibitionId, payload);
        if (!result.success) {
          console.error('[ExhibitionDetails] Manual listings failed', result.error);
          toast.error(result.error);
          return;
        }
        toast.success(
          result.created === 1
            ? 'Listing added to the show.'
            : `${result.created} listings added to the show.`,
        );
        setOpen(false);
        resetDialog();
        router.refresh();
      } catch (e: any) {
        console.error('[ExhibitionDetails] Manual listings error', e);
        toast.error(e?.message || 'Failed to save listings');
      }
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetDialog();
      }}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Artwork
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[min(90vh,720px)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Add Artwork</DialogTitle>
          <DialogDescription className="font-serif text-sm">
            Link an existing certified work, or add quick listings (title, price, dimensions)—you can add several at once.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="search" className="w-full">
          <TabsList className="w-full h-auto flex flex-wrap justify-start gap-1 rounded-lg border border-wine/15 bg-parchment/50 p-1">
            <TabsTrigger
              value="search"
              className="font-serif text-xs data-[state=active]:bg-wine data-[state=active]:text-parchment rounded-md"
            >
              Search catalog
            </TabsTrigger>
            <TabsTrigger
              value="manual"
              className="font-serif text-xs data-[state=active]:bg-wine data-[state=active]:text-parchment rounded-md gap-1"
            >
              <ListPlus className="h-3 w-3" />
              Add listings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4 py-4 outline-none">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-ink/35" />
              <Input
                value={search}
                onChange={(e) => { setSearch(e.target.value); handleSearch(e.target.value); }}
                placeholder="Search by artwork title…"
                className="pl-9 font-serif"
              />
            </div>
            <div className="max-h-64 overflow-y-auto space-y-1 -mx-1 px-1">
              {loading ? (
                <p className="text-xs text-ink/50 font-serif text-center py-4">Searching…</p>
              ) : artworks.length === 0 ? (
                <p className="text-xs text-ink/40 font-serif text-center py-4">
                  {search.length < 2 ? 'Type at least 2 characters' : 'No artworks found'}
                </p>
              ) : (
                artworks.map((artwork) => (
                  <button
                    key={artwork.id}
                    type="button"
                    className="w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-wine/8 transition-colors group"
                    onClick={() => { onAdd(artwork.id); setOpen(false); resetDialog(); }}
                  >
                    {artwork.image_url ? (
                      <div className="relative w-10 h-10 rounded overflow-hidden shrink-0 bg-parchment">
                        <Image src={artwork.image_url} alt="" fill className="object-cover" unoptimized />
                      </div>
                    ) : (
                      <div className="w-10 h-10 rounded bg-wine/10 flex items-center justify-center shrink-0">
                        <ImageIcon className="h-4 w-4 text-wine/40" />
                      </div>
                    )}
                    <span className="font-serif text-sm text-ink group-hover:text-wine transition-colors line-clamp-2">
                      {artwork.title}
                    </span>
                  </button>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4 py-4 outline-none">
            <p className="text-[11px] text-ink/45 font-serif">
              Create draft listings for this show. They stay private until the work is verified; you can add photos and details later from your collection.
            </p>
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {manualRows.map((row, index) => (
                <div
                  key={row.key}
                  className="rounded-lg border border-wine/12 bg-parchment/40 p-3 space-y-2 relative"
                >
                  {manualRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeManualRow(row.key)}
                      className="absolute top-2 right-2 p-1 rounded text-ink/25 hover:text-red-600 hover:bg-red-50"
                      aria-label="Remove row"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <p className="text-[10px] uppercase tracking-wider text-ink/35 font-serif font-semibold">
                    Work {index + 1}
                  </p>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`tl-${row.key}`} className="text-xs font-serif">Title</Label>
                    <Input
                      id={`tl-${row.key}`}
                      value={row.title}
                      onChange={(e) => updateManualRow(row.key, 'title', e.target.value)}
                      placeholder="Artwork title"
                      className="font-serif text-sm pr-8"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="grid gap-1.5">
                      <Label htmlFor={`pr-${row.key}`} className="text-xs font-serif">Price</Label>
                      <Input
                        id={`pr-${row.key}`}
                        value={row.price}
                        onChange={(e) => updateManualRow(row.key, 'price', e.target.value)}
                        placeholder="e.g. $1,200 or 1200 USD"
                        className="font-serif text-sm"
                      />
                    </div>
                    <div className="grid gap-1.5">
                      <Label htmlFor={`dm-${row.key}`} className="text-xs font-serif">Dimensions</Label>
                      <Input
                        id={`dm-${row.key}`}
                        value={row.dimensions}
                        onChange={(e) => updateManualRow(row.key, 'dimensions', e.target.value)}
                        placeholder='e.g. 24 × 36 in'
                        className="font-serif text-sm"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="font-serif border-wine/25 text-wine"
                onClick={addManualRow}
                disabled={manualPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add another
              </Button>
              <Button
                type="button"
                size="sm"
                className="font-serif bg-wine text-parchment hover:bg-wine/90 ml-auto"
                onClick={handleSaveManualListings}
                disabled={manualPending}
              >
                {manualPending ? 'Saving…' : 'Save listings'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Check, ChevronsUpDown, Eye, Sparkles, X } from 'lucide-react';
import { PrintMenu } from './print-menu';
import { SendMenu } from './send-menu';
import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
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
import { Popover, PopoverContent, PopoverTrigger } from '@kit/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@kit/ui/command';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@kit/ui/sheet';
import { cn } from '@kit/ui/utils';
import { batchUpdateProvenance } from '../_actions/batch-update-provenance';
import type { UserRole } from '~/lib/user-roles';

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

/** Optional blocks stacked in the primary “image & title” column (hidden until toggled). */
const OPTIONAL_PRIMARY_FIELDS = [
  'creation_date',
  'medium',
  'dimensions',
  'former_owners',
  'auction_history',
  'exhibition',
  'exhibition_history',
  'historic_context',
  'celebrity_notes',
  'edition',
  'production_location',
  'owned_by',
  'sold_by',
  'is_public',
  'received',
] as const;

type OptionalPrimaryField = (typeof OPTIONAL_PRIMARY_FIELDS)[number];

const OPTIONAL_PRIMARY_LABELS: Record<OptionalPrimaryField, string> = {
  creation_date: 'Creation date',
  medium: 'Medium',
  dimensions: 'Dimensions',
  former_owners: 'Former owners',
  auction_history: 'Auction history',
  exhibition: 'Exhibition link',
  exhibition_history: 'Exhibition history',
  historic_context: 'Historic context',
  celebrity_notes: 'Celebrity notes',
  edition: 'Edition',
  production_location: 'Production location',
  owned_by: 'Owned by',
  sold_by: 'Sold by',
  is_public: 'Public listing',
  received: 'Received',
};

function CertificatePreviewPanel({
  artwork,
  data,
  exhibition,
  onClose,
}: {
  artwork: Artwork;
  data: ArtworkFormData;
  exhibition: LinkableExhibition | null;
  onClose: () => void;
}) {
  const [imageError, setImageError] = useState(false);

  const formatDate = (iso: string | null | undefined) => {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const hasProvenance =
    data.former_owners ||
    data.auction_history ||
    data.exhibition_history ||
    data.historic_context ||
    data.celebrity_notes;

  return (
    <div className="h-full overflow-y-auto bg-parchment">
      {/* Header strip */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-wine/20 bg-parchment/95 backdrop-blur-md px-4 py-3">
        <p className="text-xs font-serif text-ink/60">
          Certificate preview — edits appear live
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1 text-ink/50 hover:text-ink/80 transition-colors"
          aria-label="Close preview"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Certificate body */}
      <div className="p-4 sm:p-6">
        <div className="bg-white border-double-box p-4 sm:p-8 shadow-md">
          {/* Cert header */}
          <div className="text-center mb-6 border-b-2 border-wine pb-5">
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-wine mb-1 tracking-widest">
              CERTIFICATE OF AUTHENTICITY
            </h1>
            <p className="text-ink/70 font-serif text-sm">
              Provenance | A Journal of Art, Objects &amp; Their Histories
            </p>
          </div>

          {/* Certificate number */}
          {artwork.certificate_number && (
            <div className="mb-5">
              <p className="text-xs text-ink/60 font-serif mb-0.5">Certificate Number</p>
              <p className="text-base font-display font-bold text-wine break-all">
                {artwork.certificate_number}
              </p>
            </div>
          )}

          {/* Artwork image */}
          {artwork.image_url && !imageError && (
            <div className="mb-6 text-center">
              <div className="inline-block border-2 border-wine p-2 sm:p-3 bg-parchment max-w-full">
                <div className="relative w-full max-w-full">
                  <Image
                    src={artwork.image_url}
                    alt={data.title || artwork.title || 'Artwork'}
                    width={400}
                    height={280}
                    className="object-contain w-full h-auto max-h-52 sm:max-h-64"
                    unoptimized
                    onError={() => setImageError(true)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Core fields */}
          <div className="space-y-3 mb-6">
            <div className="border-b border-wine/20 pb-2">
              <p className="text-xs text-ink/60 font-serif mb-0.5">Title</p>
              <p className="text-xl font-display font-bold text-wine break-words">
                {data.title || 'Untitled Artwork'}
              </p>
            </div>

            {data.artist_name && (
              <div className="border-b border-wine/20 pb-2">
                <p className="text-xs text-ink/60 font-serif mb-0.5">Artist</p>
                <p className="text-base font-serif text-wine break-words">{data.artist_name}</p>
              </div>
            )}

            {data.description && (
              <div className="border-b border-wine/20 pb-2">
                <p className="text-xs text-ink/60 font-serif mb-0.5">Description</p>
                <p className="text-sm font-serif text-ink whitespace-pre-wrap break-words">
                  {data.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {data.creation_date && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Creation Date</p>
                  <p className="text-sm font-serif text-ink">{formatDate(data.creation_date)}</p>
                </div>
              )}
              {data.medium && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Medium</p>
                  <p className="text-sm font-serif text-ink break-words">{data.medium}</p>
                </div>
              )}
              {data.dimensions && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Dimensions</p>
                  <p className="text-sm font-serif text-ink break-words">{data.dimensions}</p>
                </div>
              )}
              {data.edition && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Edition</p>
                  <p className="text-sm font-serif text-ink break-words">{data.edition}</p>
                </div>
              )}
              {data.production_location && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Production Location</p>
                  <p className="text-sm font-serif text-ink break-words">{data.production_location}</p>
                </div>
              )}
              {data.value && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Value</p>
                  <p className="text-sm font-serif text-ink break-words">{data.value}</p>
                </div>
              )}
              {data.owned_by && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Owned By</p>
                  <p className="text-sm font-serif text-ink break-words">{data.owned_by}</p>
                </div>
              )}
              {data.sold_by && (
                <div className="border-b border-wine/20 pb-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Sold By</p>
                  <p className="text-sm font-serif text-ink break-words">{data.sold_by}</p>
                </div>
              )}
              {exhibition && (
                <div className="border-b border-wine/20 pb-2 sm:col-span-2">
                  <p className="text-xs text-ink/60 font-serif mb-0.5">Exhibition</p>
                  <p className="text-sm font-serif text-wine break-words">{exhibition.title}</p>
                  {exhibition.start_date && (
                    <p className="text-xs text-ink/60 font-serif mt-0.5">
                      {formatDate(exhibition.start_date)}
                      {exhibition.end_date ? ` – ${formatDate(exhibition.end_date)}` : ''}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Provenance section */}
          {hasProvenance && (
            <div className="border-t-2 border-wine pt-5 mt-5">
              <h2 className="text-xl font-display font-bold text-wine mb-3">Provenance</h2>
              <div className="space-y-3">
                {data.former_owners && (
                  <div>
                    <p className="text-xs text-ink/60 font-serif mb-0.5 font-semibold">Former Owners</p>
                    <p className="text-sm font-serif text-ink whitespace-pre-wrap break-words">
                      {data.former_owners}
                    </p>
                  </div>
                )}
                {data.auction_history && (
                  <div>
                    <p className="text-xs text-ink/60 font-serif mb-0.5 font-semibold">Auction History</p>
                    <p className="text-sm font-serif text-ink whitespace-pre-wrap break-words">
                      {data.auction_history}
                    </p>
                  </div>
                )}
                {data.exhibition_history && (
                  <div>
                    <p className="text-xs text-ink/60 font-serif mb-0.5 font-semibold">Exhibition History</p>
                    <p className="text-sm font-serif text-ink whitespace-pre-wrap break-words">
                      {data.exhibition_history}
                    </p>
                  </div>
                )}
                {data.historic_context && (
                  <div>
                    <p className="text-xs text-ink/60 font-serif mb-0.5 font-semibold">Historic Context</p>
                    <p className="text-sm font-serif text-ink whitespace-pre-wrap break-words">
                      {data.historic_context}
                    </p>
                  </div>
                )}
                {data.celebrity_notes && (
                  <div>
                    <p className="text-xs text-ink/60 font-serif mb-0.5 font-semibold">Special Notes</p>
                    <p className="text-sm font-serif text-ink whitespace-pre-wrap break-words">
                      {data.celebrity_notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Authentication statement */}
          <div className="border-t-2 border-wine pt-5 mt-6">
            <p className="text-sm font-serif text-ink leading-relaxed break-words">
              This certifies that the artwork described above has been registered in the Provenance
              registry and assigned the certificate number{' '}
              <span className="font-bold text-wine break-all">
                {artwork.certificate_number || '—'}
              </span>
              . This certificate serves as a record of authenticity and provenance for the artwork.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-wine/20 text-center">
            <p className="text-xs text-ink/50 font-serif">
              Provenance | Verified provenance entries and immutable historical timelines
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExhibitionCombobox({
  artworkId,
  value,
  options,
  onChange,
}: {
  artworkId: string;
  value: string | null;
  options: LinkableExhibition[];
  onChange: (value: string | null) => void;
}) {
  const [open, setOpen] = useState(false);

  const allOptions = [...options];
  if (value && !allOptions.some((e) => e.id === value)) {
    allOptions.unshift({
      id: value,
      title: 'Current linked exhibition',
      start_date: null,
      end_date: null,
    });
  }

  const selected = allOptions.find((e) => e.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          role="combobox"
          aria-expanded={open}
          aria-label="Link to exhibition"
          className={cn(
            'font-serif text-sm min-h-11 h-auto w-full max-w-full sm:h-9 sm:min-h-0 sm:w-[200px] flex items-center justify-between rounded-md border border-wine/20 bg-background px-3 py-2 text-left',
            'hover:border-wine/40 focus:outline-none focus:ring-2 focus:ring-wine/30 focus:ring-offset-2 focus:ring-offset-parchment',
            !selected && 'text-ink/50',
          )}
        >
          <span className="truncate">
            {selected
              ? `${selected.title}${selected.start_date ? ` (${new Date(selected.start_date).getFullYear()})` : ''}`
              : allOptions.length === 0
                ? 'No exhibitions'
                : 'Select exhibition'}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[min(calc(100vw-2rem),280px)] sm:w-[260px] p-0"
        align="start"
      >
        <Command>
          <CommandInput placeholder="Search exhibitions..." className="font-serif text-sm" />
          <CommandList>
            <CommandEmpty className="font-serif text-sm py-3 text-center text-ink/60">
              No exhibitions found.
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="__none__"
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
                className="font-serif text-sm"
              >
                <Check className={cn('mr-2 h-4 w-4', value === null ? 'opacity-100' : 'opacity-0')} />
                None
              </CommandItem>
              {allOptions.map((ex) => {
                const year = ex.start_date ? new Date(ex.start_date).getFullYear() : null;
                return (
                  <CommandItem
                    key={ex.id}
                    value={`${ex.title}${year ? ` ${year}` : ''}`}
                    onSelect={() => {
                      onChange(ex.id);
                      setOpen(false);
                    }}
                    className="font-serif text-sm"
                  >
                    <Check className={cn('mr-2 h-4 w-4 shrink-0', value === ex.id ? 'opacity-100' : 'opacity-0')} />
                    <span className="truncate">
                      {ex.title}
                      {year ? <span className="text-xs text-ink/60 ml-1">({year})</span> : null}
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SpreadsheetEditForm({
  artworks,
  linkableExhibitions,
  initialExhibitionIdByArtworkId,
  receiverName,
  assignExhibitionId = null,
  assignExhibitionTitle = null,
  galleryName,
  senderRole,
  galleryProfiles = [],
}: {
  artworks: Artwork[];
  linkableExhibitions: LinkableExhibition[];
  initialExhibitionIdByArtworkId: Record<string, string | null>;
  receiverName?: string;
  assignExhibitionId?: string | null;
  assignExhibitionTitle?: string | null;
  galleryName?: string;
  senderRole?: UserRole | null;
  galleryProfiles?: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewArtworkId, setPreviewArtworkId] = useState<string | null>(null);
  const isAssignFlow = Boolean(assignExhibitionId);
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState(
    isAssignFlow ? '__unassigned__' : '__all__',
  );
  const [artworkSearchTerm, setArtworkSearchTerm] = useState('');
  const [assignConfirmation, setAssignConfirmation] = useState<number | null>(null);
  const [selectedArtworkIds, setSelectedArtworkIds] = useState<Set<string>>(() => {
    if (artworks.length === 0 || isAssignFlow) {
      return new Set();
    }
    return new Set([artworks[0].id]);
  });
  /** Extra provenance blocks shown inside the primary image & title column. */
  const [optionalPrimaryFields, setOptionalPrimaryFields] = useState<Set<OptionalPrimaryField>>(
    () => new Set(),
  );
  /** Per-artwork date for the "Received" stamp, defaults to today's date. */
  const todayIso = new Date().toISOString().split('T')[0];
  const [receivedDates, setReceivedDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(artworks.map((a) => [a.id, todayIso])),
  );
  /** Per-artwork confirmation that a "Received" stamp was applied this session. */
  const [receivedStamped, setReceivedStamped] = useState<Set<string>>(() => new Set());
  /** Per-artwork optional note appended to the received stamp (e.g. condition, location). */
  const [receivedNotes, setReceivedNotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(artworks.map((a) => [a.id, ''])),
  );
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

  const toggleOptionalPrimaryField = (field: OptionalPrimaryField) => {
    setOptionalPrimaryFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
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

  const handleBulkAssignToExhibition = () => {
    if (!assignExhibitionId) return;
    const targetIds = Array.from(selectedArtworkIds);
    if (targetIds.length === 0) {
      setError('Select at least one artwork to add to this exhibition.');
      return;
    }
    console.log('[Collection] bulk assign artworks to exhibition', {
      exhibitionId: assignExhibitionId,
      count: targetIds.length,
    });
    setArtworkData((prev) => {
      const next = { ...prev };
      for (const artworkId of targetIds) {
        const current = next[artworkId];
        if (!current) continue;
        next[artworkId] = { ...current, exhibition_id: assignExhibitionId };
      }
      return next;
    });
    // After assignment these rows are no longer "unassigned"; switch the viewer
    // to the new exhibition so the selection and the Save button both reflect
    // the pending changes the user is about to persist.
    setSelectedCollectionFilter(assignExhibitionId);
    setAssignConfirmation(targetIds.length);
    setError(null);
    if (typeof document !== 'undefined') {
      requestAnimationFrame(() => {
        const saveButton = document.querySelector<HTMLButtonElement>(
          'button[type="submit"][data-save-changes]',
        );
        saveButton?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      });
    }
  };

  const handleSkipAssign = () => {
    router.replace('/artworks/my');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 w-full max-w-full overflow-x-hidden">
      {isAssignFlow && assignExhibitionId && (
        <div className="sticky top-0 z-30 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="rounded-2xl border border-ink/20 bg-ink text-parchment shadow-lg px-4 py-4 sm:px-5 sm:py-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3 min-w-0">
                <span className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-full bg-parchment/10">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <p className="text-[11px] font-landing font-light tracking-[0.28em] uppercase text-parchment/70">
                    New exhibition
                  </p>
                  <p className="font-display text-lg sm:text-xl font-semibold truncate">
                    Add artworks to {assignExhibitionTitle || 'your exhibition'}
                  </p>
                  <p className="font-serif text-sm text-parchment/80">
                    Tap the unassigned thumbnails below to select pieces, then press Assign selected. Save changes when you are done.
                  </p>
                  {assignConfirmation !== null && (
                    <p className="font-serif text-xs text-parchment/85">
                      Queued {assignConfirmation} {assignConfirmation === 1 ? 'artwork' : 'artworks'} for this exhibition. Scroll down and hit Save changes to persist.
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:shrink-0">
                <Button
                  type="button"
                  onClick={handleBulkAssignToExhibition}
                  disabled={selectedArtworkIds.size === 0}
                  className="bg-parchment text-ink hover:bg-parchment/90 font-serif h-10 px-4 text-sm disabled:opacity-60"
                >
                  Assign selected ({selectedArtworkIds.size})
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSkipAssign}
                  className="border-parchment/40 bg-transparent text-parchment hover:bg-parchment/10 font-serif h-10 px-4 text-sm"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

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

      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-sm text-ink/70 font-serif leading-relaxed">
            Swipe the row to browse pieces, tap to select or deselect, then edit below.
          </p>
          <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-0">
            <div className="w-full min-w-0 sm:w-[280px]">
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
            <div className="w-full min-w-0 sm:w-[280px]">
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
        <div
          className="max-w-full overflow-x-auto pb-3 -mx-1 px-1 scroll-pl-3 scroll-pr-3 snap-x snap-mandatory [scrollbar-width:thin] sm:scroll-pl-0 sm:scroll-pr-0 sm:mx-0 sm:px-0"
          role="region"
          aria-label="Artwork thumbnails"
        >
          {filteredArtworks.length === 0 ? (
            <div className="py-8 text-center rounded-xl border border-dashed border-wine/20 bg-wine/[0.03]">
              <p className="text-sm text-ink/60 font-serif px-4">
                No artworks match this filter. Try “All collections” or clear search.
              </p>
            </div>
          ) : (
            <div className="flex gap-3 py-1">
              {filteredArtworks.map((artwork) => {
                const isSelected = selectedArtworkIds.has(artwork.id);
                return (
                  <button
                    key={artwork.id}
                    type="button"
                    onClick={() => toggleArtworkSelection(artwork.id)}
                    className={cn(
                      'snap-start shrink-0 w-[min(9.25rem,calc(50vw-1.75rem))] sm:w-[132px] p-2 rounded-xl border text-left transition-all touch-manipulation',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wine/40 focus-visible:ring-offset-2 focus-visible:ring-offset-parchment',
                      isSelected
                        ? 'border-wine bg-wine/10 shadow-sm ring-1 ring-wine/20'
                        : 'border-wine/20 bg-parchment/80 opacity-80 hover:opacity-100 active:scale-[0.99]',
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="relative w-full aspect-[4/3] min-h-[5.5rem] rounded-lg overflow-hidden border border-wine/20 bg-ink/5">
                      {artwork.image_url ? (
                        <Image
                          src={artwork.image_url}
                          alt={artwork.title || 'Artwork'}
                          fill
                          className="object-cover"
                          sizes="(max-width:640px) 45vw, 132px"
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
                    <p className="mt-2 text-xs font-serif text-ink line-clamp-2 min-h-[2.25rem] text-left leading-snug">
                      {artwork.title || 'Untitled'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs text-ink/60 font-serif order-2 sm:order-1">
            {visibleArtworks.length} selected of {filteredArtworks.length} in view
          </p>
          <div className="flex items-center gap-2 order-1 sm:order-2 justify-end sm:justify-start">
            <Button
              type="button"
              variant="outline"
              onClick={handleSelectAll}
              className="h-9 min-h-9 px-3 text-xs font-serif touch-manipulation sm:h-7 sm:min-h-0 sm:px-2"
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClearSelection}
              className="h-9 min-h-9 px-3 text-xs font-serif touch-manipulation sm:h-7 sm:min-h-0 sm:px-2"
            >
              Clear
            </Button>
            <PrintMenu
              artworks={artworks}
              artworkData={artworkData}
              selectedArtworkIds={selectedArtworkIds}
              galleryName={galleryName}
            />
            <SendMenu
              selectedArtworkIds={selectedArtworkIds}
              senderRole={senderRole}
              galleryProfiles={galleryProfiles}
            />
          </div>
        </div>
      </div>

      {/* Which extra fields appear in each row (below image, title, artist, description, value) */}
      <div className="rounded-2xl border border-wine/15 bg-gradient-to-b from-parchment to-wine/[0.04] px-4 py-4 sm:px-5 space-y-3 shadow-sm">
        <div>
          <p className="text-xs font-display font-semibold uppercase tracking-wide text-wine">
            Fields in each artwork row
          </p>
          <p className="text-xs text-ink/60 font-serif mt-1 max-w-2xl">
            Image, title, artist, description, and value are always shown. Tap a label to add or
            remove other fields—they appear in the same card under the value.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {OPTIONAL_PRIMARY_FIELDS.map((field) => {
            const active = optionalPrimaryFields.has(field);
            return (
              <Button
                key={field}
                type="button"
                variant={active ? 'default' : 'outline'}
                size="sm"
                onClick={() => toggleOptionalPrimaryField(field)}
                className="font-serif text-xs h-9 sm:h-8 rounded-full border-wine/25 touch-manipulation"
                aria-pressed={active}
              >
                {OPTIONAL_PRIMARY_LABELS[field]}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Spreadsheet: one column per artwork — core fields + toggled extras */}
      <div className="max-w-full overflow-x-auto border border-wine/15 rounded-2xl bg-parchment/70 shadow-sm">
        {visibleArtworks.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-ink/70 font-serif">
              Select one or more artworks above to edit.
            </p>
          </div>
        ) : (
          <table className="w-full min-w-0">
            <thead className="bg-wine/[0.08] sticky top-0 z-10 backdrop-blur-sm">
              <tr>
                <th className="px-3 py-3 sm:px-5 sm:py-3.5 text-left text-xs sm:text-sm font-display text-wine font-bold tracking-wide uppercase border-b border-wine/15">
                  Artwork details
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleArtworks.map((artwork) => {
                const data = artworkData[artwork.id];
                if (!data) return null;

                const optionalOrdered = OPTIONAL_PRIMARY_FIELDS.filter((f) =>
                  optionalPrimaryFields.has(f),
                );

                return (
                  <tr
                    key={artwork.id}
                    className="border-b border-wine/10 bg-wine/10 hover:bg-wine/15"
                  >
                    <td className="px-3 py-4 sm:px-5 align-top">
                      <div className="max-w-xl min-w-0 space-y-4">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <p className="text-[10px] text-ink/40 font-serif uppercase tracking-wide">
                            Editing
                          </p>
                          <button
                            type="button"
                            onClick={() => setPreviewArtworkId(artwork.id)}
                            className="flex items-center gap-1 rounded-full border border-wine/25 bg-parchment px-2.5 py-1 text-[11px] font-serif text-wine hover:bg-wine/10 hover:border-wine/50 transition-colors touch-manipulation"
                            aria-label="Preview certificate"
                          >
                            <Eye className="h-3 w-3" />
                            Preview certificate
                          </button>
                        </div>

                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                          {artwork.image_url ? (
                            <div className="relative mx-auto w-full max-w-[11rem] aspect-square sm:mx-0 sm:max-w-none sm:w-20 sm:h-20 sm:aspect-auto flex-shrink-0 rounded-xl sm:rounded-lg overflow-hidden border border-wine/20 shadow-sm">
                              <Image
                                src={artwork.image_url}
                                alt={data.title || artwork.title}
                                fill
                                className="object-cover"
                                sizes="(max-width:640px) 90vw, 80px"
                              />
                            </div>
                          ) : (
                            <div className="mx-auto w-full max-w-[11rem] aspect-square sm:mx-0 sm:max-w-none sm:w-20 sm:h-20 sm:aspect-auto flex-shrink-0 rounded-xl sm:rounded-lg border border-wine/20 bg-ink/5 flex items-center justify-center">
                              <span className="text-ink/30 text-xs font-serif">No image</span>
                            </div>
                          )}
                          <div className="min-w-0 flex-1 space-y-2 w-full">
                            <div className="space-y-1">
                              <Label className="text-xs font-serif text-ink/60">Title</Label>
                              <Input
                                value={data.title}
                                onChange={(e) =>
                                  updateField(artwork.id, 'title', e.target.value)
                                }
                                className="font-display font-semibold text-wine text-sm h-9 border-wine/20"
                                placeholder="Artwork title"
                                aria-label="Artwork title"
                              />
                            </div>
                            {artwork.certificate_number ? (
                              <p className="text-xs text-ink/50 font-serif truncate">
                                {artwork.certificate_number}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-serif text-ink/60">Artist</Label>
                          <Input
                            value={data.artist_name}
                            onChange={(e) =>
                              updateField(artwork.id, 'artist_name', e.target.value)
                            }
                            className="font-serif text-sm h-9 border-wine/20"
                            placeholder="Artist name"
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-serif text-ink/60">Description</Label>
                          <Textarea
                            value={data.description}
                            onChange={(e) =>
                              updateField(artwork.id, 'description', e.target.value)
                            }
                            className="font-serif text-sm min-h-[72px] border-wine/20 resize-y"
                            placeholder="Description"
                            rows={3}
                          />
                        </div>

                        <div className="space-y-1">
                          <Label className="text-xs font-serif text-ink/60">Value</Label>
                          <Input
                            value={data.value}
                            onChange={(e) => updateField(artwork.id, 'value', e.target.value)}
                            className="font-serif text-sm h-9 border-wine/20"
                            placeholder="$10,000"
                          />
                        </div>

                        {optionalOrdered.map((field) => (
                          <div
                            key={`${artwork.id}-${field}`}
                            className="space-y-1 pt-2 border-t border-wine/15"
                          >
                            {field === 'creation_date' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.creation_date}
                                </Label>
                                <Input
                                  type="date"
                                  value={data.creation_date}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'creation_date', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                />
                              </>
                            ) : null}
                            {field === 'medium' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.medium}
                                </Label>
                                <Input
                                  value={data.medium}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'medium', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                  placeholder="e.g., Oil on canvas"
                                />
                              </>
                            ) : null}
                            {field === 'dimensions' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.dimensions}
                                </Label>
                                <Input
                                  value={data.dimensions}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'dimensions', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                  placeholder="e.g., 24 × 36 in"
                                />
                              </>
                            ) : null}
                            {field === 'former_owners' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.former_owners}
                                </Label>
                                <Textarea
                                  value={data.former_owners}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'former_owners', e.target.value)
                                  }
                                  className="font-serif text-sm min-h-[60px] border-wine/20 resize-y"
                                  placeholder="Former owners"
                                  rows={2}
                                />
                              </>
                            ) : null}
                            {field === 'auction_history' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.auction_history}
                                </Label>
                                <Textarea
                                  value={data.auction_history}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'auction_history', e.target.value)
                                  }
                                  className="font-serif text-sm min-h-[60px] border-wine/20 resize-y"
                                  placeholder="Auction history"
                                  rows={2}
                                />
                              </>
                            ) : null}
                            {field === 'exhibition' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.exhibition}
                                </Label>
                                <ExhibitionCombobox
                                  artworkId={artwork.id}
                                  value={data.exhibition_id ?? null}
                                  options={linkableExhibitions}
                                  onChange={(v) => updateField(artwork.id, 'exhibition_id', v)}
                                />
                                <p className="text-[10px] text-ink/50 font-serif leading-tight">
                                  Optional link. Use exhibition history for free-text notes.
                                </p>
                              </>
                            ) : null}
                            {field === 'exhibition_history' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.exhibition_history}
                                </Label>
                                <Textarea
                                  value={data.exhibition_history}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'exhibition_history', e.target.value)
                                  }
                                  className="font-serif text-sm min-h-[60px] border-wine/20 resize-y"
                                  placeholder="Exhibitions and literature"
                                  rows={2}
                                />
                              </>
                            ) : null}
                            {field === 'historic_context' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.historic_context}
                                </Label>
                                <Textarea
                                  value={data.historic_context}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'historic_context', e.target.value)
                                  }
                                  className="font-serif text-sm min-h-[60px] border-wine/20 resize-y"
                                  placeholder="Historic context"
                                  rows={2}
                                />
                              </>
                            ) : null}
                            {field === 'celebrity_notes' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.celebrity_notes}
                                </Label>
                                <Textarea
                                  value={data.celebrity_notes}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'celebrity_notes', e.target.value)
                                  }
                                  className="font-serif text-sm min-h-[60px] border-wine/20 resize-y"
                                  placeholder="Celebrity notes"
                                  rows={2}
                                />
                              </>
                            ) : null}
                            {field === 'edition' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.edition}
                                </Label>
                                <Input
                                  value={data.edition}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'edition', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                  placeholder="e.g., 1/10"
                                />
                              </>
                            ) : null}
                            {field === 'production_location' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.production_location}
                                </Label>
                                <Input
                                  value={data.production_location}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'production_location', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                  placeholder="Where it was made"
                                />
                              </>
                            ) : null}
                            {field === 'owned_by' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.owned_by}
                                </Label>
                                <Input
                                  value={data.owned_by}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'owned_by', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                  placeholder="Owner or collection"
                                />
                              </>
                            ) : null}
                            {field === 'sold_by' ? (
                              <>
                                <Label className="text-xs font-serif text-ink/60">
                                  {OPTIONAL_PRIMARY_LABELS.sold_by}
                                </Label>
                                <Input
                                  value={data.sold_by}
                                  onChange={(e) =>
                                    updateField(artwork.id, 'sold_by', e.target.value)
                                  }
                                  className="font-serif text-sm h-9 border-wine/20"
                                  placeholder="Gallery or seller"
                                />
                              </>
                            ) : null}
                            {field === 'is_public' ? (
                              <div className="flex items-center justify-between gap-3 rounded-md border border-wine/20 bg-parchment/60 px-3 py-2">
                                <div>
                                  <Label className="text-xs font-serif text-ink/80">
                                    {OPTIONAL_PRIMARY_LABELS.is_public}
                                  </Label>
                                  <p className="text-[10px] text-ink/50 font-serif">
                                    Visible on your public profile when on.
                                  </p>
                                </div>
                                <Switch
                                  checked={data.is_public ?? false}
                                  onCheckedChange={(checked) =>
                                    updateField(artwork.id, 'is_public', checked)
                                  }
                                />
                              </div>
                            ) : null}
                            {field === 'received' ? (
                              <div className="rounded-md border border-wine/20 bg-wine/[0.03] p-3 space-y-2.5">
                                <div>
                                  <p className="text-xs font-serif font-medium text-ink/80">
                                    {OPTIONAL_PRIMARY_LABELS.received}
                                  </p>
                                  <p className="text-[10px] text-ink/50 font-serif mt-0.5 leading-snug">
                                    Stamps &ldquo;Received by {receiverName}&rdquo; into Former owners on Save.
                                  </p>
                                </div>
                                {/* Date */}
                                <Input
                                  type="date"
                                  value={receivedDates[artwork.id] ?? todayIso}
                                  onChange={(e) =>
                                    setReceivedDates((prev) => ({
                                      ...prev,
                                      [artwork.id]: e.target.value,
                                    }))
                                  }
                                  className="font-serif text-sm h-9 border-wine/20 w-full"
                                  aria-label="Date received"
                                />
                                {/* Note (optional) */}
                                <Input
                                  type="text"
                                  placeholder="Note (optional) — condition, location…"
                                  value={receivedNotes[artwork.id] ?? ''}
                                  onChange={(e) =>
                                    setReceivedNotes((prev) => ({
                                      ...prev,
                                      [artwork.id]: e.target.value,
                                    }))
                                  }
                                  className="font-serif text-xs h-8 border-wine/20 w-full placeholder:text-ink/30"
                                  aria-label="Received note"
                                />
                                {/* Button */}
                                <Button
                                  type="button"
                                  size="sm"
                                  onClick={() => {
                                    const dateStr = receivedDates[artwork.id] ?? todayIso;
                                    const formattedDate = new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric',
                                    });
                                    const note = (receivedNotes[artwork.id] ?? '').trim();
                                    const entry = note
                                      ? `Received by ${receiverName}, ${formattedDate} — ${note}`
                                      : `Received by ${receiverName}, ${formattedDate}`;
                                    const existing = data.former_owners.trim();
                                    const updated = existing ? `${existing}\n${entry}` : entry;
                                    updateField(artwork.id, 'former_owners', updated);
                                    setReceivedStamped((prev) => new Set(prev).add(artwork.id));
                                    setReceivedNotes((prev) => ({ ...prev, [artwork.id]: '' }));
                                  }}
                                  className="font-serif text-xs h-8 w-full bg-wine text-parchment hover:bg-wine/90 whitespace-nowrap touch-manipulation"
                                >
                                  Mark as Received
                                </Button>
                                {receivedStamped.has(artwork.id) ? (
                                  <p className="text-[10px] text-green-700 font-serif">
                                    ✓ Stamped — hit Save changes to persist.
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Certificate preview sheet */}
      <Sheet
        open={previewArtworkId !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewArtworkId(null);
        }}
      >
        <SheetContent
          side="right"
          className="w-full sm:max-w-lg p-0 bg-parchment border-wine/20"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Certificate Preview</SheetTitle>
          </SheetHeader>
          {previewArtworkId && (() => {
            const previewArtwork = artworks.find((a) => a.id === previewArtworkId);
            const previewData = artworkData[previewArtworkId];
            if (!previewArtwork || !previewData) return null;
            const linkedExhibitionId = previewData.exhibition_id;
            const linkedExhibition = linkedExhibitionId
              ? (linkableExhibitions.find((e) => e.id === linkedExhibitionId) ?? null)
              : null;
            return (
              <CertificatePreviewPanel
                artwork={previewArtwork}
                data={previewData}
                exhibition={linkedExhibition}
                onClose={() => setPreviewArtworkId(null)}
              />
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Submit Button */}
      <div
        className={cn(
          'flex flex-col-reverse gap-3 sm:flex-row sm:justify-end sm:items-center',
          'sticky bottom-0 z-20 -mx-4 px-4 sm:mx-0 sm:px-0',
          'border-t border-wine/20 bg-parchment/95 backdrop-blur-md py-4',
          'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4',
        )}
      >
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push('/artworks/my')}
          disabled={pending}
          className="font-serif h-11 w-full sm:h-10 sm:w-auto touch-manipulation"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          data-save-changes
          disabled={pending || visibleArtworks.length === 0}
          className="bg-wine text-parchment hover:bg-wine/90 font-serif h-11 w-full sm:h-10 sm:w-auto touch-manipulation"
        >
          {pending
            ? 'Saving...'
            : `Save changes (${visibleArtworks.length})`}
        </Button>
      </div>
    </form>
  );
}

'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';
import { Heading } from '@kit/ui/heading';
import { toast } from '@kit/ui/sonner';
import pathsConfig from '~/config/paths.config';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import {
  isLikelyImageFile,
  MAX_UPLOAD_IMAGE_BYTES,
  prepareImageForUpload,
} from '~/lib/client-image-upload';
import {
  getExistingArtworksForSubmission,
  submitExhibitionArtwork,
  submitExistingArtworksToExhibition,
  type ExistingArtworkOption,
} from '../_actions/submit-exhibition-artwork';

const MAX_BATCH_BYTES = 4 * 1024 * 1024;

type InviteContext = {
  exhibitionTitle: string;
  galleryName: string | null;
  issuesCertificateOfShow: boolean;
  inviteeEmail: string;
  inviteeName: string | null;
  /** Most artworks this invite may submit; null = no limit. */
  maxArtworks: number | null;
  /** Where the artist follows their submission's review (the open call page). */
  statusPath: string | null;
};

type SubmitExhibitionClientProps = {
  inviteContext: InviteContext | null;
  contextError: string | null;
};

type ArtworkEntry = {
  id: string;
  title: string;
  description: string;
  medium: string;
  creationDate: string;
  dimensions: string;
  images: File[];
  formerOwners: string;
  auctionHistory: string;
  exhibitionHistory: string;
  historicContext: string;
  celebrityNotes: string;
  value: string;
  valueIsPublic: boolean;
  edition: string;
  productionLocation: string;
  ownedBy: string;
  soldBy: string;
  showMore: boolean;
};

type FlatImageItem = {
  entryId: string;
  file: File;
};

function createEntryId(): string {
  return `artwork-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function emptyEntry(): ArtworkEntry {
  return {
    id: createEntryId(),
    title: '',
    description: '',
    medium: '',
    creationDate: '',
    dimensions: '',
    images: [],
    formerOwners: '',
    auctionHistory: '',
    exhibitionHistory: '',
    historicContext: '',
    celebrityNotes: '',
    value: '',
    valueIsPublic: false,
    edition: '',
    productionLocation: '',
    ownedBy: '',
    soldBy: '',
    showMore: false,
  };
}

function appendArtworkTextFields(formData: FormData, index: number, entry: ArtworkEntry) {
  const prefix = `artwork_${index}_`;
  formData.append(`${prefix}title`, entry.title.trim());
  formData.append(`${prefix}description`, entry.description.trim());
  formData.append(`${prefix}medium`, entry.medium.trim());
  formData.append(`${prefix}creationDate`, entry.creationDate.trim());
  formData.append(`${prefix}dimensions`, entry.dimensions.trim());
  formData.append(`${prefix}formerOwners`, entry.formerOwners.trim());
  formData.append(`${prefix}auctionHistory`, entry.auctionHistory.trim());
  formData.append(`${prefix}exhibitionHistory`, entry.exhibitionHistory.trim());
  formData.append(`${prefix}historicContext`, entry.historicContext.trim());
  formData.append(`${prefix}celebrityNotes`, entry.celebrityNotes.trim());
  formData.append(`${prefix}value`, entry.value.trim());
  formData.append(`${prefix}valueIsPublic`, entry.valueIsPublic ? 'true' : 'false');
  formData.append(`${prefix}edition`, entry.edition.trim());
  formData.append(`${prefix}productionLocation`, entry.productionLocation.trim());
  formData.append(`${prefix}ownedBy`, entry.ownedBy.trim());
  formData.append(`${prefix}soldBy`, entry.soldBy.trim());
}

function buildImageChunks(flatImages: FlatImageItem[]): FlatImageItem[][] {
  const chunks: FlatImageItem[][] = [];
  let currentChunk: FlatImageItem[] = [];
  let currentBytes = 0;

  for (const item of flatImages) {
    const size = item.file.size;
    if (size > MAX_BATCH_BYTES) {
      throw new Error(`"${item.file.name}" is too large. Please choose images under 4 MB.`);
    }

    if (currentChunk.length > 0 && currentBytes + size > MAX_BATCH_BYTES) {
      chunks.push(currentChunk);
      currentChunk = [];
      currentBytes = 0;
    }

    currentChunk.push(item);
    currentBytes += size;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function buildChunkFormData(
  entries: ArtworkEntry[],
  chunkItems: FlatImageItem[],
  batchIndex: number,
  totalBatches: number,
  finalize: boolean,
  coaIdsByEntryId: Record<string, string>,
  sessionFirstCoaId: string,
  sessionFirstCosId: string,
  totalArtworkCount: number,
): { formData: FormData; chunkEntryOrder: string[] } {
  const formData = new FormData();
  formData.append('batchIndex', String(batchIndex));
  formData.append('totalBatches', String(totalBatches));
  formData.append('finalize', finalize ? 'true' : 'false');
  formData.append('totalArtworkCount', String(totalArtworkCount));

  if (sessionFirstCoaId) {
    formData.append('sessionFirstCoaId', sessionFirstCoaId);
  }
  if (sessionFirstCosId) {
    formData.append('sessionFirstCosId', sessionFirstCosId);
  }

  const byEntry = new Map<string, File[]>();
  for (const item of chunkItems) {
    const existing = byEntry.get(item.entryId) ?? [];
    existing.push(item.file);
    byEntry.set(item.entryId, existing);
  }

  const chunkEntryOrder: string[] = [];
  let localIndex = 0;
  for (const entry of entries) {
    const images = byEntry.get(entry.id);
    if (!images?.length) continue;

    chunkEntryOrder.push(entry.id);
    const prefix = `artwork_${localIndex}_`;
    const existingCoaId = coaIdsByEntryId[entry.id];

    if (existingCoaId) {
      formData.append(`${prefix}existingCoaId`, existingCoaId);
    } else {
      appendArtworkTextFields(formData, localIndex, entry);
    }

    for (const file of images) {
      formData.append(`images_${localIndex}`, file);
    }

    localIndex++;
  }

  formData.append('count', String(localIndex));
  return { formData, chunkEntryOrder };
}

/** An untouched "new artwork" card, ignored when existing works are chosen. */
function isBlankEntry(entry: ArtworkEntry): boolean {
  return !entry.title.trim() && entry.images.length === 0 && !entry.description.trim();
}

function isSizeLimitError(message: string): boolean {
  return /body.*limit|413|payload too large|request entity too large|too large|exceeded/i.test(
    message,
  );
}

type ArtworkEntryCardProps = {
  entry: ArtworkEntry;
  index: number;
  canRemove: boolean;
  onUpdate: (id: string, patch: Partial<ArtworkEntry>) => void;
  onRemove: (id: string) => void;
  onAddImages: (id: string, files: File[]) => Promise<void>;
  onRemoveImage: (id: string, imageIndex: number) => void;
  preparingImages: boolean;
};

function ArtworkEntryCard({
  entry,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onAddImages,
  onRemoveImage,
  preparingImages,
}: ArtworkEntryCardProps) {
  const previewUrls = useMemo(
    () => entry.images.map((file) => URL.createObjectURL(file)),
    [entry.images],
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  return (
    <div className="rounded-lg border border-wine/15 bg-parchment/30 p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-wine">Artwork {index + 1}</p>
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-ink/60 hover:text-wine"
            onClick={() => onRemove(entry.id)}
          >
            Remove
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`title-${entry.id}`}>Artwork title *</Label>
        <Input
          id={`title-${entry.id}`}
          value={entry.title}
          onChange={(e) => onUpdate(entry.id, { title: e.target.value })}
          placeholder="Untitled"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`images-${entry.id}`}>Artwork photos *</Label>
        <Input
          id={`images-${entry.id}`}
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          disabled={preparingImages}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) {
              void onAddImages(entry.id, files);
            }
            e.target.value = '';
          }}
        />
        <p className="text-ink/50 text-xs">
          Add one or more photos. The first photo is the primary image on the certificate.
          {preparingImages ? ' Preparing photos…' : ''}
        </p>
        {previewUrls.length > 0 && (
          <div className="flex flex-wrap gap-3 pt-1">
            {previewUrls.map((url, imageIndex) => (
              <div key={`${entry.id}-${imageIndex}`} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Preview ${imageIndex + 1}`}
                  className="h-20 w-20 rounded-md border border-wine/10 object-cover"
                />
                {imageIndex === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-wine px-1.5 py-0.5 text-[10px] text-parchment">
                    Primary
                  </span>
                )}
                <button
                  type="button"
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-wine text-xs text-parchment"
                  aria-label="Remove photo"
                  onClick={() => onRemoveImage(entry.id, imageIndex)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor={`medium-${entry.id}`}>Medium</Label>
        <Input
          id={`medium-${entry.id}`}
          value={entry.medium}
          onChange={(e) => onUpdate(entry.id, { medium: e.target.value })}
          placeholder="Oil on canvas"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor={`creationDate-${entry.id}`}>Creation date</Label>
          <Input
            id={`creationDate-${entry.id}`}
            type="date"
            value={entry.creationDate}
            onChange={(e) => onUpdate(entry.id, { creationDate: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`dimensions-${entry.id}`}>Dimensions</Label>
          <Input
            id={`dimensions-${entry.id}`}
            value={entry.dimensions}
            onChange={(e) => onUpdate(entry.id, { dimensions: e.target.value })}
            placeholder='24" × 36"'
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`description-${entry.id}`}>Description</Label>
        <Textarea
          id={`description-${entry.id}`}
          value={entry.description}
          onChange={(e) => onUpdate(entry.id, { description: e.target.value })}
          rows={3}
          placeholder="Optional notes about the work"
        />
      </div>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="text-wine hover:text-wine/80 px-0"
        onClick={() => onUpdate(entry.id, { showMore: !entry.showMore })}
      >
        {entry.showMore ? 'Hide extra details' : 'Add more details'}
      </Button>

      {entry.showMore && (
        <div className="space-y-4 border-t border-wine/10 pt-4">
          <div className="space-y-2">
            <Label htmlFor={`formerOwners-${entry.id}`}>Former owners</Label>
            <Textarea
              id={`formerOwners-${entry.id}`}
              value={entry.formerOwners}
              onChange={(e) => onUpdate(entry.id, { formerOwners: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`auctionHistory-${entry.id}`}>Auction history</Label>
            <Textarea
              id={`auctionHistory-${entry.id}`}
              value={entry.auctionHistory}
              onChange={(e) => onUpdate(entry.id, { auctionHistory: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`exhibitionHistory-${entry.id}`}>
              Exhibition history / literature
            </Label>
            <Textarea
              id={`exhibitionHistory-${entry.id}`}
              value={entry.exhibitionHistory}
              onChange={(e) =>
                onUpdate(entry.id, { exhibitionHistory: e.target.value })
              }
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`historicContext-${entry.id}`}>Historic context</Label>
            <Textarea
              id={`historicContext-${entry.id}`}
              value={entry.historicContext}
              onChange={(e) => onUpdate(entry.id, { historicContext: e.target.value })}
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`celebrityNotes-${entry.id}`}>
              Celebrity / notable ownership
            </Label>
            <Textarea
              id={`celebrityNotes-${entry.id}`}
              value={entry.celebrityNotes}
              onChange={(e) => onUpdate(entry.id, { celebrityNotes: e.target.value })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`value-${entry.id}`}>Value</Label>
              <Input
                id={`value-${entry.id}`}
                value={entry.value}
                onChange={(e) => onUpdate(entry.id, { value: e.target.value })}
              />
              <div className="flex items-center justify-between gap-3 pt-1">
                <Label
                  htmlFor={`value-public-${entry.id}`}
                  className="text-xs font-normal text-ink/60"
                >
                  Show value on the exhibition page
                </Label>
                <Switch
                  id={`value-public-${entry.id}`}
                  checked={entry.valueIsPublic}
                  onCheckedChange={(checked) =>
                    onUpdate(entry.id, { valueIsPublic: checked })
                  }
                />
              </div>
              {!entry.valueIsPublic && entry.value.trim() && (
                <p className="text-xs text-ink/50">
                  Private: only the gallery sees this value.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`edition-${entry.id}`}>Edition</Label>
              <Input
                id={`edition-${entry.id}`}
                value={entry.edition}
                onChange={(e) => onUpdate(entry.id, { edition: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`productionLocation-${entry.id}`}>Production location</Label>
            <Input
              id={`productionLocation-${entry.id}`}
              value={entry.productionLocation}
              onChange={(e) =>
                onUpdate(entry.id, { productionLocation: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor={`ownedBy-${entry.id}`}>Owned by</Label>
              <Input
                id={`ownedBy-${entry.id}`}
                value={entry.ownedBy}
                onChange={(e) => onUpdate(entry.id, { ownedBy: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`soldBy-${entry.id}`}>Sold by</Label>
              <Input
                id={`soldBy-${entry.id}`}
                value={entry.soldBy}
                onChange={(e) => onUpdate(entry.id, { soldBy: e.target.value })}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function SubmitExhibitionClient({
  inviteContext,
  contextError,
}: SubmitExhibitionClientProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const supabase = useSupabase();
  const token = searchParams.get('token')?.trim() ?? '';

  const [authState, setAuthState] = useState<
    'loading' | 'needs_sign_in' | 'ready' | 'done' | 'error'
  >('loading');
  const [error, setError] = useState<string | null>(contextError);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [preparingImages, setPreparingImages] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    batch: number;
    totalBatches: number;
  } | null>(null);
  const [entries, setEntries] = useState<ArtworkEntry[]>([emptyEntry()]);
  const [submittedCount, setSubmittedCount] = useState(1);
  const [existingOptions, setExistingOptions] = useState<ExistingArtworkOption[]>([]);
  const [selectedExistingIds, setSelectedExistingIds] = useState<string[]>([]);
  // Set once the chosen existing works are linked, so a retry only re-sends uploads.
  const [existingSubmitted, setExistingSubmitted] = useState(false);

  useEffect(() => {
    if (authState !== 'ready' || !token) return;
    let cancelled = false;
    void getExistingArtworksForSubmission(token).then((result) => {
      if (cancelled) return;
      if ('artworks' in result) setExistingOptions(result.artworks);
      else console.error('[Exhibitions] load existing artworks failed', result.error);
    });
    return () => {
      cancelled = true;
    };
  }, [authState, token]);

  useEffect(() => {
    let cancelled = false;

    async function checkAuth() {
      if (!token || contextError) {
        setAuthState('error');
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (!session) {
        setAuthState('needs_sign_in');
        return;
      }

      if (
        inviteContext &&
        session.user.email &&
        session.user.email.toLowerCase() !== inviteContext.inviteeEmail.toLowerCase()
      ) {
        setError(
          `Sign in with the email this invite was sent to (${inviteContext.inviteeEmail}).`,
        );
        setAuthState('error');
        return;
      }

      setAuthState('ready');
    }

    void checkAuth();

    return () => {
      cancelled = true;
    };
  }, [token, supabase, inviteContext, contextError]);

  const nextPath = `/exhibitions/submit?token=${encodeURIComponent(token)}`;
  const signInHref = `${pathsConfig.auth.signIn}?next=${encodeURIComponent(nextPath)}`;

  const updateEntry = (id: string, patch: Partial<ArtworkEntry>) => {
    setEntries((prev) =>
      prev.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  };

  const maxArtworks = inviteContext?.maxArtworks ?? null;
  const newEntries =
    selectedExistingIds.length > 0 ? entries.filter((e) => !isBlankEntry(e)) : entries;
  const totalSelected = selectedExistingIds.length + newEntries.length;
  const slotsUsed = selectedExistingIds.length + entries.length;
  const atLimit = maxArtworks !== null && slotsUsed >= maxArtworks;
  const existingAtLimit =
    maxArtworks !== null && selectedExistingIds.length + newEntries.length >= maxArtworks;

  const addEntry = () => {
    if (atLimit) return;
    setEntries((prev) => [...prev, emptyEntry()]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) =>
      prev.length <= 1 && selectedExistingIds.length === 0
        ? prev
        : prev.filter((entry) => entry.id !== id),
    );
  };

  const toggleExisting = (id: string) => {
    setSelectedExistingIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (existingAtLimit) {
        toast.error(`You can submit up to ${maxArtworks} artworks`);
        return prev;
      }
      return [...prev, id];
    });
  };

  const addImages = async (id: string, rawFiles: File[]) => {
    const imageFiles = rawFiles.filter(isLikelyImageFile);
    if (imageFiles.length === 0) {
      toast.error('Please choose image files');
      return;
    }

    setPreparingImages(true);
    try {
      const prepared: File[] = [];
      for (const raw of imageFiles) {
        const file = await prepareImageForUpload(raw);
        if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
          toast.error(`"${file.name}" is too large. Please choose images under 4 MB.`);
          return;
        }
        prepared.push(file);
      }

      setEntries((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? { ...entry, images: [...entry.images, ...prepared] }
            : entry,
        ),
      );
    } catch (err) {
      console.error('[Exhibitions] prepareImageForUpload failed', err);
      toast.error('Failed to prepare images. Please try again.');
    } finally {
      setPreparingImages(false);
    }
  };

  const removeImage = (id: string, imageIndex: number) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              images: entry.images.filter((_, idx) => idx !== imageIndex),
            }
          : entry,
      ),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    const entries = newEntries;
    const pendingExisting = existingSubmitted ? [] : selectedExistingIds;
    const totalCount = selectedExistingIds.length + entries.length;

    if (totalCount === 0) {
      toast.error('Add an artwork or choose one from your account');
      return;
    }
    if (maxArtworks !== null && totalCount > maxArtworks) {
      toast.error(`You can submit up to ${maxArtworks} artworks`);
      return;
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      if (!entry.title.trim()) {
        toast.error(`Title is required for artwork ${i + 1}`);
        return;
      }
      if (entry.images.length === 0) {
        toast.error(`Add at least one photo for artwork ${i + 1}`);
        return;
      }
    }

    const finishSubmission = (count: number, firstArtworkId: string) => {
      setSubmittedCount(count);
      setUploadProgress(null);
      setAuthState('done');
      toast.success(
        count === 1 ? 'Artwork submitted successfully' : `${count} artworks submitted successfully`,
      );
      setTimeout(() => {
        if (inviteContext?.statusPath) {
          router.replace(`${inviteContext.statusPath}?submitted=1`);
        } else if (count === 1 && firstArtworkId) {
          router.replace(`/artworks/${firstArtworkId}/certificate`);
        } else {
          router.replace('/artworks/my');
        }
      }, 1500);
    };

    startTransition(async () => {
      let sessionFirstCoaId = '';
      let sessionFirstCosId = '';

      if (pendingExisting.length > 0) {
        try {
          const existingResult = await submitExistingArtworksToExhibition(token, pendingExisting, {
            finalize: entries.length === 0,
            totalArtworkCount: totalCount,
          });
          if (!existingResult.success) {
            setSubmitError(existingResult.error);
            toast.error(existingResult.error);
            return;
          }
          setExistingSubmitted(true);
          sessionFirstCoaId = existingResult.firstCoaId;
          sessionFirstCosId = existingResult.firstCosId;
          if (entries.length === 0) {
            finishSubmission(totalCount, existingResult.firstCoaId);
            return;
          }
        } catch (err) {
          console.error('[Exhibitions] submitExistingArtworks client error', err);
          setSubmitError('Something went wrong. Please try again.');
          toast.error('Something went wrong. Please try again.');
          return;
        }
      }

      const flatImages: FlatImageItem[] = [];
      for (const entry of entries) {
        for (const file of entry.images) {
          flatImages.push({ entryId: entry.id, file });
        }
      }

      let imageChunks: FlatImageItem[][];
      try {
        imageChunks = buildImageChunks(flatImages);
      } catch (chunkErr) {
        const message =
          chunkErr instanceof Error ? chunkErr.message : 'Failed to prepare upload';
        setSubmitError(message);
        toast.error(message);
        return;
      }

      if (imageChunks.length === 0) {
        toast.error('Add at least one photo');
        return;
      }

      const coaIdsByEntryId: Record<string, string> = {};
      let artworksUploaded = 0;

      setUploadProgress({ batch: 0, totalBatches: imageChunks.length });

      try {
        for (let batchIndex = 0; batchIndex < imageChunks.length; batchIndex++) {
          setUploadProgress({ batch: batchIndex + 1, totalBatches: imageChunks.length });

          const finalize = batchIndex === imageChunks.length - 1;
          const { formData, chunkEntryOrder } = buildChunkFormData(
            entries,
            imageChunks[batchIndex],
            batchIndex,
            imageChunks.length,
            finalize,
            coaIdsByEntryId,
            sessionFirstCoaId,
            sessionFirstCosId,
            totalCount,
          );

          const result = await submitExhibitionArtwork(token, formData);

          if (!result.success) {
            const partialMessage =
              artworksUploaded > 0
                ? `${result.error} (${artworksUploaded} of ${entries.length} artworks uploaded — try again to finish)`
                : result.error;
            setSubmitError(partialMessage);
            toast.error(partialMessage);
            setUploadProgress(null);
            return;
          }

          chunkEntryOrder.forEach((entryId, idx) => {
            const coaId = result.coaIds[idx];
            if (coaId && !coaIdsByEntryId[entryId]) {
              coaIdsByEntryId[entryId] = coaId;
            }
          });

          if (!sessionFirstCoaId && result.artworkId) {
            sessionFirstCoaId = result.artworkId;
          }
          if (!sessionFirstCosId && result.cosArtworkId) {
            sessionFirstCosId = result.cosArtworkId;
          }

          artworksUploaded = Object.keys(coaIdsByEntryId).length;

          if (result.finalized) {
            finishSubmission(result.count, result.artworkId);
            return;
          }
        }
      } catch (err) {
        setUploadProgress(null);
        const message = err instanceof Error ? err.message : String(err);
        const partialMessage =
          artworksUploaded > 0
            ? `${
                isSizeLimitError(message)
                  ? 'Photo(s) are too large to upload in a single batch. Try fewer photos or smaller images (under 4 MB each).'
                  : 'Something went wrong. Please try again.'
              } (${artworksUploaded} of ${entries.length} artworks uploaded — try again to finish)`
            : isSizeLimitError(message)
              ? 'Photo(s) are too large to upload in a single batch. Try fewer photos or smaller images (under 4 MB each).'
              : 'Something went wrong. Please try again.';

        console.error('[Exhibitions] submitExhibitionArtwork client error', err);
        setSubmitError(partialMessage);
        toast.error(partialMessage);
      }
    });
  };

  const submitLabel = uploadProgress
    ? `Uploading batch ${uploadProgress.batch} of ${uploadProgress.totalBatches}…`
    : pending
      ? 'Submitting…'
      : totalSelected === 1
        ? 'Submit artwork'
        : `Submit ${totalSelected} artworks`;

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Invalid link
        </Heading>
        <p className="text-ink/80 mb-6">Open the link from your invitation email.</p>
        <Button asChild variant="outline">
          <Link href={pathsConfig.app.home}>Home</Link>
        </Button>
      </div>
    );
  }

  if (authState === 'loading') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <p className="text-ink/80">Loading invitation…</p>
      </div>
    );
  }

  if (authState === 'needs_sign_in' && inviteContext) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Submit artwork
        </Heading>
        <p className="text-ink/80 mb-2">
          You&apos;ve been invited to submit work for{' '}
          <strong>{inviteContext.exhibitionTitle}</strong>
          {inviteContext.galleryName ? ` at ${inviteContext.galleryName}` : ''}.
        </p>
        <p className="text-ink/50 text-sm mb-6">
          Sign in with <strong>{inviteContext.inviteeEmail}</strong> to continue.
        </p>
        <Button asChild className="bg-wine text-parchment hover:bg-wine/90 font-serif">
          <Link href={signInHref}>Continue to sign in</Link>
        </Button>
      </div>
    );
  }

  if (authState === 'done') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          {submittedCount === 1 ? 'Artwork submitted' : 'Artworks submitted'}
        </Heading>
        <p className="text-ink/80 mb-6">
          {submittedCount === 1
            ? 'Your Certificate of Authenticity has been created. Redirecting…'
            : `Your ${submittedCount} Certificates of Authenticity have been created. Redirecting…`}
        </p>
      </div>
    );
  }

  if (authState === 'error' && error) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center font-serif">
        <Heading level={4} className="text-wine mb-2">
          Could not continue
        </Heading>
        <p className="text-ink/80 mb-6">{error}</p>
        <div className="flex flex-col gap-3 items-center">
          <Button asChild variant="outline">
            <Link href={signInHref}>Sign in with the invited email</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={pathsConfig.app.home}>Home</Link>
          </Button>
        </div>
      </div>
    );
  }

  if (!inviteContext) {
    return null;
  }

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <div className="mb-8 text-center font-serif">
        <p className="text-[11px] uppercase tracking-widest text-wine/50 mb-2">
          Exhibition submission
        </p>
        <Heading level={3} className="text-wine mb-2">
          {inviteContext.exhibitionTitle}
        </Heading>
        {inviteContext.galleryName && (
          <p className="text-ink/60 text-sm">{inviteContext.galleryName}</p>
        )}
        <p className="text-ink/55 text-sm mt-4 max-w-md mx-auto">
          Upload your artworks to receive Certificates of Authenticity.
          {' '}The organiser reviews submissions and selects the works for the exhibition
          {inviteContext.issuesCertificateOfShow
            ? '; selected works receive a linked Certificate of Show.'
            : '.'}
        </p>
        {inviteContext.maxArtworks && (
          <p className="text-ink/70 text-sm mt-3">
            You can submit up to{' '}
            <span className="font-semibold text-wine">
              {inviteContext.maxArtworks} {inviteContext.maxArtworks === 1 ? 'artwork' : 'artworks'}
            </span>{' '}
            for consideration.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 font-serif">
        {submitError && (
          <p className="rounded-md border border-wine/20 bg-wine/5 px-4 py-3 text-sm text-wine">
            {submitError}
          </p>
        )}

        {existingOptions.length > 0 && (
          <section className="rounded-lg border border-wine/15 bg-parchment/40 p-4">
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <h2 className="text-base font-semibold text-ink">From your Provenance account</h2>
              {selectedExistingIds.length > 0 && (
                <span className="text-xs text-wine">{selectedExistingIds.length} selected</span>
              )}
            </div>
            <p className="text-xs text-ink/55 mb-3">
              Choose works already on your account — no need to upload them again.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
              {existingOptions.map((artwork) => {
                const selected = selectedExistingIds.includes(artwork.id);
                return (
                  <button
                    key={artwork.id}
                    type="button"
                    onClick={() => toggleExisting(artwork.id)}
                    disabled={pending || existingSubmitted}
                    aria-pressed={selected}
                    className={`group relative text-left rounded-md overflow-hidden border-2 transition-colors ${
                      selected ? 'border-wine' : 'border-transparent hover:border-wine/30'
                    }`}
                  >
                    <div className="aspect-square bg-ink/5">
                      {artwork.imageUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artwork.imageUrl}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <p className="px-1.5 py-1 text-[11px] leading-tight text-ink truncate">
                      {artwork.title}
                    </p>
                    {selected && (
                      <span className="absolute top-1 right-1 rounded-full bg-wine text-parchment text-[10px] px-1.5 py-0.5">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {existingOptions.length > 0 && (
          <p className="text-[11px] uppercase tracking-widest text-wine/50 text-center">
            {selectedExistingIds.length > 0 ? 'And / or upload new work' : 'Or upload new work'}
          </p>
        )}

        {entries.map((entry, index) => (
          <ArtworkEntryCard
            key={entry.id}
            entry={entry}
            index={index}
            canRemove={entries.length > 1 || selectedExistingIds.length > 0}
            onUpdate={updateEntry}
            onRemove={removeEntry}
            onAddImages={addImages}
            onRemoveImage={removeImage}
            preparingImages={preparingImages}
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full border-wine/20 text-wine hover:bg-wine/5"
          onClick={addEntry}
          disabled={pending || preparingImages || atLimit}
        >
          {atLimit
            ? `Limit reached (${maxArtworks} ${maxArtworks === 1 ? 'artwork' : 'artworks'})`
            : maxArtworks !== null
              ? `Add another artwork (${slotsUsed} of ${maxArtworks})`
              : 'Add another artwork'}
        </Button>

        <Button
          type="submit"
          disabled={pending || preparingImages || totalSelected === 0}
          className="w-full bg-wine text-parchment hover:bg-wine/90"
        >
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}

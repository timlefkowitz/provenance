'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
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
import { submitExhibitionArtwork } from '../_actions/submit-exhibition-artwork';

const MAX_BATCH_BYTES = 4 * 1024 * 1024;

type InviteContext = {
  exhibitionTitle: string;
  galleryName: string | null;
  inviteeEmail: string;
  inviteeName: string | null;
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
): { formData: FormData; chunkEntryOrder: string[] } {
  const formData = new FormData();
  formData.append('batchIndex', String(batchIndex));
  formData.append('totalBatches', String(totalBatches));
  formData.append('finalize', finalize ? 'true' : 'false');
  formData.append('totalArtworkCount', String(entries.length));

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

  const addEntry = () => {
    setEntries((prev) => [...prev, emptyEntry()]);
  };

  const removeEntry = (id: string) => {
    setEntries((prev) =>
      prev.length <= 1 ? prev : prev.filter((entry) => entry.id !== id),
    );
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

    startTransition(async () => {
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
      let sessionFirstCoaId = '';
      let sessionFirstCosId = '';
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
            setSubmittedCount(result.count);
            setUploadProgress(null);
            setAuthState('done');
            toast.success(
              result.count === 1
                ? 'Artwork submitted successfully'
                : `${result.count} artworks submitted successfully`,
            );
            setTimeout(() => {
              if (result.count === 1) {
                router.replace(`/artworks/${result.artworkId}/certificate`);
              } else {
                router.replace('/artworks/my');
              }
            }, 1500);
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
    : entries.length === 1
      ? pending
        ? 'Submitting…'
        : 'Submit artwork & create COA'
      : pending
        ? 'Submitting…'
        : `Submit ${entries.length} artworks & create COAs`;

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
          Upload your artworks to receive Certificates of Authenticity. The
          gallery will automatically receive linked Certificates of Show.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 font-serif">
        {submitError && (
          <p className="rounded-md border border-wine/20 bg-wine/5 px-4 py-3 text-sm text-wine">
            {submitError}
          </p>
        )}

        {entries.map((entry, index) => (
          <ArtworkEntryCard
            key={entry.id}
            entry={entry}
            index={index}
            canRemove={entries.length > 1}
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
          disabled={pending || preparingImages}
        >
          Add another artwork
        </Button>

        <Button
          type="submit"
          disabled={pending || preparingImages}
          className="w-full bg-wine text-parchment hover:bg-wine/90"
        >
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}

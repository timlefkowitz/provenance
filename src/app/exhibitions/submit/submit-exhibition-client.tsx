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
import { submitExhibitionArtwork } from '../_actions/submit-exhibition-artwork';

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

function appendArtworkFields(formData: FormData, index: number, entry: ArtworkEntry) {
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

  for (const file of entry.images) {
    formData.append(`images_${index}`, file);
  }
}

type ArtworkEntryCardProps = {
  entry: ArtworkEntry;
  index: number;
  canRemove: boolean;
  onUpdate: (id: string, patch: Partial<ArtworkEntry>) => void;
  onRemove: (id: string) => void;
  onAddImages: (id: string, files: File[]) => void;
  onRemoveImage: (id: string, imageIndex: number) => void;
};

function ArtworkEntryCard({
  entry,
  index,
  canRemove,
  onUpdate,
  onRemove,
  onAddImages,
  onRemoveImage,
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
        <p className="text-sm font-medium text-wine">
          Artwork {index + 1}
        </p>
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
          accept="image/*"
          multiple
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) {
              onAddImages(entry.id, files);
            }
            e.target.value = '';
          }}
        />
        <p className="text-ink/50 text-xs">
          Add one or more photos. The first photo is the primary image on the certificate.
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
            onChange={(e) =>
              onUpdate(entry.id, { creationDate: e.target.value })
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`dimensions-${entry.id}`}>Dimensions</Label>
          <Input
            id={`dimensions-${entry.id}`}
            value={entry.dimensions}
            onChange={(e) =>
              onUpdate(entry.id, { dimensions: e.target.value })
            }
            placeholder='24" × 36"'
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`description-${entry.id}`}>Description</Label>
        <Textarea
          id={`description-${entry.id}`}
          value={entry.description}
          onChange={(e) =>
            onUpdate(entry.id, { description: e.target.value })
          }
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
              onChange={(e) =>
                onUpdate(entry.id, { formerOwners: e.target.value })
              }
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`auctionHistory-${entry.id}`}>Auction history</Label>
            <Textarea
              id={`auctionHistory-${entry.id}`}
              value={entry.auctionHistory}
              onChange={(e) =>
                onUpdate(entry.id, { auctionHistory: e.target.value })
              }
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
              onChange={(e) =>
                onUpdate(entry.id, { historicContext: e.target.value })
              }
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
              onChange={(e) =>
                onUpdate(entry.id, { celebrityNotes: e.target.value })
              }
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
            <Label htmlFor={`productionLocation-${entry.id}`}>
              Production location
            </Label>
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
  const [pending, startTransition] = useTransition();
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

  const addImages = (id: string, files: File[]) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? { ...entry, images: [...entry.images, ...files] }
          : entry,
      ),
    );
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
      const formData = new FormData();
      formData.append('count', String(entries.length));

      entries.forEach((entry, index) => {
        appendArtworkFields(formData, index, entry);
      });

      const result = await submitExhibitionArtwork(token, formData);

      if (result.success) {
        setSubmittedCount(result.count);
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

      setError(result.error);
      setAuthState('error');
      toast.error(result.error);
    });
  };

  const submitLabel =
    entries.length === 1
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
          />
        ))}

        <Button
          type="button"
          variant="outline"
          className="w-full border-wine/20 text-wine hover:bg-wine/5"
          onClick={addEntry}
        >
          Add another artwork
        </Button>

        <Button
          type="submit"
          disabled={pending}
          className="w-full bg-wine text-parchment hover:bg-wine/90"
        >
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}

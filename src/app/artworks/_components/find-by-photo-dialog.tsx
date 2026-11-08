'use client';

import { type ReactNode, useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Image as ImageIcon, Loader2, ScanSearch, Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Dialog, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@kit/ui/dialog';
import { cn } from '@kit/ui/utils';

import { EditorialDialogContent } from '~/components/editorial-dialog';
import { isLikelyImageFile, prepareImageForUpload } from '~/lib/client-image-upload';
import type { MatchConfidence } from '~/lib/image-fingerprint/similarity';

import { findArtworksByPhoto, type PhotoMatch } from '../_actions/find-artworks-by-photo';
import { AddToListButton } from './add-to-list-button';

const CONFIDENCE_LABEL: Record<MatchConfidence, string> = {
  strong: 'Strong match',
  likely: 'Possible match',
  weak: 'Weak match',
};

const CONFIDENCE_CLASS: Record<MatchConfidence, string> = {
  strong: 'bg-emerald-700/10 text-emerald-800 border-emerald-700/25',
  likely: 'bg-amber-600/10 text-amber-800 border-amber-600/25',
  weak: 'bg-ink/5 text-ink/50 border-ink/15',
};

/**
 * "Find by photo": snap or upload a photo of a physical piece and jump to its certificate.
 * Pass `exhibitionId` to search only that exhibition's works (e.g. a series of lookalike
 * pieces listed separately); omit it to search every artwork the viewer can see.
 */
export function FindByPhotoDialog({
  exhibitionId,
  trigger,
  description,
  onClose,
}: {
  exhibitionId?: string;
  trigger?: ReactNode;
  description?: string;
  /** Called when the dialog closes (e.g. to refresh a list the user added works to). */
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<PhotoMatch[] | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setMatches(null);
    setError(null);
    setSearching(false);
  };

  const search = async (file: File | undefined) => {
    if (!file) return;
    if (!isLikelyImageFile(file)) {
      setError('That file doesn’t look like a photo.');
      return;
    }
    reset();
    setSearching(true);
    try {
      const prepared = await prepareImageForUpload(file);
      setPreviewUrl(URL.createObjectURL(prepared));
      const fd = new FormData();
      fd.set('image', prepared);
      if (exhibitionId) fd.set('exhibitionId', exhibitionId);
      const result = await findArtworksByPhoto(fd);
      if (result.success) setMatches(result.matches);
      else setError(result.error);
    } catch (err) {
      console.error('[PhotoLookup] search failed', err);
      setError('Search failed. Check your connection and try again.');
    } finally {
      setSearching(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    void search(file);
  };

  const top = matches?.[0];
  const rest = matches?.slice(1) ?? [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          reset();
          onClose?.();
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="font-serif gap-1.5 border-wine/25">
            <ScanSearch className="h-3.5 w-3.5" />
            Find by photo
          </Button>
        )}
      </DialogTrigger>
      <EditorialDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Find by photo</DialogTitle>
          <DialogDescription className="font-serif text-sm">
            {description ??
              (exhibitionId
                ? 'Photograph a piece from this exhibition to find its listing and certificate.'
                : 'Photograph a piece to find its certificate on Provenance.')}
          </DialogDescription>
        </DialogHeader>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={searching}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5"
          >
            <Camera className="h-4 w-4" />
            {matches ? 'Scan next' : 'Take photo'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => uploadRef.current?.click()}
            disabled={searching}
            className="font-serif gap-1.5 border-wine/25"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
        <p className="-mt-2 text-[11px] text-ink/45 font-serif">
          Fill the frame with the piece, straight on, in even light.
        </p>

        {(previewUrl || searching) && (
          <div className="flex items-center gap-3 rounded-md border border-wine/10 bg-parchment/50 p-2">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="Your photo" className="h-14 w-14 rounded object-cover" />
            ) : (
              <div className="h-14 w-14 rounded bg-wine/5" />
            )}
            <p className="text-xs font-serif text-ink/60" aria-live="polite">
              {searching ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
                </span>
              ) : matches?.length ? (
                `${matches.length} candidate${matches.length === 1 ? '' : 's'}, best first`
              ) : matches ? (
                'No matches'
              ) : (
                'Your photo'
              )}
            </p>
          </div>
        )}

        {error && <p className="text-sm font-serif text-red-700">{error}</p>}

        {matches && matches.length === 0 && (
          <p className="text-sm font-serif text-ink/60">
            Nothing similar found{exhibitionId ? ' in this exhibition' : ''}. Try again closer up, or check that the
            work has a photo on Provenance.
          </p>
        )}

        {top && (
          <div className="flex flex-col gap-2">
            <MatchRow match={top} featured />
            {top.confidence === 'weak' && (
              <p className="text-[11px] font-serif text-ink/50">
                Low confidence: compare the photos before relying on this.
              </p>
            )}
            {rest.length > 0 && (
              <>
                <p className="mt-2 text-[10px] uppercase tracking-widest text-ink/35 font-serif">Other candidates</p>
                {rest.map((m) => (
                  <MatchRow key={m.artworkId} match={m} />
                ))}
              </>
            )}
          </div>
        )}
      </EditorialDialogContent>
    </Dialog>
  );
}

function MatchRow({ match, featured = false }: { match: PhotoMatch; featured?: boolean }) {
  if (!match.isOwner) return <MatchLink match={match} featured={featured} />;
  // Owners can queue the work straight from the scan (e.g. "To print" for wall labels).
  return (
    <div className="flex flex-col gap-1.5">
      <MatchLink match={match} featured={featured} />
      <div className="flex justify-end">
        <AddToListButton artworkIds={[match.artworkId]} showQuickAdd={featured} />
      </div>
    </div>
  );
}

function MatchLink({ match, featured = false }: { match: PhotoMatch; featured?: boolean }) {
  return (
    <Link
      href={`/artworks/${match.artworkId}/certificate`}
      className={cn(
        'flex items-center gap-3 rounded-md border p-2 transition-colors hover:border-wine/40 hover:bg-wine/5',
        featured ? 'border-wine/30 bg-parchment/70' : 'border-wine/10',
      )}
    >
      {match.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.imageUrl}
          alt={match.title}
          loading="lazy"
          className={cn('shrink-0 rounded object-cover', featured ? 'h-20 w-20' : 'h-12 w-12')}
        />
      ) : (
        <div
          className={cn(
            'shrink-0 rounded bg-wine/5 flex items-center justify-center',
            featured ? 'h-20 w-20' : 'h-12 w-12',
          )}
        >
          <ImageIcon className="h-5 w-5 text-wine/25" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className={cn('truncate font-display text-ink', featured ? 'text-base' : 'text-sm')}>{match.title}</p>
        <p className="truncate text-xs font-serif text-ink/55">
          {[match.artistName, match.certificateNumber, match.status === 'draft' ? 'Draft' : null]
            .filter(Boolean)
            .join(' · ')}
        </p>
        <span
          className={cn(
            'mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-serif',
            CONFIDENCE_CLASS[match.confidence],
          )}
          title={`Cosine similarity ${match.similarity.toFixed(3)}`}
        >
          {CONFIDENCE_LABEL[match.confidence]} · {match.score}%
        </span>
      </div>
      <span className="shrink-0 text-xs font-serif text-wine">Certificate →</span>
    </Link>
  );
}

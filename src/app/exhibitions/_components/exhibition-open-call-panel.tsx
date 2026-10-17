'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Copy, ImagePlus, Megaphone } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  EditorialSectionHeader,
  FIELD_HINT,
  FIELD_INPUT,
  FIELD_LABEL,
  TAG,
} from '~/components/editorial-form';
import {
  closeExhibitionOpenCall,
  openExhibitionOpenCall,
  setExhibitionOpenCallImage,
  type ExhibitionOpenCallSummary,
} from '../_actions/exhibition-open-call';

function formatDate(iso: string): string {
  return new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ExhibitionOpenCallPanel({
  exhibitionId,
  openCall,
  defaultClosingDate,
}: {
  exhibitionId: string;
  openCall: ExhibitionOpenCallSummary | null;
  defaultClosingDate: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [imagePending, startImageTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);
  const [closingDate, setClosingDate] = useState(
    openCall?.isOpen && openCall.submissionClosingDate
      ? openCall.submissionClosingDate.slice(0, 10)
      : defaultClosingDate && defaultClosingDate >= today
        ? defaultClosingDate
        : '',
  );
  const [imageUrl, setImageUrl] = useState<string | null>(openCall?.imageUrl ?? null);

  const publicPath = openCall ? `/open-calls/${openCall.slug}` : null;

  const handleOpen = () => {
    startTransition(async () => {
      const result = await openExhibitionOpenCall(exhibitionId, { closingDate, imageUrl });
      if (result.success) {
        toast.success(openCall ? 'Open call updated' : 'Open call is live');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleClose = () => {
    startTransition(async () => {
      const result = await closeExhibitionOpenCall(exhibitionId);
      if (result.success) {
        toast.success('Open call closed');
        router.refresh();
      } else {
        toast.error(result.error || 'Could not close the open call');
      }
    });
  };

  const saveImage = (formData: FormData) => {
    startImageTransition(async () => {
      const result = await setExhibitionOpenCallImage(exhibitionId, formData);
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      setImageUrl(result.imageUrl);
      if (openCall) {
        toast.success(result.imageUrl ? 'Main image updated' : 'Main image removed');
        router.refresh();
      }
    });
  };

  const handleImagePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    saveImage(formData);
  };

  const handleImageRemove = () => {
    // Before publishing, the upload isn't attached to anything yet.
    if (!openCall) {
      setImageUrl(null);
      return;
    }
    const formData = new FormData();
    formData.append('remove', '1');
    saveImage(formData);
  };

  const handleCopy = async () => {
    if (!publicPath) return;
    try {
      await navigator.clipboard.writeText(new URL(publicPath, window.location.origin).href);
      toast.success('Link copied');
    } catch {
      toast.error('Could not copy the link');
    }
  };

  const deadlineField = (
    <div className="space-y-2">
      <Label htmlFor="openCallDeadline" className={FIELD_LABEL}>
        Submission deadline
      </Label>
      <Input
        id="openCallDeadline"
        type="date"
        min={today}
        value={closingDate}
        onChange={(e) => setClosingDate(e.target.value)}
        className={cn(FIELD_INPUT, 'w-52')}
      />
    </div>
  );

  return (
    <section className="mt-16 border-t border-editorial-border/30 pt-10">
      <EditorialSectionHeader
        eyebrow="Open call"
        title="Accept submissions from any artist"
        description="Alongside your invites, publish a public open call. Artists sign in, upload new work or pick pieces already on their account, and their submissions land in this exhibition for you to select from. The per-artist limit above applies."
      />

      <div className="border border-editorial-border/25 bg-bone">
        {/* Main image — leads the public open call page */}
        <div className="grid gap-0 sm:grid-cols-[minmax(0,15rem)_1fr]">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imagePending}
            aria-label={imageUrl ? 'Replace main image' : 'Choose a main image'}
            className={cn(
              'group relative flex aspect-[4/3] items-center justify-center overflow-hidden border-b border-editorial-border/25 bg-cream/50 transition-colors sm:border-b-0 sm:border-r',
              'hover:bg-vermillion/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-vermillion/30',
              imagePending && 'cursor-wait',
            )}
          >
            {imageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-x-0 bottom-0 bg-editorial-ink/80 py-2 text-center font-jetbrains text-[10px] uppercase tracking-[0.18em] text-bone opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                  Replace image
                </span>
              </>
            ) : (
              <span className="flex flex-col items-center gap-2 px-4 text-center">
                <span className="flex h-10 w-10 items-center justify-center bg-vermillion/10 text-vermillion transition-all duration-300 group-hover:scale-105 group-hover:bg-vermillion group-hover:text-bone">
                  <ImagePlus className="h-4 w-4" />
                </span>
                <span className="font-jetbrains text-[10px] uppercase tracking-[0.18em] text-editorial-ink/70">
                  {imagePending ? 'Uploading…' : 'Choose main image'}
                </span>
              </span>
            )}
            {imagePending && imageUrl && (
              <span className="absolute inset-0 flex items-center justify-center bg-bone/70 font-jetbrains text-[10px] uppercase tracking-[0.18em] text-editorial-ink">
                Uploading…
              </span>
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif"
            className="hidden"
            onChange={handleImagePicked}
          />

          <div className="flex flex-col justify-between gap-4 p-5">
            <div>
              <p className={FIELD_LABEL}>Main image</p>
              <p className={cn(FIELD_HINT, 'mt-2 text-sm')}>
                Leads your open call page and shows on its card in Open Calls and when the link
                is shared. A landscape image works best.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imagePending}
                className={cn(BUTTON_SECONDARY, 'h-9 px-4')}
              >
                {imageUrl ? 'Replace' : 'Upload image'}
              </Button>
              {imageUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleImageRemove}
                  disabled={imagePending}
                  className={cn(BUTTON_SECONDARY, 'h-9 border-transparent px-4 text-editorial-ink/60 hover:text-vermillion')}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="border-t border-editorial-border/25 p-5">
          {openCall?.isOpen ? (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-3">
                <span className={cn(TAG, 'border-vermillion/40 bg-vermillion/5 text-vermillion')}>
                  <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-vermillion" />
                  Open
                </span>
                {openCall.submissionClosingDate && (
                  <span className="font-serif text-sm text-editorial-ink/70">
                    Accepting submissions until {formatDate(openCall.submissionClosingDate)}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button asChild className={cn(BUTTON_SECONDARY, 'h-9 px-4')}>
                  <Link href={publicPath!} target="_blank">
                    View open call
                  </Link>
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleCopy()}
                  className={cn(BUTTON_SECONDARY, 'h-9 gap-1.5 px-4')}
                >
                  <Copy className="h-3 w-3" />
                  Copy link
                </Button>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {deadlineField}
                <Button
                  type="button"
                  disabled={pending || !closingDate}
                  onClick={handleOpen}
                  className={cn(BUTTON_SECONDARY, 'h-9 px-4')}
                >
                  Update deadline
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={handleClose}
                  className={cn(BUTTON_SECONDARY, 'h-9 border-transparent px-4 text-editorial-ink/60 hover:text-vermillion')}
                >
                  Close open call
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {openCall && (
                <p className="font-serif text-sm text-editorial-ink/60">
                  Your open call is closed. Set a new deadline to reopen it.
                </p>
              )}
              <div className="flex flex-wrap items-end gap-4">
                {deadlineField}
                <Button
                  type="button"
                  disabled={pending || imagePending || !closingDate}
                  onClick={handleOpen}
                  className={cn(BUTTON_PRIMARY, 'gap-2 hover:bg-vermillion')}
                >
                  <Megaphone className="h-3.5 w-3.5" />
                  {openCall ? 'Reopen open call' : 'Publish open call'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

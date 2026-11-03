'use client';

import { useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ImagePlus, Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Dialog,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { isLikelyImageFile, prepareImageForUpload } from '~/lib/client-image-upload';
import {
  notifyArtistOfUploadedArtworks,
  uploadArtworksForArtist,
} from '../_actions/upload-artworks-for-artist';

type Row = {
  key: string;
  title: string;
  medium: string;
  year: string;
  dimensions: string;
  file: File | null;
  previewUrl: string | null;
};

function emptyRow(): Row {
  return {
    key: crypto.randomUUID(),
    title: '',
    medium: '',
    year: '',
    dimensions: '',
    file: null,
    previewUrl: null,
  };
}

type UploadForArtistDialogProps = {
  exhibitionId: string;
  /** Upload under this invite; the artist comes from the invite. */
  inviteId?: string;
  /** Shown in the title when the artist is already known. */
  artistLabel?: string;
  trigger: ReactNode;
};

/**
 * Registrar flow: add works for an artist. Each becomes a Certificate of Show
 * credited to the artist and joins the exhibition; artists on the platform
 * get one notification at the end.
 */
export function UploadForArtistDialog({
  exhibitionId,
  inviteId,
  artistLabel,
  trigger,
}: UploadForArtistDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>(() => [emptyRow()]);
  const [artistName, setArtistName] = useState('');
  const [artistEmail, setArtistEmail] = useState('');
  const [progress, setProgress] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const reset = () => {
    rows.forEach((r) => r.previewUrl && URL.revokeObjectURL(r.previewUrl));
    setRows([emptyRow()]);
    setArtistName('');
    setArtistEmail('');
    setProgress(null);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    let next = patch;
    if ('file' in patch) {
      const old = rows.find((r) => r.key === key)?.previewUrl;
      if (old) URL.revokeObjectURL(old);
      next = { ...patch, previewUrl: patch.file ? URL.createObjectURL(patch.file) : null };
    }
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...next } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => {
      if (prev.length <= 1) return prev;
      const row = prev.find((r) => r.key === key);
      if (row?.previewUrl) URL.revokeObjectURL(row.previewUrl);
      return prev.filter((r) => r.key !== key);
    });
  };

  const handleSubmit = () => {
    const toUpload = rows.filter((r) => r.title.trim());
    if (toUpload.length === 0) {
      toast.error('Add at least one artwork with a title.');
      return;
    }
    if (!inviteId && !artistName.trim() && !artistEmail.trim()) {
      toast.error("Enter the artist's name or email.");
      return;
    }

    startTransition(async () => {
      const createdIds: string[] = [];
      const uploadedKeys = new Set<string>();
      let artistOnPlatform = false;
      let failure: string | null = null;

      // One work per request keeps each call under the host's body-size limit.
      for (const [index, row] of toUpload.entries()) {
        setProgress(`Uploading ${index + 1} of ${toUpload.length}…`);
        const fd = new FormData();
        fd.append('exhibitionId', exhibitionId);
        if (inviteId) fd.append('inviteId', inviteId);
        fd.append('artistName', artistName.trim());
        fd.append('artistEmail', artistEmail.trim());
        fd.append(
          'items',
          JSON.stringify([
            {
              key: row.key,
              title: row.title,
              medium: row.medium,
              year: row.year,
              dimensions: row.dimensions,
            },
          ]),
        );
        try {
          if (row.file) fd.append(`image_${row.key}`, await prepareImageForUpload(row.file));
          const result = await uploadArtworksForArtist(fd);
          createdIds.push(...result.artworkIds);
          if (!result.success) {
            failure = result.error;
            break;
          }
          artistOnPlatform = result.artistOnPlatform;
          uploadedKeys.add(row.key);
        } catch (err) {
          console.error('[UploadForArtistDialog] upload failed', err);
          failure = err instanceof Error ? err.message : 'Upload failed';
          break;
        }
      }

      let notified = false;
      if (createdIds.length > 0) {
        setProgress('Notifying the artist…');
        ({ notified } = await notifyArtistOfUploadedArtworks(exhibitionId, createdIds));
      }
      setProgress(null);

      if (createdIds.length > 0) {
        const works = `${createdIds.length} ${createdIds.length === 1 ? 'work' : 'works'}`;
        toast.success(
          notified
            ? `${works} added with Certificates of Show. The artist was notified.`
            : artistOnPlatform
              ? `${works} added with Certificates of Show.`
              : `${works} added. The artist isn't on Provenance yet; the works link to them when they claim their profile.`,
        );
        router.refresh();
      }

      if (failure) {
        toast.error(failure);
        // Keep only the rows that still need uploading.
        setRows((prev) => {
          const left = prev.filter((r) => !uploadedKeys.has(r.key));
          return left.length > 0 ? left : [emptyRow()];
        });
        return;
      }

      setOpen(false);
      reset();
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <EditorialDialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">
            {artistLabel ? `Upload works for ${artistLabel}` : 'Upload works for an artist'}
          </DialogTitle>
          <DialogDescription className="font-serif text-sm">
            Each work gets a Certificate of Show credited to the artist and joins this
            exhibition. If the artist is on Provenance they&apos;re linked and notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {!inviteId && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="ufa-artist-name" className="text-xs font-serif">
                  Artist name
                </Label>
                <Input
                  id="ufa-artist-name"
                  value={artistName}
                  onChange={(e) => setArtistName(e.target.value)}
                  placeholder="As it should appear on the certificate"
                  className="font-serif"
                  disabled={pending}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ufa-artist-email" className="text-xs font-serif">
                  Artist email <span className="text-ink/40">(finds them on Provenance)</span>
                </Label>
                <Input
                  id="ufa-artist-email"
                  type="email"
                  value={artistEmail}
                  onChange={(e) => setArtistEmail(e.target.value)}
                  placeholder="artist@example.com"
                  className="font-serif"
                  disabled={pending}
                />
              </div>
            </div>
          )}

          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {rows.map((row, index) => (
              <div
                key={row.key}
                className="relative rounded-lg border border-wine/12 bg-parchment/40 p-3"
              >
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(row.key)}
                    disabled={pending}
                    className="absolute top-2 right-2 p-1 rounded text-ink/25 hover:text-red-600 hover:bg-red-50"
                    aria-label={`Remove work ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <p className="text-[10px] uppercase tracking-wider text-ink/35 font-serif font-semibold mb-2">
                  Work {index + 1}
                </p>
                <div className="flex gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    ref={(el) => {
                      fileInputs.current[row.key] = el;
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file && isLikelyImageFile(file)) updateRow(row.key, { file });
                      e.target.value = '';
                    }}
                  />
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => fileInputs.current[row.key]?.click()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const file = e.dataTransfer.files?.[0];
                      if (file && isLikelyImageFile(file)) updateRow(row.key, { file });
                    }}
                    className="h-24 w-24 shrink-0 overflow-hidden rounded-md border border-dashed border-wine/25 bg-parchment/60 flex flex-col items-center justify-center gap-1 text-ink/45 hover:border-wine/50"
                    aria-label={row.file ? 'Change photo' : 'Add photo'}
                  >
                    {row.previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={row.previewUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <>
                        <ImagePlus className="h-4 w-4" />
                        <span className="text-[10px] font-serif">Photo</span>
                      </>
                    )}
                  </button>
                  <div className="grid flex-1 gap-2 min-w-0">
                    <Input
                      value={row.title}
                      onChange={(e) => updateRow(row.key, { title: e.target.value })}
                      placeholder="Title *"
                      aria-label={`Title for work ${index + 1}`}
                      className="font-serif h-8"
                      disabled={pending}
                    />
                    <Input
                      value={row.medium}
                      onChange={(e) => updateRow(row.key, { medium: e.target.value })}
                      placeholder="Medium"
                      aria-label={`Medium for work ${index + 1}`}
                      className="font-serif h-8"
                      disabled={pending}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        value={row.year}
                        onChange={(e) => updateRow(row.key, { year: e.target.value })}
                        placeholder="Year"
                        inputMode="numeric"
                        aria-label={`Year for work ${index + 1}`}
                        className="font-serif h-8"
                        disabled={pending}
                      />
                      <Input
                        value={row.dimensions}
                        onChange={(e) => updateRow(row.key, { dimensions: e.target.value })}
                        placeholder="Dimensions"
                        aria-label={`Dimensions for work ${index + 1}`}
                        className="font-serif h-8"
                        disabled={pending}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => setRows((prev) => [...prev, emptyRow()])}
              className="font-serif text-xs h-8 gap-1 border-wine/25"
            >
              <Plus className="h-3 w-3" />
              Another work
            </Button>
            <div className="flex items-center gap-3">
              {progress && <span className="font-serif text-xs text-ink/55">{progress}</span>}
              <Button
                type="button"
                size="sm"
                disabled={pending}
                onClick={handleSubmit}
                className="gap-1.5 rounded-none bg-editorial-ink text-bone hover:bg-vermillion font-jetbrains text-[10px] uppercase tracking-[0.16em] h-8"
              >
                {pending && <Loader2 className="h-3 w-3 animate-spin" />}
                Upload &amp; issue certificates
              </Button>
            </div>
          </div>
        </div>
      </EditorialDialogContent>
    </Dialog>
  );
}

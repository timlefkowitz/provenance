'use client';

import { useEffect, useRef, useState } from 'react';

import { RotateCw } from 'lucide-react';
import ReactCrop, {
  type PercentCrop,
  centerCrop,
  makeAspectCrop,
} from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@kit/ui/dialog';
import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  FIELD_HINT,
  FIELD_LABEL,
} from '~/components/editorial-form';

/** A local file, or the URL of an image already stored (e.g. artwork.image_url). */
export type CropSource = File | string;

const ASPECTS: Array<{ label: string; value: number | undefined }> = [
  { label: 'Free', value: undefined },
  { label: 'Square', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:2', value: 3 / 2 },
];

const FULL_CROP: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

/**
 * Crop (and rotate) a photo in the browser and hand back a new File.
 * Works for a freshly picked file or an existing image URL; remote images are
 * fetched as a blob first so the canvas isn't tainted by a cross-origin draw.
 */
export function ImageCropDialog({
  source,
  onCancel,
  onCropped,
}: {
  /** Opens the dialog when set. */
  source: CropSource | null;
  onCancel: () => void;
  onCropped: (file: File) => void | Promise<void>;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const urlRef = useRef<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Kept in percent so it stays correct if the layout resizes before Apply.
  const [crop, setCrop] = useState<PercentCrop>(FULL_CROP);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [working, setWorking] = useState(false);

  const baseName =
    source instanceof File
      ? source.name.replace(/\.[^/.]+$/, '') || 'artwork'
      : (source?.split('/').pop()?.split('?')[0]?.replace(/\.[^/.]+$/, '') ??
        'artwork');

  const replaceObjectUrl = (next: string | null) => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = next;
    setObjectUrl(next);
  };

  // Turn the source into a same-origin blob URL we can draw onto a canvas.
  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    setLoadError(null);
    replaceObjectUrl(null);
    setCrop(FULL_CROP);
    setAspect(undefined);

    (async () => {
      try {
        const blob =
          source instanceof File
            ? source
            : await fetch(source).then((res) => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                return res.blob();
              });
        if (cancelled) return;
        replaceObjectUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('[ImageCrop] Could not load image for cropping', err);
        if (!cancelled) setLoadError('This photo could not be loaded for cropping.');
      }
    })();

    return () => {
      cancelled = true;
      replaceObjectUrl(null);
    };
  }, [source]);

  const resetCrop = (nextAspect: number | undefined) => {
    const img = imgRef.current;
    if (!img || !nextAspect) {
      setCrop(FULL_CROP);
      return;
    }
    setCrop(
      centerCrop(
        makeAspectCrop({ unit: '%', width: 90 }, nextAspect, img.width, img.height),
        img.width,
        img.height,
      ),
    );
  };

  const handleAspect = (value: number | undefined) => {
    setAspect(value);
    resetCrop(value);
  };

  // Rotation is baked into the working image so the crop box stays upright.
  const rotate = async () => {
    const img = imgRef.current;
    if (!img || !objectUrl) return;
    setWorking(true);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
      const blob = await canvasToBlob(canvas, 'image/png');
      if (!blob) return;
      replaceObjectUrl(URL.createObjectURL(blob));
      setCrop(FULL_CROP);
    } finally {
      setWorking(false);
    }
  };

  const apply = async () => {
    const img = imgRef.current;
    if (!img) return;
    setWorking(true);
    try {
      const sx = Math.round((crop.x / 100) * img.naturalWidth);
      const sy = Math.round((crop.y / 100) * img.naturalHeight);
      const sw = Math.max(1, Math.round((crop.width / 100) * img.naturalWidth));
      const sh = Math.max(1, Math.round((crop.height / 100) * img.naturalHeight));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

      const keepPng = source instanceof File && source.type === 'image/png';
      const type = keepPng ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(canvas, type, 0.92);
      if (!blob) throw new Error('Could not encode cropped image');

      const file = new File(
        [blob],
        `${baseName}-cropped.${keepPng ? 'png' : 'jpg'}`,
        { type, lastModified: Date.now() },
      );
      console.info('[ImageCrop] Cropped image', {
        width: sw,
        height: sh,
        bytes: file.size,
      });
      await onCropped(file);
    } catch (err) {
      console.error('[ImageCrop] Crop failed', err);
      setLoadError('Cropping failed. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <Dialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open && !working) onCancel();
      }}
    >
      <DialogContent
        onOpenAutoFocus={(e) => e.preventDefault()}
        className={cn(
          'flex max-h-[92dvh] flex-col gap-0 overflow-hidden rounded-none p-0 sm:max-w-2xl sm:rounded-none',
          'bg-bone text-editorial-ink border-editorial-border shadow-editorial font-serif',
        )}
      >
        <div className="shrink-0 border-b border-editorial-border/15 px-5 pt-5 pb-4 sm:px-7">
          <p className={FIELD_LABEL}>
            Photo <span className="text-vermillion">/</span> Crop
          </p>
          <DialogTitle className="mt-2 font-fraunces text-[1.5rem] leading-none font-normal tracking-tight italic">
            Crop photo<span className="text-vermillion">.</span>
          </DialogTitle>
          <DialogDescription className={cn(FIELD_HINT, 'mt-2')}>
            Drag the corners to trim walls, frames or background around the work.
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-editorial-ink/[0.04] p-4">
          {loadError ? (
            <p className="font-serif text-sm text-vermillion">{loadError}</p>
          ) : objectUrl ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              aspect={aspect}
              minWidth={24}
              minHeight={24}
              keepSelection
              ruleOfThirds
              // ReactCrop's img inherits max-height from this wrapper. The
              // dialog is capped at 92dvh; header + controls take ~18rem.
              style={{ maxHeight: 'calc(92dvh - 18rem)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL drawn to canvas */}
              <img
                ref={imgRef}
                src={objectUrl}
                alt="Photo to crop"
                className="w-auto max-w-full"
                onLoad={() => resetCrop(aspect)}
                onError={() =>
                  setLoadError(
                    'This browser cannot display this photo format. Upload it as is, or convert it to JPEG first.',
                  )
                }
              />
            </ReactCrop>
          ) : (
            <p className={FIELD_HINT}>Loading photo…</p>
          )}
        </div>

        <div className="shrink-0 space-y-4 border-t border-editorial-border/15 px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-7">
          <div className="flex flex-wrap items-center gap-2">
            {ASPECTS.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => handleAspect(option.value)}
                disabled={!objectUrl || working}
                aria-pressed={aspect === option.value}
                className={cn(
                  'border px-3 py-1.5 font-jetbrains text-[10px] tracking-[0.14em] uppercase transition-colors disabled:opacity-40',
                  aspect === option.value
                    ? 'border-editorial-ink bg-editorial-ink text-bone'
                    : 'border-editorial-border/30 text-editorial-ink/70 hover:border-editorial-border',
                )}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              onClick={rotate}
              disabled={!objectUrl || working}
              className="ml-auto inline-flex items-center gap-1.5 border border-editorial-border/30 px-3 py-1.5 font-jetbrains text-[10px] tracking-[0.14em] text-editorial-ink/70 uppercase transition-colors hover:border-editorial-border disabled:opacity-40"
            >
              <RotateCw className="h-3 w-3" />
              Rotate
            </button>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={working}
              className={BUTTON_SECONDARY}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={apply}
              disabled={!objectUrl || !!loadError || working}
              className={BUTTON_PRIMARY}
            >
              {working ? 'Saving…' : 'Apply crop'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

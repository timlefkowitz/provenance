'use client';

import { useEffect, useRef, useState } from 'react';

import { FlipHorizontal2, RotateCcw, RotateCw, Undo2 } from 'lucide-react';
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
import { straightenFillScale } from '~/lib/artwork-image-edit';

/** A local file, or the URL of an image already stored (e.g. artwork.image_url). */
export type CropSource = File | string;

const ASPECTS: Array<{ label: string; value: number | undefined }> = [
  { label: 'Free', value: undefined },
  { label: 'Square', value: 1 },
  { label: '4:5', value: 4 / 5 },
  { label: '3:2', value: 3 / 2 },
];

const FULL_CROP: PercentCrop = { unit: '%', x: 0, y: 0, width: 100, height: 100 };

const MAX_STRAIGHTEN = 45;

type Transform = { quarterTurns: number; flip: boolean; straighten: number };
const NO_TRANSFORM: Transform = { quarterTurns: 0, flip: false, straighten: 0 };

const isIdentity = (t: Transform) =>
  t.quarterTurns % 4 === 0 && !t.flip && t.straighten === 0;

/**
 * Crop, rotate, flip and straighten a photo in the browser and hand back a new
 * File. Every adjustment is redrawn from the source photo, so repeated edits
 * never compound quality loss. The source itself is never modified; callers
 * keep it as the original. Remote images are fetched as a blob first so the
 * canvas isn't tainted by a cross-origin draw.
 */
export function ImageCropDialog({
  source,
  onCancel,
  onCropped,
  description = 'Crop, rotate or straighten the photo. The original is kept.',
}: {
  /** Opens the dialog when set. */
  source: CropSource | null;
  onCancel: () => void;
  onCropped: (file: File) => void | Promise<void>;
  description?: string;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  /** The decoded source photo, untouched. */
  const sourceImgRef = useRef<HTMLImageElement | null>(null);
  /** The source with rotation/flip/straighten applied, at full resolution. */
  const workingCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sourceUrlRef = useRef<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [sourceReady, setSourceReady] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Kept in percent so it stays correct if the layout resizes before Apply.
  const [crop, setCrop] = useState<PercentCrop>(FULL_CROP);
  const [aspect, setAspect] = useState<number | undefined>(undefined);
  const [transform, setTransform] = useState<Transform>(NO_TRANSFORM);
  // The slider moves freely; the (heavier) redraw follows a beat behind.
  const [straightenInput, setStraightenInput] = useState(0);
  const [working, setWorking] = useState(false);

  const baseName =
    source instanceof File
      ? source.name.replace(/\.[^/.]+$/, '') || 'artwork'
      : (source?.split('/').pop()?.split('?')[0]?.replace(/\.[^/.]+$/, '') ??
        'artwork');

  const replacePreviewUrl = (next: string | null) => {
    if (previewUrlRef.current && previewUrlRef.current !== sourceUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = next;
    setPreviewUrl(next);
  };

  // Load the source into a same-origin image we can draw onto a canvas.
  useEffect(() => {
    if (!source) return;

    let cancelled = false;
    setLoadError(null);
    setCrop(FULL_CROP);
    setAspect(undefined);
    setTransform(NO_TRANSFORM);
    setStraightenInput(0);
    workingCanvasRef.current = null;
    sourceImgRef.current = null;

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
        const url = URL.createObjectURL(blob);
        sourceUrlRef.current = url;
        const img = new Image();
        img.onload = () => {
          if (cancelled) return;
          sourceImgRef.current = img;
          replacePreviewUrl(url);
          setSourceReady((n) => n + 1);
        };
        img.onerror = () => {
          if (!cancelled) {
            setLoadError(
              'This browser cannot display this photo format. Upload it as is, or convert it to JPEG first.',
            );
          }
        };
        img.src = url;
      } catch (err) {
        console.error('[ImageCrop] Could not load image for editing', err);
        if (!cancelled) setLoadError('This photo could not be loaded for editing.');
      }
    })();

    return () => {
      cancelled = true;
      replacePreviewUrl(null);
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current);
      sourceUrlRef.current = null;
    };
  }, [source]);

  useEffect(() => {
    if (straightenInput === transform.straighten) return;
    const id = window.setTimeout(
      () => setTransform((t) => ({ ...t, straighten: straightenInput })),
      120,
    );
    return () => window.clearTimeout(id);
  }, [straightenInput, transform.straighten]);

  // Redraw the working image from the untouched source whenever the transform changes.
  useEffect(() => {
    const img = sourceImgRef.current;
    if (!img) return;

    if (isIdentity(transform)) {
      workingCanvasRef.current = null;
      replacePreviewUrl(sourceUrlRef.current);
      return;
    }

    let cancelled = false;
    const canvas = renderTransformed(img, transform);
    workingCanvasRef.current = canvas;
    canvasToBlob(canvas, 'image/jpeg', 0.9).then((blob) => {
      if (cancelled || !blob) return;
      replacePreviewUrl(URL.createObjectURL(blob));
    });
    return () => {
      cancelled = true;
    };
  }, [transform, sourceReady]);

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

  const turn = (delta: 1 | -1) =>
    setTransform((t) => ({ ...t, quarterTurns: (t.quarterTurns + delta + 4) % 4 }));

  const flip = () => setTransform((t) => ({ ...t, flip: !t.flip }));

  const resetAll = () => {
    setTransform(NO_TRANSFORM);
    setStraightenInput(0);
    setAspect(undefined);
    setCrop(FULL_CROP);
  };

  const apply = async () => {
    const src: CanvasImageSource | null =
      workingCanvasRef.current ?? sourceImgRef.current;
    if (!src) return;
    const naturalWidth =
      src instanceof HTMLCanvasElement ? src.width : (src as HTMLImageElement).naturalWidth;
    const naturalHeight =
      src instanceof HTMLCanvasElement ? src.height : (src as HTMLImageElement).naturalHeight;

    setWorking(true);
    try {
      const sx = Math.round((crop.x / 100) * naturalWidth);
      const sy = Math.round((crop.y / 100) * naturalHeight);
      const sw = Math.max(1, Math.round((crop.width / 100) * naturalWidth));
      const sh = Math.max(1, Math.round((crop.height / 100) * naturalHeight));

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);

      const keepPng = source instanceof File && source.type === 'image/png';
      const type = keepPng ? 'image/png' : 'image/jpeg';
      const blob = await canvasToBlob(canvas, type, 0.92);
      if (!blob) throw new Error('Could not encode edited image');

      const file = new File(
        [blob],
        `${baseName}-edited.${keepPng ? 'png' : 'jpg'}`,
        { type, lastModified: Date.now() },
      );
      console.info('[ImageCrop] Edited image', {
        width: sw,
        height: sh,
        bytes: file.size,
        transform,
      });
      await onCropped(file);
    } catch (err) {
      console.error('[ImageCrop] Edit failed', err);
      setLoadError('Saving the edit failed. Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const disabled = !previewUrl || working;
  const pill =
    'inline-flex items-center gap-1.5 border px-3 py-1.5 font-jetbrains text-[10px] tracking-[0.14em] uppercase transition-colors disabled:opacity-40';
  const pillIdle = 'border-editorial-border/30 text-editorial-ink/70 hover:border-editorial-border';
  const pillOn = 'border-editorial-ink bg-editorial-ink text-bone';

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
            Photo <span className="text-vermillion">/</span> Edit
          </p>
          <DialogTitle className="mt-2 font-fraunces text-[1.5rem] leading-none font-normal tracking-tight italic">
            Edit photo<span className="text-vermillion">.</span>
          </DialogTitle>
          <DialogDescription className={cn(FIELD_HINT, 'mt-2')}>{description}</DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-editorial-ink/[0.04] p-4">
          {loadError ? (
            <p className="font-serif text-sm text-vermillion">{loadError}</p>
          ) : previewUrl ? (
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              aspect={aspect}
              minWidth={24}
              minHeight={24}
              keepSelection
              ruleOfThirds
              // ReactCrop's img inherits max-height from this wrapper. The
              // dialog is capped at 92dvh; header + controls take ~22rem.
              style={{ maxHeight: 'calc(92dvh - 22rem)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- blob URL drawn to canvas */}
              <img
                ref={imgRef}
                src={previewUrl}
                alt="Photo to edit"
                className="w-auto max-w-full"
                onLoad={() => resetCrop(aspect)}
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
                disabled={disabled}
                aria-pressed={aspect === option.value}
                className={cn(pill, aspect === option.value ? pillOn : pillIdle)}
              >
                {option.label}
              </button>
            ))}
            <span className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => turn(-1)}
                disabled={disabled}
                aria-label="Rotate left"
                title="Rotate left"
                className={cn(pill, pillIdle)}
              >
                <RotateCcw className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => turn(1)}
                disabled={disabled}
                aria-label="Rotate right"
                title="Rotate right"
                className={cn(pill, pillIdle)}
              >
                <RotateCw className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={flip}
                disabled={disabled}
                aria-pressed={transform.flip}
                aria-label="Flip horizontally"
                title="Flip horizontally"
                className={cn(pill, transform.flip ? pillOn : pillIdle)}
              >
                <FlipHorizontal2 className="h-3 w-3" />
              </button>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <label
              htmlFor="image-straighten"
              className="shrink-0 font-jetbrains text-[10px] tracking-[0.14em] text-editorial-ink/70 uppercase"
            >
              Straighten
            </label>
            <input
              id="image-straighten"
              type="range"
              min={-MAX_STRAIGHTEN}
              max={MAX_STRAIGHTEN}
              step={0.5}
              value={straightenInput}
              onChange={(e) => setStraightenInput(Number(e.target.value))}
              onDoubleClick={() => setStraightenInput(0)}
              disabled={disabled}
              className="min-w-0 flex-1 accent-vermillion disabled:opacity-40"
            />
            <span className="w-12 shrink-0 text-right font-jetbrains text-[10px] tabular-nums text-editorial-ink/70">
              {straightenInput > 0 ? '+' : ''}
              {straightenInput}°
            </span>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={resetAll}
              disabled={disabled || (isIdentity(transform) && straightenInput === 0 && aspect === undefined)}
              className={cn(pill, 'border-transparent px-0 text-editorial-ink/60 hover:text-editorial-ink')}
            >
              <Undo2 className="h-3 w-3" />
              Reset
            </button>
            <div className="flex gap-2">
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
                disabled={!previewUrl || !!loadError || working}
                className={BUTTON_PRIMARY}
              >
                {working ? 'Saving…' : 'Apply'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Draw the source with a quarter-turn rotation, an optional horizontal flip
 * (relative to the turned photo) and a fine straighten, zoomed so no blank
 * corners show.
 */
function renderTransformed(img: HTMLImageElement, t: Transform): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const sideways = t.quarterTurns % 2 === 1;
  const turnedW = sideways ? h : w;
  const turnedH = sideways ? w : h;
  const scale = straightenFillScale(turnedW, turnedH, t.straighten);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(turnedW * scale));
  canvas.height = Math.max(1, Math.round(turnedH * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((t.straighten * Math.PI) / 180);
  if (t.flip) ctx.scale(-1, 1);
  ctx.rotate((t.quarterTurns * Math.PI) / 2);
  ctx.drawImage(img, -w / 2, -h / 2);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

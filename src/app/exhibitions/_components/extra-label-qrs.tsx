'use client';

import { useRef, type RefObject } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ImagePlus, Plus, X } from 'lucide-react';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import type { ArtistBio } from '../_helpers/artist-bios';
import type { LabelQr } from '../_helpers/exhibition-print-html';

/**
 * Extra QR codes on wall labels, e.g. an artist's own code for their website
 * or shop. Each is a link we draw as a code, or an uploaded image of a code,
 * printed on every label or only on one artist's works.
 */
export type ExtraLabelQr = {
  id: string;
  caption: string;
  /** Drawn as a QR code when there is no image. */
  url: string;
  /** Uploaded QR image (PNG data URI); takes precedence over url. */
  image: string | null;
  /** 'all', or an ArtistBio.key. */
  target: string;
};

const MAX_EXTRA_QRS = 6;
const UPLOAD_MAX_SIDE = 480;
const MAX_IMAGE_CHARS = 200_000;

export function readExtraQrs(raw: unknown): ExtraLabelQr[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is Record<string, unknown> => !!e && typeof e === 'object')
    .map((e) => ({
      id: typeof e.id === 'string' ? e.id : Math.random().toString(36).slice(2),
      caption: typeof e.caption === 'string' ? e.caption.slice(0, 40) : '',
      url: typeof e.url === 'string' ? e.url.slice(0, 500) : '',
      image:
        typeof e.image === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(e.image)
          ? e.image
          : null,
      target: typeof e.target === 'string' ? e.target : 'all',
    }))
    .slice(0, MAX_EXTRA_QRS);
}

/** Shrinks an uploaded QR image, keeping its shape, to a PNG data URI. */
async function prepareQrImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image failed to load'));
      el.src = url;
    });
    const scale = Math.min(1, UPLOAD_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const png = canvas.toDataURL('image/png');
    if (png.length > MAX_IMAGE_CHARS) throw new Error('Image too large');
    return png;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Printable markup for each extra code, by artwork id. Reads link codes from `svgRoot`. */
export function resolveExtraQrs(
  extras: ExtraLabelQr[],
  artists: ArtistBio[] | null,
  svgRoot: HTMLElement | null,
): (artworkId: string) => LabelQr[] {
  const resolved = extras
    .map((e) => {
      const html = e.image
        ? `<img src="${e.image}" alt="" />`
        : e.url.trim()
          ? svgRoot?.querySelector(`[data-extra-qr="${e.id}"]`)?.innerHTML ?? ''
          : '';
      const ids = e.target === 'all' ? null : new Set(artists?.find((a) => a.key === e.target)?.artworkIds ?? []);
      return { qr: { html, caption: e.caption.trim() }, ids };
    })
    .filter((r) => r.qr.html);
  return (artworkId) => resolved.filter((r) => !r.ids || r.ids.has(artworkId)).map((r) => r.qr);
}

export function ExtraLabelQrsEditor({
  extras,
  onChange,
  artists,
  artistsLoading,
  svgRootRef,
}: {
  extras: ExtraLabelQr[];
  onChange: (next: ExtraLabelQr[]) => void;
  /** Artists among the works, for "only on this artist's labels". */
  artists: ArtistBio[] | null;
  artistsLoading: boolean;
  /** Hidden container holding the drawn link codes, read at print time. */
  svgRootRef: RefObject<HTMLDivElement | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  const update = (id: string, patch: Partial<ExtraLabelQr>) =>
    onChange(extras.map((e) => (e.id === id ? { ...e, ...patch } : e)));

  const add = () =>
    onChange([
      ...extras,
      { id: Math.random().toString(36).slice(2, 10), caption: '', url: '', image: null, target: 'all' },
    ]);

  const handleUpload = async (file: File | undefined) => {
    const id = uploadFor.current;
    if (fileRef.current) fileRef.current.value = '';
    if (!file || !id) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file.');
      return;
    }
    try {
      update(id, { image: await prepareQrImage(file) });
    } catch (err) {
      console.error('[Print] Extra QR image failed', err);
      toast.error('Could not use that image. Try a smaller PNG or JPEG.');
    }
  };

  return (
    <div className="pt-2">
      <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-1">More QR codes</p>
      <p className="text-[11px] font-serif text-ink/45 mb-2">
        Add an artist&apos;s own code (website, shop, video) as a link or an image of the code.
      </p>

      {/* Link codes, drawn here and copied into the print window. */}
      <div ref={svgRootRef} aria-hidden="true" className="hidden">
        {extras
          .filter((e) => !e.image && e.url.trim())
          .map((e) => (
            <div key={e.id} data-extra-qr={e.id}>
              <QRCodeSVG value={e.url.trim()} size={256} level="M" marginSize={1} />
            </div>
          ))}
      </div>

      <div className="space-y-3">
        {extras.map((e) => (
          <div key={e.id} className="rounded-md border border-wine/15 p-2 space-y-2">
            <div className="flex items-center gap-2">
              <Input
                value={e.caption}
                maxLength={40}
                onChange={(ev) => update(e.id, { caption: ev.target.value })}
                placeholder="Caption, e.g. Artist website"
                aria-label="QR code caption"
                className="h-8 font-serif text-sm"
              />
              <button
                type="button"
                onClick={() => onChange(extras.filter((x) => x.id !== e.id))}
                className="shrink-0 rounded p-1 text-ink/40 hover:text-ink"
                aria-label="Remove QR code"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {e.image ? (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={e.image} alt="Uploaded QR code" className="h-12 w-12 rounded-sm border border-wine/15 object-contain bg-white" />
                <button
                  type="button"
                  className="text-[11px] font-serif text-ink/50 underline hover:text-ink"
                  onClick={() => update(e.id, { image: null })}
                >
                  Use a link instead
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={e.url}
                  maxLength={500}
                  onChange={(ev) => update(e.id, { url: ev.target.value })}
                  placeholder="https://…"
                  aria-label="QR code link"
                  inputMode="url"
                  className="h-8 font-serif text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    uploadFor.current = e.id;
                    fileRef.current?.click();
                  }}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] font-serif text-ink/50 underline hover:text-ink"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  Upload
                </button>
              </div>
            )}
            <label className="flex items-center gap-2 text-[11px] font-serif text-ink/60">
              On
              <select
                value={e.target}
                onChange={(ev) => update(e.id, { target: ev.target.value })}
                className="flex-1 rounded-md border border-wine/20 bg-white px-2 py-1 font-serif text-xs text-ink"
              >
                <option value="all">Every label</option>
                {(artists ?? []).map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.name}&apos;s works ({a.artworkIds.length})
                  </option>
                ))}
                {e.target !== 'all' && !artists?.some((a) => a.key === e.target) && (
                  <option value={e.target}>{artistsLoading ? 'Loading artists…' : 'Artist not in these works'}</option>
                )}
              </select>
            </label>
          </div>
        ))}
      </div>

      {extras.length < MAX_EXTRA_QRS && (
        <button
          type="button"
          onClick={add}
          className="mt-2 inline-flex items-center gap-1 text-xs font-serif text-wine underline hover:text-wine/80"
        >
          <Plus className="h-3.5 w-3.5" />
          Add a QR code
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(ev) => void handleUpload(ev.target.files?.[0])}
      />
      {extras.length > 0 && (
        <p className="mt-2 text-[11px] font-serif text-ink/40">
          Remembered on this device. Test-scan one printed label before printing them all.
        </p>
      )}
    </div>
  );
}

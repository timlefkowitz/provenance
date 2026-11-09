'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, Image as ImageIcon, Loader2, Plus, Printer, Tag, Upload, X } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { cn } from '@kit/ui/utils';

import { EditorialDialogContent } from '~/components/editorial-dialog';
import { isLikelyImageFile, prepareImageForUpload } from '~/lib/client-image-upload';
import type { MatchConfidence } from '~/lib/image-fingerprint/similarity';
import type { WallBox } from '~/lib/image-fingerprint/wall-scan';
import { loadPriceSymbolPref, savePriceSymbolPref } from '~/lib/print-price';

import { scanExhibitionWall } from '../_actions/scan-exhibition-wall';
import { DEFAULT_WALL_GROUP_LABEL_OPTIONS, type WallGroupLabelOptions } from '../_helpers/exhibition-print-html';

const OPTIONS_KEY = 'provenance.exhibition.wallGroupLabelOptions';

export type WallScanArtwork = {
  id: string;
  title: string | null;
  artist_name: string | null;
  image_url: string | null;
};

type Row = {
  artworkId: string;
  box: WallBox | null;
  confidence: MatchConfidence | null;
};

const FIELD_TOGGLES: Array<{ key: 'year' | 'medium' | 'dimensions' | 'price' | 'qrCode'; label: string }> = [
  { key: 'year', label: 'Year' },
  { key: 'medium', label: 'Medium' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'price', label: 'Price' },
  { key: 'qrCode', label: 'Exhibition QR code' },
];

function loadOptions(): WallGroupLabelOptions {
  const priceSymbol = loadPriceSymbolPref();
  try {
    const raw = window.localStorage.getItem(OPTIONS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<WallGroupLabelOptions>;
      // The wall name is per wall, so it never carries over.
      return { ...DEFAULT_WALL_GROUP_LABEL_OPTIONS, ...saved, wallName: '', priceSymbol };
    }
  } catch {
    // storage unavailable — defaults
  }
  return { ...DEFAULT_WALL_GROUP_LABEL_OPTIONS, priceSymbol };
}

function saveOptions(options: WallGroupLabelOptions) {
  try {
    window.localStorage.setItem(OPTIONS_KEY, JSON.stringify({ ...options, wallName: '' }));
  } catch {
    // ignore
  }
}

/** Index at which a row with this box belongs among rows already in wall order. */
function insertionIndex(rows: Row[], box: WallBox | null): number {
  if (!box) return rows.length;
  const cx = box.x + box.w / 2;
  const i = rows.findIndex((r) => r.box && r.box.x + r.box.w / 2 > cx);
  return i === -1 ? rows.length : i;
}

/**
 * "Label a wall from a photo": photograph a wall of works that are in this exhibition, and
 * the works found are listed in hanging order (left to right), ready to correct and print as
 * one wall label, or as individual labels in that order.
 */
export function WallScanDialog({
  open,
  onOpenChange,
  exhibitionId,
  artworks,
  onPrintWallLabel,
  onPrintIndividualLabels,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitionId: string;
  /** The works that may be on the wall (the show, or curator mode's selection). */
  artworks: WallScanArtwork[];
  onPrintWallLabel: (orderedIds: string[], options: WallGroupLabelOptions) => void;
  onPrintIndividualLabels: (orderedIds: string[]) => void;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aspect, setAspect] = useState<number | null>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  /** Weak hits, shown as suggestions until added. */
  const [maybes, setMaybes] = useState<Row[]>([]);
  const [unindexed, setUnindexed] = useState(0);
  const [options, setOptions] = useState<WallGroupLabelOptions>(DEFAULT_WALL_GROUP_LABEL_OPTIONS);
  const cameraRef = useRef<HTMLInputElement>(null);
  const uploadRef = useRef<HTMLInputElement>(null);

  const byId = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);

  const reset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setAspect(null);
    setRows(null);
    setMaybes([]);
    setError(null);
    setUnindexed(0);
    setScanning(false);
  };

  useEffect(() => {
    if (open) setOptions(loadOptions());
    else reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const scan = async (file: File | undefined) => {
    if (!file) return;
    if (!isLikelyImageFile(file)) {
      setError('That file doesn’t look like a photo.');
      return;
    }
    reset();
    setScanning(true);
    try {
      const prepared = await prepareImageForUpload(file);
      setPreviewUrl(URL.createObjectURL(prepared));
      const fd = new FormData();
      fd.set('image', prepared);
      fd.set('exhibitionId', exhibitionId);
      fd.set('artworkIds', JSON.stringify(artworks.map((a) => a.id)));
      const result = await scanExhibitionWall(fd);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const found = result.placements.filter((p) => byId.has(p.artworkId));
      setAspect(result.width / result.height);
      setUnindexed(result.unindexedCount);
      const toRow = (p: (typeof found)[number]): Row => ({
        artworkId: p.artworkId,
        box: p.box,
        confidence: p.confidence,
      });
      setRows(found.filter((p) => p.confidence !== 'weak').map(toRow));
      setMaybes(found.filter((p) => p.confidence === 'weak').map(toRow));
    } catch (err) {
      console.error('[WallScan] scan failed', err);
      setError('Scan failed. Check your connection and try again.');
    } finally {
      setScanning(false);
    }
  };

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    void scan(file);
  };

  const move = (index: number, delta: -1 | 1) =>
    setRows((prev) => {
      if (!prev) return prev;
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const remove = (index: number) => {
    const row = rows?.[index];
    if (!row) return;
    // A removed match with a box goes back to the suggestions, so it can be re-added.
    if (row.box) setMaybes((m) => [...m, { ...row, confidence: 'weak' }]);
    setRows((prev) => prev?.filter((r) => r.artworkId !== row.artworkId) ?? prev);
  };

  const add = (row: Row) => {
    setMaybes((m) => m.filter((r) => r.artworkId !== row.artworkId));
    setRows((prev) => {
      const list = prev ?? [];
      if (list.some((r) => r.artworkId === row.artworkId)) return list;
      const next = [...list];
      next.splice(insertionIndex(list, row.box), 0, row);
      return next;
    });
  };

  const listed = new Set([...(rows ?? []), ...maybes].map((r) => r.artworkId));
  const addable = artworks.filter((a) => !listed.has(a.id));
  const orderedIds = (rows ?? []).map((r) => r.artworkId);

  const setOption = <K extends keyof WallGroupLabelOptions>(key: K, value: WallGroupLabelOptions[K]) =>
    setOptions((o) => ({ ...o, [key]: value }));

  const printWallLabel = () => {
    saveOptions(options);
    savePriceSymbolPref(options.priceSymbol);
    onPrintWallLabel(orderedIds, options);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditorialDialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-wine">Label a wall from a photo</DialogTitle>
          <DialogDescription className="font-serif text-sm">
            Photograph a wall of works from this exhibition. The works found are listed in hanging order, ready
            to check and print as one wall label.
          </DialogDescription>
        </DialogHeader>

        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPick} />
        <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={onPick} />

        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={scanning}
            className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5"
          >
            <Camera className="h-4 w-4" />
            {rows ? 'Retake' : 'Take photo'}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => uploadRef.current?.click()}
            disabled={scanning}
            className="font-serif gap-1.5 border-wine/25"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Button>
        </div>
        {!rows && (
          <p className="-mt-2 text-[11px] text-ink/45 font-serif">
            Stand back far enough to get the whole wall in, as straight on as you can, in even light.
          </p>
        )}

        {previewUrl && (
          <div className="relative overflow-hidden rounded-md border border-wine/10 bg-parchment/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Your photo of the wall"
              className="block w-full h-auto"
              style={aspect ? { aspectRatio: String(aspect) } : undefined}
            />
            {(rows ?? []).map(
              (r, i) =>
                r.box && (
                  <div
                    key={r.artworkId}
                    className="absolute border-2 border-wine shadow-[0_0_0_1px_rgba(255,255,255,0.7)]"
                    style={{
                      left: `${r.box.x * 100}%`,
                      top: `${r.box.y * 100}%`,
                      width: `${r.box.w * 100}%`,
                      height: `${r.box.h * 100}%`,
                    }}
                  >
                    <span className="absolute -left-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-br bg-wine px-1 text-[11px] font-serif text-parchment">
                      {i + 1}
                    </span>
                  </div>
                ),
            )}
            {maybes.map(
              (r) =>
                r.box && (
                  <div
                    key={`maybe-${r.artworkId}`}
                    className="absolute border-2 border-dashed border-amber-500/80"
                    style={{
                      left: `${r.box.x * 100}%`,
                      top: `${r.box.y * 100}%`,
                      width: `${r.box.w * 100}%`,
                      height: `${r.box.h * 100}%`,
                    }}
                  >
                    <span className="absolute -left-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-br bg-amber-500 text-[11px] font-serif text-white">
                      ?
                    </span>
                  </div>
                ),
            )}
            {scanning && (
              <div
                className="absolute inset-0 flex items-center justify-center bg-parchment/60 backdrop-blur-[1px]"
                aria-live="polite"
              >
                <span className="inline-flex items-center gap-2 rounded-full bg-parchment px-3 py-1.5 text-xs font-serif text-ink/70 shadow-sm">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Looking for {artworks.length} {artworks.length === 1 ? 'work' : 'works'}… about 10 seconds
                </span>
              </div>
            )}
          </div>
        )}

        {error && <p className="text-sm font-serif text-red-700">{error}</p>}

        {rows && (
          <div className="space-y-4">
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif">
                  On this wall · {options.direction.trim() || 'in order'}
                </p>
                <p className="text-[11px] font-serif text-ink/40">
                  {rows.length} {rows.length === 1 ? 'work' : 'works'}
                </p>
              </div>
              {rows.length === 0 ? (
                <p className="text-sm font-serif text-ink/60">
                  No works recognised. Try again closer, or add them from the list below.
                </p>
              ) : (
                <ol className="space-y-1.5">
                  {rows.map((r, i) => (
                    <WorkRow
                      key={r.artworkId}
                      number={i + 1}
                      artwork={byId.get(r.artworkId)}
                      note={r.confidence === 'likely' ? 'Check this one' : r.box ? null : 'Added by hand'}
                    >
                      <IconButton label="Move earlier" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Move later" onClick={() => move(i, 1)} disabled={i === rows.length - 1}>
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Remove from this wall" onClick={() => remove(i)}>
                        <X className="h-3.5 w-3.5" />
                      </IconButton>
                    </WorkRow>
                  ))}
                </ol>
              )}
            </div>

            {maybes.length > 0 && (
              <div>
                <p className="mb-2 text-[10px] uppercase tracking-widest text-ink/40 font-serif">
                  Possible matches · not on the label
                </p>
                <ul className="space-y-1.5">
                  {maybes.map((r) => (
                    <WorkRow key={r.artworkId} artwork={byId.get(r.artworkId)} muted>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 border-wine/25 font-serif text-xs"
                        onClick={() => add(r)}
                      >
                        <Plus className="h-3 w-3" />
                        Add
                      </Button>
                    </WorkRow>
                  ))}
                </ul>
              </div>
            )}

            {addable.length > 0 && (
              <div>
                <Label htmlFor="wall-add" className="text-[10px] uppercase tracking-widest text-ink/40 font-serif">
                  Missed one? Add it
                </Label>
                <select
                  id="wall-add"
                  className="mt-1.5 h-9 w-full rounded-md border border-wine/20 bg-transparent px-2 font-serif text-sm"
                  value=""
                  onChange={(e) => {
                    if (e.target.value) add({ artworkId: e.target.value, box: null, confidence: null });
                  }}
                >
                  <option value="">Choose a work from the exhibition…</option>
                  {addable.map((a) => (
                    <option key={a.id} value={a.id}>
                      {[a.artist_name, a.title || 'Untitled'].filter(Boolean).join(' — ')}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] font-serif text-ink/40">Added works go at the end; move them into place.</p>
              </div>
            )}

            {unindexed > 0 && (
              <p className="text-[11px] font-serif text-ink/45">
                {unindexed} {unindexed === 1 ? 'work has' : 'works have'} no photo fingerprint yet and can’t be
                recognised. If they have photos, scan again in a few minutes.
              </p>
            )}

            <div className="grid gap-3 border-t border-wine/10 pt-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="wall-name" className="font-serif text-sm">
                  Wall name <span className="text-ink/40">(optional)</span>
                </Label>
                <Input
                  id="wall-name"
                  value={options.wallName}
                  onChange={(e) => setOption('wallName', e.target.value)}
                  placeholder="e.g. North wall"
                  className="font-serif"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="wall-direction" className="font-serif text-sm">
                  Reading order
                </Label>
                <Input
                  id="wall-direction"
                  value={options.direction}
                  onChange={(e) => setOption('direction', e.target.value)}
                  placeholder="Left to right"
                  className="font-serif"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 sm:grid-cols-3">
              {FIELD_TOGGLES.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <Checkbox
                    id={`wall-${key}`}
                    checked={options[key]}
                    onCheckedChange={(checked) => setOption(key, checked === true)}
                    className="border-wine/30"
                  />
                  <Label htmlFor={`wall-${key}`} className="font-serif text-sm cursor-pointer">
                    {label}
                  </Label>
                </div>
              ))}
              {options.price && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="wall-priceSymbol"
                    checked={options.priceSymbol}
                    onCheckedChange={(checked) => setOption('priceSymbol', checked === true)}
                    className="border-wine/30"
                  />
                  <Label htmlFor="wall-priceSymbol" className="font-serif text-sm cursor-pointer">
                    Dollar sign
                  </Label>
                </div>
              )}
            </div>
          </div>
        )}

        {rows && (
          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onPrintIndividualLabels(orderedIds)}
              disabled={orderedIds.length === 0}
              className="font-serif gap-1.5 border-wine/25"
              title="The usual wall labels, one per work, printed in this order"
            >
              <Tag className="h-3.5 w-3.5" />
              Individual labels…
            </Button>
            <Button
              type="button"
              onClick={printWallLabel}
              disabled={orderedIds.length === 0}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif gap-1.5"
            >
              <Printer className="h-3.5 w-3.5" />
              Print wall label
            </Button>
          </DialogFooter>
        )}
      </EditorialDialogContent>
    </Dialog>
  );
}

function WorkRow({
  number,
  artwork,
  note,
  muted = false,
  children,
}: {
  number?: number;
  artwork: WallScanArtwork | undefined;
  note?: string | null;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={cn(
        'flex items-center gap-2.5 rounded-md border p-1.5',
        muted ? 'border-dashed border-amber-500/40 bg-amber-50/40' : 'border-wine/10 bg-parchment/40',
      )}
    >
      {number !== undefined && (
        <span className="w-5 shrink-0 text-center text-xs font-serif text-wine">{number}</span>
      )}
      {artwork?.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={artwork.image_url} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded object-cover" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-wine/5">
          <ImageIcon className="h-4 w-4 text-wine/25" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm text-ink">{artwork?.title || 'Untitled'}</p>
        <p className="truncate text-xs font-serif text-ink/55">
          {artwork?.artist_name}
          {note && <span className="ml-1.5 text-amber-700">· {note}</span>}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">{children}</div>
    </li>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-7 w-7 items-center justify-center rounded text-ink/50 transition-colors hover:bg-wine/10 hover:text-wine disabled:opacity-25 disabled:hover:bg-transparent"
    >
      {children}
    </button>
  );
}

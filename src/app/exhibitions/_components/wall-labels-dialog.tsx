'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { loadPriceSymbolPref, savePriceSymbolPref } from '~/lib/print-price';
import type { ArtistBio } from '../_helpers/artist-bios';
import { DEFAULT_LABEL_OPTIONS, type WallLabelOptions } from '../_helpers/exhibition-print-html';

export type WallLabelToggleKey = Exclude<keyof WallLabelOptions, 'size' | 'qrPosition'>;

const FIELD_TOGGLES: Array<{
  key: WallLabelToggleKey;
  label: string;
  hint?: string;
  /** Only meaningful while this other toggle is on. */
  requires?: WallLabelToggleKey;
}> = [
  { key: 'year', label: 'Year' },
  { key: 'medium', label: 'Medium' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'edition', label: 'Edition' },
  { key: 'price', label: 'Price' },
  { key: 'priceSymbol', label: 'Dollar sign', hint: 'Show $ before prices', requires: 'price' },
  { key: 'creditLine', label: 'Credit line' },
  { key: 'description', label: 'Description' },
  { key: 'artistBio', label: 'Artist bio', hint: 'From their profile; editable below' },
  { key: 'qrCode', label: 'QR code', hint: 'Links to the certificate' },
];

function loadLabelOptions(storageKey: string): WallLabelOptions {
  // The $ choice is shared with every print menu, so it has its own key.
  const priceSymbol = loadPriceSymbolPref();
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      return { ...DEFAULT_LABEL_OPTIONS, ...(JSON.parse(raw) as Partial<WallLabelOptions>), priceSymbol };
    }
  } catch {
    // storage unavailable — use defaults
  }
  return { ...DEFAULT_LABEL_OPTIONS, priceSymbol };
}

function saveJson(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

function loadBioEdits(key: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Wall label options: which fields print, artist bios (editable, remembered
 * on this device), QR code position and label size. Used by the exhibition
 * and collection print menus.
 */
export function WallLabelsDialog({
  open,
  onOpenChange,
  count,
  optionsStorageKey,
  bioEditsStorageKey,
  loadBios,
  hints,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of labels that will print. */
  count: number;
  /** localStorage key for the remembered field choices. */
  optionsStorageKey: string;
  /** localStorage key for bio edits, keyed by ArtistBio.key. */
  bioEditsStorageKey: string;
  loadBios: () => Promise<ArtistBio[]>;
  /** Per-toggle hint text, e.g. where the price comes from. */
  hints?: Partial<Record<WallLabelToggleKey, string>>;
  /** Artwork id → bio text for the works whose artist has one. */
  onPrint: (options: WallLabelOptions, biosByArtwork: Map<string, string>) => void;
}) {
  const [options, setOptions] = useState<WallLabelOptions>(DEFAULT_LABEL_OPTIONS);
  const [artistBios, setArtistBios] = useState<ArtistBio[] | null>(null);
  const [biosLoading, setBiosLoading] = useState(false);
  const [biosError, setBiosError] = useState<string | null>(null);
  const [bioEdits, setBioEdits] = useState<Record<string, string>>({});

  const fetchBios = async () => {
    setBiosLoading(true);
    setBiosError(null);
    try {
      setArtistBios(await loadBios());
      setBioEdits(loadBioEdits(bioEditsStorageKey));
    } catch (err) {
      console.error('[Print] Load artist bios failed', err);
      setBiosError(err instanceof Error ? err.message : 'Could not load artist bios.');
    } finally {
      setBiosLoading(false);
    }
  };

  // Fresh choices and bios each time it opens: the works may have changed.
  useEffect(() => {
    if (!open) return;
    const saved = loadLabelOptions(optionsStorageKey);
    setOptions(saved);
    setArtistBios(null);
    if (saved.artistBio) void fetchBios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bioText = (artist: ArtistBio) => bioEdits[artist.key] ?? artist.bio;

  const changeBioEdits = (update: (prev: Record<string, string>) => Record<string, string>) => {
    setBioEdits((prev) => {
      const next = update(prev);
      saveJson(bioEditsStorageKey, next);
      return next;
    });
  };

  const handlePrint = () => {
    saveJson(optionsStorageKey, options);
    savePriceSymbolPref(options.priceSymbol);
    const biosByArtwork = new Map<string, string>();
    for (const artist of artistBios ?? []) {
      const text = bioText(artist).trim();
      if (text) for (const id of artist.artworkIds) biosByArtwork.set(id, text);
    }
    onPrint(options, biosByArtwork);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditorialDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wall labels</DialogTitle>
          <DialogDescription>
            Choose what appears on each label. Artist and title are always included. {count}{' '}
            {count === 1 ? 'label' : 'labels'}.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
          {FIELD_TOGGLES.map(({ key, label, hint, requires }) => {
            const hintText = hints?.[key] ?? hint;
            return (
              <div
                key={key}
                className={`flex items-start gap-2 ${requires && !options[requires] ? 'opacity-40' : ''}`}
              >
                <Checkbox
                  id={`wl-${key}`}
                  checked={options[key]}
                  disabled={requires ? !options[requires] : false}
                  onCheckedChange={(checked) => {
                    setOptions((o) => ({ ...o, [key]: checked === true }));
                    if (key === 'artistBio' && checked === true && !artistBios && !biosLoading) {
                      void fetchBios();
                    }
                  }}
                  className="mt-0.5 border-wine/30"
                />
                <Label htmlFor={`wl-${key}`} className="font-serif text-sm leading-tight cursor-pointer">
                  {label}
                  {hintText && <span className="block text-[11px] text-ink/40 font-normal">{hintText}</span>}
                </Label>
              </div>
            );
          })}
        </div>

        {options.artistBio && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">Artist bios</p>
            {biosLoading ? (
              <p className="flex items-center gap-2 text-xs font-serif text-ink/50">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading bios…
              </p>
            ) : biosError ? (
              <p className="text-xs font-serif text-red-700">
                {biosError}{' '}
                <button type="button" className="underline" onClick={() => void fetchBios()}>
                  Try again
                </button>
              </p>
            ) : artistBios && artistBios.length === 0 ? (
              <p className="text-xs font-serif text-ink/50">No artists found for these works.</p>
            ) : (
              <div className="space-y-3">
                {(artistBios ?? []).map((artist) => (
                  <div key={artist.key} className="space-y-1">
                    <Label
                      htmlFor={`wl-bio-${artist.key}`}
                      className="flex items-baseline justify-between gap-2 font-serif text-sm"
                    >
                      <span>{artist.name}</span>
                      <span className="text-[11px] font-normal text-ink/40">
                        {artist.artworkIds.length} {artist.artworkIds.length === 1 ? 'label' : 'labels'}
                      </span>
                    </Label>
                    <Textarea
                      id={`wl-bio-${artist.key}`}
                      value={bioText(artist)}
                      onChange={(e) => changeBioEdits((prev) => ({ ...prev, [artist.key]: e.target.value }))}
                      placeholder="No bio on their profile. Type one for these labels, or leave blank."
                      rows={3}
                      className="font-serif text-sm"
                    />
                    {bioEdits[artist.key] !== undefined && bioEdits[artist.key] !== artist.bio && (
                      <button
                        type="button"
                        className="text-[11px] font-serif text-ink/40 underline hover:text-ink"
                        onClick={() =>
                          changeBioEdits((prev) => {
                            const next = { ...prev };
                            delete next[artist.key];
                            return next;
                          })
                        }
                      >
                        {artist.bio ? 'Reset to profile bio' : 'Clear'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-2 text-[11px] font-serif text-ink/40">
              Edits are for printing only and are remembered on this device. They don&apos;t change
              anyone&apos;s profile.
            </p>
          </div>
        )}

        {options.qrCode && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">QR code position</p>
            <div className="flex gap-2">
              {(
                [
                  ['top', 'Top right'],
                  ['bottom', 'Bottom right'],
                ] as const
              ).map(([value, text]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, qrPosition: value }))}
                  aria-pressed={options.qrPosition === value}
                  className={`flex-1 rounded-md border px-3 py-2 text-xs font-serif transition-colors ${
                    options.qrPosition === value
                      ? 'border-wine bg-wine/10 text-wine'
                      : 'border-wine/20 text-ink/60 hover:border-wine/40'
                  }`}
                >
                  {text}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">Label size</p>
          <div className="flex gap-2">
            {(
              [
                ['standard', 'Standard · 4 × 2.5 in'],
                ['large', 'Large · 5 × 3.5 in'],
              ] as const
            ).map(([value, text]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOptions((o) => ({ ...o, size: value }))}
                aria-pressed={options.size === value}
                className={`flex-1 rounded-md border px-3 py-2 text-xs font-serif transition-colors ${
                  options.size === value
                    ? 'border-wine bg-wine/10 text-wine'
                    : 'border-wine/20 text-ink/60 hover:border-wine/40'
                }`}
              >
                {text}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={count === 0}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print labels
          </Button>
        </DialogFooter>
      </EditorialDialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { loadPriceSymbolPref, savePriceSymbolPref } from '~/lib/print-price';
import type { ArtistBio } from '../_helpers/artist-bios';
import {
  CATALOG_STYLES,
  DEFAULT_CATALOG_OPTIONS,
  type CatalogArtist,
  type CatalogOptions,
  type CatalogStyle,
} from '../_helpers/catalog-print-html';

type ToggleKey = Exclude<keyof CatalogOptions, 'style' | 'coverName'>;

const TOGGLES: Array<{ key: ToggleKey; label: string; hint?: string; requires?: ToggleKey }> = [
  { key: 'descriptions', label: 'Descriptions' },
  { key: 'provenance', label: 'Provenance', hint: 'Owners, auctions, exhibitions' },
  { key: 'qrCodes', label: 'QR codes', hint: 'Each work’s certificate' },
  { key: 'artistBios', label: 'Artist bios', hint: 'From their profiles' },
  { key: 'checklist', label: 'Checklist', hint: 'Every work in a table' },
  { key: 'prices', label: 'Price list' },
  { key: 'priceSymbol', label: 'Dollar sign', hint: 'Show $ before prices', requires: 'prices' },
];

function loadOptions(key: string): CatalogOptions {
  const priceSymbol = loadPriceSymbolPref();
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) return { ...DEFAULT_CATALOG_OPTIONS, ...(JSON.parse(raw) as Partial<CatalogOptions>), priceSymbol };
  } catch {
    // storage unavailable
  }
  return { ...DEFAULT_CATALOG_OPTIONS, priceSymbol };
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

/** Small drawings of each style's first pages, so the choice is visual. */
function StyleThumb({ style }: { style: CatalogStyle }) {
  if (style === 'editorial') {
    return (
      <div className="flex h-24 gap-1" aria-hidden="true">
        {[0, 1].map((p) => (
          <div key={p} className="flex flex-1 flex-col border border-black/15 bg-[#f6f1e7] p-1.5">
            <div className="flex items-baseline justify-between border-b border-[#1c1814] pb-0.5">
              <span className="font-fraunces text-[7px] italic leading-none text-[#1c1814]">
                Provenance<span className="not-italic text-[#e2462c]">.</span>
              </span>
              <span className="h-[2px] w-3 bg-[#e2462c]" />
            </div>
            {p === 0 ? (
              <>
                <span className="mt-1.5 font-fraunces text-[9px] italic leading-none text-[#1c1814]">
                  Title<span className="not-italic text-[#e2462c]">.</span>
                </span>
                <div className="mt-1 flex-1 border border-[#1c1814]/50 bg-[#e8dfd0]" />
              </>
            ) : (
              <div className="mt-1 grid flex-1 grid-cols-2 grid-rows-2 gap-0.5">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="flex flex-col border-t border-[#1c1814]/70 pt-px">
                    <div className="flex-1 bg-[#e8dfd0]" />
                    <span className="mt-px h-[2px] w-2 bg-[#e2462c]" />
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (style === 'monograph') {
    return (
      <div className="flex h-24 gap-1" aria-hidden="true">
        <div className="flex flex-1 flex-col items-center justify-center bg-[#121212] p-1.5">
          <div className="h-9 w-8 bg-[#5d5650]" />
          <span className="mt-1.5 h-[3px] w-8 bg-[#f2efe9]" />
          <span className="mt-1 h-px w-3 bg-[#6d6862]" />
        </div>
        <div className="flex flex-1 flex-col items-center border border-black/15 bg-white p-1.5">
          <div className="w-full flex-1 bg-[#d9d4cd]" />
          <span className="mt-1 h-[2px] w-6 bg-[#555]" />
          <span className="mt-0.5 h-[2px] w-8 bg-[#999]" />
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-24 gap-1" aria-hidden="true">
      <div className="flex flex-1 flex-col border border-black/15 bg-white p-1.5">
        <div className="border-t-2 border-[#0e0b07] pt-0.5">
          <span className="block h-[4px] w-10 bg-[#0e0b07]" />
        </div>
        <div className="mt-1.5 flex-1 bg-[#e5ded4]" />
      </div>
      <div className="flex flex-1 flex-col gap-1 border border-black/15 bg-white p-1.5">
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-1 gap-1 border-b border-black/10 pb-0.5 last:border-0">
            <div className="w-[55%] bg-[#e5ded4]" />
            <div className="flex flex-1 flex-col gap-0.5 pt-0.5">
              <span className="h-[2px] w-full bg-[#0e0b07]" />
              <span className="h-[2px] w-2/3 bg-[#999]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Catalog options: the look (standard, editorial or monograph) and what goes
 * in. Used by the exhibition and collection print menus. Artist bios use the
 * same printing edits as the wall labels dialog.
 */
export function CatalogDialog({
  open,
  onOpenChange,
  count,
  optionsStorageKey,
  bioEditsStorageKey,
  loadBios,
  hasPrices,
  hasProvenance,
  priceHint,
  ownerName,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Number of works in the catalog. */
  count: number;
  optionsStorageKey: string;
  /** Same key as the wall labels dialog, so bio edits are shared. */
  bioEditsStorageKey: string;
  loadBios: () => Promise<ArtistBio[]>;
  /** Whether any work has a price that may be printed. */
  hasPrices: boolean;
  /** Whether provenance fields exist for these works (collection works). */
  hasProvenance: boolean;
  priceHint?: string;
  /** The gallery, institution or owner name printed above the title. */
  ownerName?: string | null;
  onPrint: (options: CatalogOptions, artists: CatalogArtist[]) => void;
}) {
  const [options, setOptions] = useState<CatalogOptions>(DEFAULT_CATALOG_OPTIONS);
  const [bios, setBios] = useState<ArtistBio[] | null>(null);
  const [biosLoading, setBiosLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bios load ahead of Print: opening the print window after an await would
  // be blocked as a pop-up.
  const fetchBios = async () => {
    setBiosLoading(true);
    setError(null);
    try {
      setBios(await loadBios());
    } catch (err) {
      console.error('[Catalog] Load artist bios failed', err);
      setError(err instanceof Error ? err.message : 'Could not load artist bios.');
    } finally {
      setBiosLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    const saved = loadOptions(optionsStorageKey);
    setOptions(saved);
    setBios(null);
    setError(null);
    if (saved.artistBios) void fetchBios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const toggles = TOGGLES.filter(
    (t) => (t.key !== 'provenance' || hasProvenance) && ((t.key !== 'prices' && t.key !== 'priceSymbol') || hasPrices),
  );

  const handlePrint = () => {
    try {
      window.localStorage.setItem(optionsStorageKey, JSON.stringify(options));
    } catch {
      // ignore
    }
    savePriceSymbolPref(options.priceSymbol);
    const edits = options.artistBios ? loadBioEdits(bioEditsStorageKey) : {};
    const artists: CatalogArtist[] = options.artistBios
      ? (bios ?? [])
          .map((a) => ({ name: a.name, bio: (edits[a.key] ?? a.bio).trim() }))
          .filter((a) => a.bio)
      : [];
    console.log('[Catalog] Print', { style: options.style, coverName: options.coverName, count, artists: artists.length });
    onPrint(
      { ...options, prices: options.prices && hasPrices, provenance: options.provenance && hasProvenance },
      artists,
    );
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditorialDialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Catalog</DialogTitle>
          <DialogDescription>
            Pick a look and what to include. {count} {count === 1 ? 'work' : 'works'}, printed on US Letter.
          </DialogDescription>
        </DialogHeader>

        <div>
          <p className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink/40">Style</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Catalog style">
            {CATALOG_STYLES.map((s) => {
              const on = options.style === s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setOptions((o) => ({ ...o, style: s.value }))}
                  className={`flex flex-col gap-2 border p-2 text-left font-serif transition-colors ${
                    on ? 'border-wine bg-wine/10' : 'border-wine/20 hover:border-wine/40'
                  }`}
                >
                  <StyleThumb style={s.value} />
                  <span className={`text-sm ${on ? 'text-wine' : 'text-ink'}`}>
                    {s.label}
                    <span className="block text-[11px] leading-tight text-ink/45">{s.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink/40">Name on cover</p>
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Name on cover">
            {(
              [
                { value: 'owner', label: ownerName?.trim() || 'Your name', hint: 'Gallery or owner' },
                { value: 'provenance', label: 'Provenance', hint: 'Our brand' },
              ] as const
            ).map((c) => {
              const on = options.coverName === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setOptions((o) => ({ ...o, coverName: c.value }))}
                  className={`border p-2 text-left font-serif text-sm transition-colors ${
                    on ? 'border-wine bg-wine/10 text-wine' : 'border-wine/20 text-ink hover:border-wine/40'
                  }`}
                >
                  <span className="block truncate">{c.label}</span>
                  <span className="block text-[11px] leading-tight text-ink/45">{c.hint}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="mb-2 font-serif text-[10px] uppercase tracking-widest text-ink/40">Include</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {toggles.map(({ key, label, hint, requires }) => {
              const disabled = requires ? !options[requires] : false;
              const hintText = key === 'prices' ? (priceHint ?? hint) : hint;
              return (
                <div key={key} className={`flex items-start gap-2 ${disabled ? 'opacity-40' : ''}`}>
                  <Checkbox
                    id={`cat-${key}`}
                    checked={options[key]}
                    disabled={disabled}
                    onCheckedChange={(checked) => {
                      setOptions((o) => ({ ...o, [key]: checked === true }));
                      if (key === 'artistBios' && checked === true && !bios && !biosLoading) void fetchBios();
                    }}
                    className="mt-0.5 border-wine/30"
                  />
                  <Label htmlFor={`cat-${key}`} className="cursor-pointer font-serif text-sm leading-tight">
                    {label}
                    {hintText && <span className="block text-[11px] font-normal text-ink/40">{hintText}</span>}
                  </Label>
                </div>
              );
            })}
          </div>
          {options.artistBios && biosLoading && (
            <p className="mt-3 flex items-center gap-2 font-serif text-xs text-ink/50">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Loading artist bios…
            </p>
          )}
          {options.artistBios && bios && !bios.some((b) => b.bio.trim()) && (
            <p className="mt-3 font-serif text-xs text-ink/50">
              None of these artists has a bio yet. Add one in Wall Labels to print it here.
            </p>
          )}
          {error && (
            <p className="mt-3 font-serif text-xs text-red-700">
              {error}{' '}
              <button type="button" className="underline" onClick={() => void fetchBios()}>
                Try again
              </button>
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handlePrint} disabled={count === 0 || (options.artistBios && biosLoading)}>
            {options.artistBios && biosLoading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-3.5 w-3.5" />
            )}
            Print catalog
          </Button>
        </DialogFooter>
      </EditorialDialogContent>
    </Dialog>
  );
}

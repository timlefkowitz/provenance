'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { loadPriceSymbolPref, savePriceSymbolPref } from '~/lib/print-price';
import type { ArtistBio } from '../_helpers/artist-bios';
import {
  DEFAULT_LABEL_OPTIONS,
  LABEL_GEOMETRY,
  type LabelQr,
  type WallLabelOptions,
} from '../_helpers/exhibition-print-html';
import { composeStyledQr, DEFAULT_QR_STYLE, readQrStyle, type QrStyleSettings } from '../_helpers/qr-style';
import { QrStylePicker } from './qr-style-picker';
import { ExtraLabelQrsEditor, readExtraQrs, resolveExtraQrs, type ExtraLabelQr } from './extra-label-qrs';

export type WallLabelToggleKey = Exclude<keyof WallLabelOptions, 'size' | 'qrPosition' | 'layout'>;

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

function loadExtraQrs(key: string): ExtraLabelQr[] {
  try {
    const raw = window.localStorage.getItem(key);
    return readExtraQrs(raw ? (JSON.parse(raw) as unknown) : []);
  } catch {
    return [];
  }
}

function loadQrStyle(key: string): QrStyleSettings {
  try {
    const raw = window.localStorage.getItem(key);
    return readQrStyle({ qr: raw ? (JSON.parse(raw) as unknown) : null });
  } catch {
    return DEFAULT_QR_STYLE;
  }
}

const inches = (n: number) => `${n}`.replace(/\.0+$/, '');

type BioWithProfile = ArtistBio & { profileBio?: string };

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
  extraQrStorageKey,
  qrStyleStorageKey,
  sampleQrUrl,
  loadBios,
  saveBio,
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
  /** localStorage key for extra QR codes (links or uploaded images). */
  extraQrStorageKey: string;
  /** localStorage key for the certificate QR code's style on the labels. */
  qrStyleStorageKey: string;
  /** One work's certificate URL, for the style preview. */
  sampleQrUrl: string;
  loadBios: () => Promise<BioWithProfile[]>;
  /**
   * Save a bio for the show (exhibitions). When set, edits are stored on the
   * server as the curator's show copy instead of on this device; null resets
   * to the profile bio.
   */
  saveBio?: (artistKey: string, bio: string | null) => Promise<{ success: boolean; error?: string }>;
  /** Per-toggle hint text, e.g. where the price comes from. */
  hints?: Partial<Record<WallLabelToggleKey, string>>;
  /** Artwork id → bio text for the works whose artist has one. */
  /** extraQrs gives the added QR codes for each artwork id; qrStyle styles the certificate code. */
  onPrint: (
    options: WallLabelOptions,
    biosByArtwork: Map<string, string>,
    extraQrs: (artworkId: string) => LabelQr[],
    qrStyle: QrStyleSettings,
  ) => void;
}) {
  const [options, setOptions] = useState<WallLabelOptions>(DEFAULT_LABEL_OPTIONS);
  const [artistBios, setArtistBios] = useState<BioWithProfile[] | null>(null);
  const [savingBioKey, setSavingBioKey] = useState<string | null>(null);
  const [biosLoading, setBiosLoading] = useState(false);
  const [biosError, setBiosError] = useState<string | null>(null);
  const [bioEdits, setBioEdits] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<ExtraLabelQr[]>([]);
  const extraSvgRef = useRef<HTMLDivElement>(null);
  const [qrStyle, setQrStyle] = useState<QrStyleSettings>(DEFAULT_QR_STYLE);
  const [qrBaseSvg, setQrBaseSvg] = useState('');
  const [stylePickerOpen, setStylePickerOpen] = useState(false);

  const changeQrStyle = (next: QrStyleSettings) => {
    setQrStyle(next);
    saveJson(qrStyleStorageKey, next);
  };

  const fetchBios = async () => {
    setBiosLoading(true);
    setBiosError(null);
    try {
      const loaded = await loadBios();
      const localEdits = loadBioEdits(bioEditsStorageKey);
      if (saveBio) {
        // One-time move of edits made on this device into the show copy.
        const pending = loaded.filter((a) => localEdits[a.key] !== undefined && localEdits[a.key] !== a.bio);
        for (const a of pending) {
          const res = await saveBio(a.key, localEdits[a.key]?.trim() ? localEdits[a.key]! : null);
          if (res.success) a.bio = localEdits[a.key] ?? '';
        }
        if (pending.length) console.log('[Print] Moved device bio edits to the show', { count: pending.length });
        try {
          window.localStorage.removeItem(bioEditsStorageKey);
        } catch {
          // ignore
        }
        setArtistBios(loaded);
        setBioEdits({});
      } else {
        setArtistBios(loaded);
        setBioEdits(localEdits);
      }
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
    const savedExtras = loadExtraQrs(extraQrStorageKey);
    setExtras(savedExtras);
    setQrStyle(loadQrStyle(qrStyleStorageKey));
    setStylePickerOpen(false);
    // Artists drive both bios and "only on this artist's labels".
    if (saved.artistBio || savedExtras.length > 0) void fetchBios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const bioText = (artist: ArtistBio) => bioEdits[artist.key] ?? artist.bio;

  const changeBioEdits = (update: (prev: Record<string, string>) => Record<string, string>) => {
    setBioEdits((prev) => {
      const next = update(prev);
      if (!saveBio) saveJson(bioEditsStorageKey, next);
      return next;
    });
  };

  /** Server mode: store the bio as the show copy (null = back to profile). */
  const commitBio = async (artist: BioWithProfile, value: string | null) => {
    if (!saveBio) return;
    setSavingBioKey(artist.key);
    const res = await saveBio(artist.key, value?.trim() ? value : null);
    setSavingBioKey(null);
    if (!res.success) {
      setBiosError(res.error || 'Could not save the bio.');
      return;
    }
    const saved = value?.trim() ? value : artist.profileBio ?? '';
    setArtistBios((prev) => (prev ?? []).map((a) => (a.key === artist.key ? { ...a, bio: saved } : a)));
    setBioEdits((prev) => {
      const next = { ...prev };
      delete next[artist.key];
      return next;
    });
  };

  const changeExtras = (next: ExtraLabelQr[]) => {
    setExtras(next);
    saveJson(extraQrStorageKey, next);
    if (next.length > 0 && !artistBios && !biosLoading) void fetchBios();
  };

  const handlePrint = () => {
    saveJson(optionsStorageKey, options);
    savePriceSymbolPref(options.priceSymbol);
    const biosByArtwork = new Map<string, string>();
    for (const artist of artistBios ?? []) {
      const text = bioText(artist).trim();
      if (text) for (const id of artist.artworkIds) biosByArtwork.set(id, text);
    }
    onPrint(options, biosByArtwork, resolveExtraQrs(extras, artistBios, extraSvgRef.current), qrStyle);
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
                      onBlur={() => {
                        if (saveBio && bioEdits[artist.key] !== undefined && bioEdits[artist.key] !== artist.bio) {
                          void commitBio(artist, bioEdits[artist.key] ?? null);
                        }
                      }}
                      placeholder="No bio on their profile. Type one for these labels, or leave blank."
                      rows={3}
                      className="font-serif text-sm"
                    />
                    {saveBio && savingBioKey === artist.key && (
                      <p className="text-[11px] font-serif text-ink/40">Saving…</p>
                    )}
                    {saveBio && savingBioKey !== artist.key && artist.profileBio !== undefined && bioText(artist) !== artist.profileBio && (
                      <button
                        type="button"
                        className="text-[11px] font-serif text-ink/40 underline hover:text-ink"
                        onClick={() => void commitBio(artist, null)}
                      >
                        {artist.profileBio ? 'Reset to profile bio' : 'Clear'}
                      </button>
                    )}
                    {!saveBio && bioEdits[artist.key] !== undefined && bioEdits[artist.key] !== artist.bio && (
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
              {saveBio
                ? "Edits are saved for this show and used on labels, the catalog and the show's Artists tab. They don't change the artist's profile; send them to the artist from the Curator view."
                : "Edits are for printing only and are remembered on this device. They don't change anyone's profile."}
            </p>
          </div>
        )}

        {options.qrCode && sampleQrUrl && (
          <div className="pt-2">
            <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">QR code style</p>
            {/* Plain code (level H, no margin) that every style is composed from. */}
            <div
              aria-hidden="true"
              className="hidden"
              ref={(el) => {
                const svg = el?.innerHTML ?? '';
                if (svg && svg !== qrBaseSvg) setQrBaseSvg(svg);
              }}
            >
              <QRCodeSVG value={sampleQrUrl} size={256} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
            </div>
            <div className="flex items-center gap-3">
              <div
                className="w-16 flex-none rounded border border-wine/15 bg-white p-1 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
                role="img"
                aria-label="Label QR code preview"
                dangerouslySetInnerHTML={{ __html: qrBaseSvg ? composeStyledQr(qrBaseSvg, qrStyle) : '' }}
              />
              <div className="min-w-0 text-xs font-serif text-ink/60">
                <p>Same choices as the exhibition QR code. Remembered on this device.</p>
                <button
                  type="button"
                  className="mt-1 text-wine underline hover:text-wine/80"
                  onClick={() => setStylePickerOpen((v) => !v)}
                  aria-expanded={stylePickerOpen}
                >
                  {stylePickerOpen ? 'Done' : 'Change style'}
                </button>
              </div>
            </div>
            {stylePickerOpen && (
              <div className="mt-3">
                <QrStylePicker
                  baseSvg={qrBaseSvg}
                  qrStyle={qrStyle}
                  onQrStyleChange={changeQrStyle}
                  logTag="[Wall labels]"
                />
              </div>
            )}
            {qrStyle.style !== 'plain' && (
              <p className="mt-2 text-[11px] font-serif text-ink/40">
                Labels print small codes; test-scan one before printing the full set.
              </p>
            )}
          </div>
        )}

        {(options.qrCode || extras.length > 0) && (
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

        <ExtraLabelQrsEditor
          extras={extras}
          onChange={changeExtras}
          artists={artistBios}
          artistsLoading={biosLoading}
          svgRootRef={extraSvgRef}
        />

        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">Layout</p>
          <div className="flex gap-2">
            {(
              [
                ['institutional', 'Institutional', 'Same height, neat grid'],
                ['compact', 'Compact', 'Fits the text, most per page'],
              ] as const
            ).map(([value, text, hint]) => (
              <button
                key={value}
                type="button"
                onClick={() => setOptions((o) => ({ ...o, layout: value }))}
                aria-pressed={options.layout === value}
                className={`flex-1 rounded-md border px-3 py-2 text-left text-xs font-serif transition-colors ${
                  options.layout === value
                    ? 'border-wine bg-wine/10 text-wine'
                    : 'border-wine/20 text-ink/60 hover:border-wine/40'
                }`}
              >
                {text}
                <span className="block text-[11px] text-ink/40">{hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-2">
          <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">Label size</p>
          <div className="flex gap-2">
            {(['standard', 'large'] as const).map((value) => {
              const g = LABEL_GEOMETRY[value];
              const perPage = g.cols * g.rows;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOptions((o) => ({ ...o, size: value }))}
                  aria-pressed={options.size === value}
                  className={`flex-1 rounded-md border px-3 py-2 text-left text-xs font-serif transition-colors ${
                    options.size === value
                      ? 'border-wine bg-wine/10 text-wine'
                      : 'border-wine/20 text-ink/60 hover:border-wine/40'
                  }`}
                >
                  {value === 'standard' ? 'Standard' : 'Large'} ·{' '}
                  {options.layout === 'compact'
                    ? `${inches(g.widthIn)} in wide`
                    : `${inches(g.widthIn)} × ${inches(g.heightIn)} in`}
                  <span className="block text-[11px] text-ink/40">
                    {options.layout === 'compact'
                      ? `2 across, ${g.orientation}`
                      : `${perPage} per page, ${g.orientation}`}
                  </span>
                </button>
              );
            })}
          </div>
          {options.layout === 'institutional' && (
            <p className="mt-2 text-[11px] font-serif text-ink/40">
              Long labels get slightly smaller text so every label keeps the same height.
            </p>
          )}
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

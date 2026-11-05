'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronDown, Grid3x3, List, Loader2, Printer, QrCode, Tag } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
import { Textarea } from '@kit/ui/textarea';
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { openPrintWindow } from '~/app/artworks/edit-provenance/_components/print-menu';
import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';
import {
  getExhibitionArtistBios,
  type ExhibitionArtistBio,
} from '../_actions/get-exhibition-artist-bios';
import {
  buildArtworkQrSheetHtml,
  buildChecklistHtml,
  buildExhibitionQrHtml,
  buildWallLabelsHtml,
  DEFAULT_LABEL_OPTIONS,
  type WallLabelOptions,
} from '../_helpers/exhibition-print-html';
import { updateExhibitionQrStyle } from '../_actions/update-exhibition-qr-style';
import { composeStyledQr, readQrStyle, type QrStyleSettings } from '../_helpers/qr-style';
import { ExhibitionQrDialogContent } from './exhibition-qr-dialog';

const LABEL_OPTIONS_KEY = 'provenance.exhibition.wallLabelOptions';

const FIELD_TOGGLES: Array<{ key: Exclude<keyof WallLabelOptions, 'size'>; label: string; hint?: string }> = [
  { key: 'year', label: 'Year' },
  { key: 'medium', label: 'Medium' },
  { key: 'dimensions', label: 'Dimensions' },
  { key: 'edition', label: 'Edition' },
  { key: 'price', label: 'Price', hint: 'Exhibition list price' },
  { key: 'creditLine', label: 'Credit line', hint: 'Only when marked public' },
  { key: 'description', label: 'Description' },
  { key: 'artistBio', label: 'Artist bio', hint: 'From their profile; editable below' },
  { key: 'qrCode', label: 'QR code', hint: 'Links to the certificate' },
];

function loadLabelOptions(): WallLabelOptions {
  try {
    const raw = window.localStorage.getItem(LABEL_OPTIONS_KEY);
    if (raw) return { ...DEFAULT_LABEL_OPTIONS, ...(JSON.parse(raw) as Partial<WallLabelOptions>) };
  } catch {
    // storage unavailable — use defaults
  }
  return DEFAULT_LABEL_OPTIONS;
}

function saveLabelOptions(options: WallLabelOptions) {
  try {
    window.localStorage.setItem(LABEL_OPTIONS_KEY, JSON.stringify(options));
  } catch {
    // ignore
  }
}

/** Per-exhibition bio edits on this device, keyed by ExhibitionArtistBio.key. */
const bioEditsKey = (exhibitionId: string) => `provenance.exhibition.artistBios.${exhibitionId}`;

function loadBioEdits(exhibitionId: string): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(bioEditsKey(exhibitionId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function saveBioEdits(exhibitionId: string, edits: Record<string, string>) {
  try {
    window.localStorage.setItem(bioEditsKey(exhibitionId), JSON.stringify(edits));
  } catch {
    // ignore
  }
}

const noopSubscribe = () => () => {};

// ── Component ─────────────────────────────────────────────────────────────────

export function ExhibitionPrintMenu({
  exhibition,
  ownerName,
}: {
  exhibition: ExhibitionWithDetails;
  ownerName: string | null;
}) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  // The show's QR style (exhibitions.metadata.qr), used by the poster,
  // downloads, artwork QR sheet and checklist. Wall labels stay plain.
  const [qrStyle, setQrStyle] = useState<QrStyleSettings>(() =>
    readQrStyle((exhibition as { metadata?: unknown }).metadata),
  );

  const saveQrStyle = async (next: QrStyleSettings) => {
    const previous = qrStyle;
    setQrStyle(next);
    const result = await updateExhibitionQrStyle(exhibition.id, next);
    if (!result.success) {
      setQrStyle(previous);
      toast.error(result.error);
    }
  };
  const [options, setOptions] = useState<WallLabelOptions>(DEFAULT_LABEL_OPTIONS);
  const [artistBios, setArtistBios] = useState<ExhibitionArtistBio[] | null>(null);
  const [biosLoading, setBiosLoading] = useState(false);
  const [biosError, setBiosError] = useState<string | null>(null);
  const [bioEdits, setBioEdits] = useState<Record<string, string>>({});
  const qrRef = useRef<HTMLDivElement>(null);

  const loadArtistBios = async () => {
    if (artistBios || biosLoading) return;
    setBiosLoading(true);
    setBiosError(null);
    try {
      const bios = await getExhibitionArtistBios(exhibition.id);
      setArtistBios(bios);
      setBioEdits(loadBioEdits(exhibition.id));
    } catch (err) {
      console.error('[Exhibitions] Load artist bios failed', err);
      setBiosError(err instanceof Error ? err.message : 'Could not load artist bios.');
    } finally {
      setBiosLoading(false);
    }
  };

  const bioText = (artist: ExhibitionArtistBio) => bioEdits[artist.key] ?? artist.bio;

  const updateBio = (key: string, text: string) => {
    setBioEdits((prev) => {
      const next = { ...prev, [key]: text };
      saveBioEdits(exhibition.id, next);
      return next;
    });
  };

  const exhibitionUrl = origin ? `${origin}/exhibitions/${exhibition.id}` : '';
  const hasWorks = exhibition.artworks.length > 0;

  const readQr = (key: string): string =>
    qrRef.current?.querySelector(`[data-qr="${key}"]`)?.innerHTML ?? '';

  /** A hidden level-H code with the show's QR style applied. */
  const readStyled = (key: string): string => {
    const base = readQr(key);
    return base ? composeStyledQr(base, qrStyle) : '';
  };

  const handleExhibitionQr = () => {
    console.log('[Exhibitions] Print exhibition QR', { exhibitionId: exhibition.id });
    openPrintWindow(
      buildExhibitionQrHtml(exhibition, ownerName, readStyled('exhibition'), exhibitionUrl),
      820,
      900,
    );
  };

  const handleChecklist = () => {
    console.log('[Exhibitions] Print checklist', { exhibitionId: exhibition.id });
    openPrintWindow(buildChecklistHtml(exhibition, ownerName, readStyled('exhibition')));
  };

  const handleArtworkQrSheet = () => {
    console.log('[Exhibitions] Print artwork QR sheet', {
      exhibitionId: exhibition.id,
      count: exhibition.artworks.length,
    });
    const qrSvgs = new Map(exhibition.artworks.map((a) => [a.id, readStyled(`sheet-${a.id}`)]));
    openPrintWindow(buildArtworkQrSheetHtml(exhibition, qrSvgs), 860, 760);
  };

  const handleWallLabels = () => {
    console.log('[Exhibitions] Print wall labels', {
      exhibitionId: exhibition.id,
      count: exhibition.artworks.length,
      options,
    });
    saveLabelOptions(options);
    const qrSvgs = new Map(exhibition.artworks.map((a) => [a.id, readQr(a.id)]));
    const biosByArtwork = new Map<string, string>();
    for (const artist of artistBios ?? []) {
      const text = bioText(artist).trim();
      if (text) for (const id of artist.artworkIds) biosByArtwork.set(id, text);
    }
    openPrintWindow(
      buildWallLabelsHtml(exhibition, exhibition.artworks, options, qrSvgs, biosByArtwork),
      960,
      760,
    );
    setLabelsOpen(false);
  };

  return (
    <>
      {/* Hidden QR SVGs — serialised into the print windows. */}
      {origin && (
        <div
          ref={qrRef}
          aria-hidden="true"
          style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', visibility: 'hidden' }}
        >
          <div data-qr="exhibition">
            {/* Level H, no margin, black on white: what composeStyledQr expects. */}
            <QRCodeSVG value={exhibitionUrl} size={512} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
          </div>
          {/* Artwork QR sheet: styled like the exhibition code. */}
          {exhibition.artworks.map((a) => (
            <div key={`sheet-${a.id}`} data-qr={`sheet-${a.id}`}>
              <QRCodeSVG
                value={`${origin}/artworks/${a.id}/certificate?scan=true`}
                size={256}
                level="H"
                marginSize={0}
                fgColor="#000000"
                bgColor="#FFFFFF"
              />
            </div>
          ))}
          {/* Wall labels: plain level M, readable at small sizes. */}
          {exhibition.artworks.map((a) => (
            <div key={a.id} data-qr={a.id}>
              <QRCodeSVG
                value={`${origin}/artworks/${a.id}/certificate?scan=true`}
                size={256}
                level="M"
                marginSize={1}
              />
            </div>
          ))}
        </div>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="font-serif h-8 gap-1.5 border-wine/30 text-wine hover:bg-wine/5 hover:text-wine"
            disabled={!origin}
            title="Print the exhibition QR code, wall labels, artwork QR codes or checklist"
          >
            <Printer className="h-3.5 w-3.5" />
            Print
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setQrOpen(true)} className="font-serif text-xs cursor-pointer">
            <QrCode className="h-3.5 w-3.5 mr-2 opacity-60" />
            Exhibition QR Code…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => {
              const saved = loadLabelOptions();
              setOptions(saved);
              setLabelsOpen(true);
              if (saved.artistBio) void loadArtistBios();
            }}
            disabled={!hasWorks}
            className="font-serif text-xs cursor-pointer"
          >
            <Tag className="h-3.5 w-3.5 mr-2 opacity-60" />
            Wall Labels…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleArtworkQrSheet}
            disabled={!hasWorks}
            className="font-serif text-xs cursor-pointer"
          >
            <Grid3x3 className="h-3.5 w-3.5 mr-2 opacity-60" />
            Artwork QR Codes
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={handleChecklist}
            disabled={!hasWorks}
            className="font-serif text-xs cursor-pointer"
          >
            <List className="h-3.5 w-3.5 mr-2 opacity-60" />
            Checklist of works
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        {qrOpen && (
          <ExhibitionQrDialogContent
            exhibitionId={exhibition.id}
            exhibitionTitle={exhibition.title}
            exhibitionUrl={exhibitionUrl}
            qrStyle={qrStyle}
            onQrStyleChange={(next) => void saveQrStyle(next)}
            onPrint={handleExhibitionQr}
          />
        )}
      </Dialog>

      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <EditorialDialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Wall labels</DialogTitle>
            <DialogDescription>
              Choose what appears on each label. Artist and title are always included.{' '}
              {exhibition.artworks.length} {exhibition.artworks.length === 1 ? 'label' : 'labels'}.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-x-4 gap-y-3 py-2">
            {FIELD_TOGGLES.map(({ key, label, hint }) => (
              <div key={key} className="flex items-start gap-2">
                <Checkbox
                  id={`wl-${key}`}
                  checked={options[key]}
                  onCheckedChange={(checked) => {
                    setOptions((o) => ({ ...o, [key]: checked === true }));
                    if (key === 'artistBio' && checked === true) void loadArtistBios();
                  }}
                  className="mt-0.5 border-wine/30"
                />
                <Label htmlFor={`wl-${key}`} className="font-serif text-sm leading-tight cursor-pointer">
                  {label}
                  {hint && <span className="block text-[11px] text-ink/40 font-normal">{hint}</span>}
                </Label>
              </div>
            ))}
          </div>

          {options.artistBio && (
            <div className="pt-2">
              <p className="text-[10px] uppercase tracking-widest text-ink/40 font-serif mb-2">
                Artist bios
              </p>
              {biosLoading ? (
                <p className="flex items-center gap-2 text-xs font-serif text-ink/50">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading bios…
                </p>
              ) : biosError ? (
                <p className="text-xs font-serif text-red-700">
                  {biosError}{' '}
                  <button type="button" className="underline" onClick={() => void loadArtistBios()}>
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
                        onChange={(e) => updateBio(artist.key, e.target.value)}
                        placeholder="No bio on their profile. Type one for these labels, or leave blank."
                        rows={3}
                        className="font-serif text-sm"
                      />
                      {bioEdits[artist.key] !== undefined && bioEdits[artist.key] !== artist.bio && (
                        <button
                          type="button"
                          className="text-[11px] font-serif text-ink/40 underline hover:text-ink"
                          onClick={() =>
                            setBioEdits((prev) => {
                              const next = { ...prev };
                              delete next[artist.key];
                              saveBioEdits(exhibition.id, next);
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
            <Button variant="outline" onClick={() => setLabelsOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleWallLabels}>
              <Printer className="h-3.5 w-3.5 mr-1.5" />
              Print labels
            </Button>
          </DialogFooter>
        </EditorialDialogContent>
      </Dialog>
    </>
  );
}

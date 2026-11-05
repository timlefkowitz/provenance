'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronDown, Grid3x3, List, Printer, QrCode, Tag } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Label } from '@kit/ui/label';
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
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { openPrintWindow } from '~/app/artworks/edit-provenance/_components/print-menu';
import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';
import {
  buildArtworkQrSheetHtml,
  buildChecklistHtml,
  buildExhibitionQrHtml,
  buildWallLabelsHtml,
  DEFAULT_LABEL_OPTIONS,
  type WallLabelOptions,
} from '../_helpers/exhibition-print-html';
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
  const [options, setOptions] = useState<WallLabelOptions>(DEFAULT_LABEL_OPTIONS);
  const qrRef = useRef<HTMLDivElement>(null);

  const exhibitionUrl = origin ? `${origin}/exhibitions/${exhibition.id}` : '';
  const hasWorks = exhibition.artworks.length > 0;

  const readQr = (key: string): string =>
    qrRef.current?.querySelector(`[data-qr="${key}"]`)?.innerHTML ?? '';

  const handleExhibitionQr = () => {
    console.log('[Exhibitions] Print exhibition QR', { exhibitionId: exhibition.id });
    openPrintWindow(
      buildExhibitionQrHtml(exhibition, ownerName, readQr('exhibition'), exhibitionUrl),
      820,
      900,
    );
  };

  const handleChecklist = () => {
    console.log('[Exhibitions] Print checklist', { exhibitionId: exhibition.id });
    openPrintWindow(buildChecklistHtml(exhibition, ownerName, readQr('exhibition')));
  };

  const handleArtworkQrSheet = () => {
    console.log('[Exhibitions] Print artwork QR sheet', {
      exhibitionId: exhibition.id,
      count: exhibition.artworks.length,
    });
    const qrSvgs = new Map(exhibition.artworks.map((a) => [a.id, readQr(a.id)]));
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
    openPrintWindow(buildWallLabelsHtml(exhibition, exhibition.artworks, options, qrSvgs), 960, 760);
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
            <QRCodeSVG value={exhibitionUrl} size={512} level="M" marginSize={1} />
          </div>
          {exhibition.artworks.map((a) => (
            <div key={a.id} data-qr={a.id}>
              <QRCodeSVG
                value={`${origin}/artworks/${a.id}/certificate`}
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
              setOptions(loadLabelOptions());
              setLabelsOpen(true);
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
                  onCheckedChange={(checked) =>
                    setOptions((o) => ({ ...o, [key]: checked === true }))
                  }
                  className="mt-0.5 border-wine/30"
                />
                <Label htmlFor={`wl-${key}`} className="font-serif text-sm leading-tight cursor-pointer">
                  {label}
                  {hint && <span className="block text-[11px] text-ink/40 font-normal">{hint}</span>}
                </Label>
              </div>
            ))}
          </div>

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

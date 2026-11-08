'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronDown, Grid3x3, List, Printer, QrCode, Tag } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Dialog } from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import { loadPriceSymbolPref, savePriceSymbolPref } from '~/lib/print-price';
import { openPrintWindow } from '~/app/artworks/edit-provenance/_components/print-menu';
import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';
import { getExhibitionArtistBios } from '../_actions/get-exhibition-artist-bios';
import {
  buildArtworkQrSheetHtml,
  buildChecklistHtml,
  buildExhibitionQrHtml,
  buildWallLabelsHtml,
  exhibitionLabelItems,
  posterDefaults,
  type LabelQr,
  type WallLabelOptions,
} from '../_helpers/exhibition-print-html';
import { updateExhibitionQrStyle } from '../_actions/update-exhibition-qr-style';
import { composeStyledQr, readQrStyle, type QrStyleSettings } from '../_helpers/qr-style';
import {
  readPosterOverrides,
  resolvePosterText,
  type PosterOverrides,
} from '../_helpers/poster-text';
import { updateExhibitionPosterText } from '../_actions/update-exhibition-poster-text';
import { ExhibitionQrDialogContent } from './exhibition-qr-dialog';
import { WallLabelsDialog } from './wall-labels-dialog';

const LABEL_OPTIONS_KEY = 'provenance.exhibition.wallLabelOptions';
/** Per-exhibition bio edits on this device, keyed by ArtistBio.key. */
const bioEditsKey = (exhibitionId: string) => `provenance.exhibition.artistBios.${exhibitionId}`;

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

  // Edits to the poster's text (exhibitions.metadata.posterText), saved
  // shortly after typing stops so everyone who manages the show prints the same.
  const [posterOverrides, setPosterOverrides] = useState<PosterOverrides>(() =>
    readPosterOverrides((exhibition as { metadata?: { posterText?: unknown } }).metadata?.posterText),
  );
  const posterSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const changePosterText = (next: PosterOverrides) => {
    setPosterOverrides(next);
    if (posterSaveTimer.current) clearTimeout(posterSaveTimer.current);
    posterSaveTimer.current = setTimeout(() => {
      void updateExhibitionPosterText(exhibition.id, next).then((result) => {
        if (!result.success) toast.error(result.error);
      });
    }, 800);
  };

  const saveQrStyle = async (next: QrStyleSettings) => {
    const previous = qrStyle;
    setQrStyle(next);
    const result = await updateExhibitionQrStyle(exhibition.id, next);
    if (!result.success) {
      setQrStyle(previous);
      toast.error(result.error);
    }
  };
  const [priceSymbol, setPriceSymbol] = useState(true);
  const qrRef = useRef<HTMLDivElement>(null);

  const exhibitionUrl = origin ? `${origin}/exhibitions/${exhibition.id}` : '';
  const hasWorks = exhibition.artworks.length > 0;
  const hasPrices = exhibition.artworks.some((a) => a.listPriceDisplay?.trim());

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
      buildExhibitionQrHtml(
        resolvePosterText(posterDefaults(exhibition, ownerName, exhibitionUrl), posterOverrides),
        readStyled('exhibition'),
      ),
      820,
      900,
    );
  };

  const handleChecklist = () => {
    console.log('[Exhibitions] Print checklist', { exhibitionId: exhibition.id });
    openPrintWindow(buildChecklistHtml(exhibition, ownerName, readStyled('exhibition'), priceSymbol));
  };

  const handleArtworkQrSheet = () => {
    console.log('[Exhibitions] Print artwork QR sheet', {
      exhibitionId: exhibition.id,
      count: exhibition.artworks.length,
    });
    const qrSvgs = new Map(exhibition.artworks.map((a) => [a.id, readStyled(`sheet-${a.id}`)]));
    openPrintWindow(buildArtworkQrSheetHtml(exhibition.title, exhibition.artworks, qrSvgs), 860, 760);
  };

  const handleWallLabels = (
    options: WallLabelOptions,
    biosByArtwork: Map<string, string>,
    extraQrs: (artworkId: string) => LabelQr[],
  ) => {
    console.log('[Exhibitions] Print wall labels', {
      exhibitionId: exhibition.id,
      count: exhibition.artworks.length,
      options,
    });
    setPriceSymbol(options.priceSymbol);
    const qrSvgs = new Map(exhibition.artworks.map((a) => [a.id, readQr(a.id)]));
    openPrintWindow(
      buildWallLabelsHtml(exhibition.title, exhibitionLabelItems(exhibition.artworks), options, qrSvgs, biosByArtwork, extraQrs),
      960,
      760,
    );
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

      <DropdownMenu
        onOpenChange={(open) => {
          if (open) setPriceSymbol(loadPriceSymbolPref());
        }}
      >
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
            onSelect={() => setLabelsOpen(true)}
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
          {hasPrices && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={priceSymbol}
                onCheckedChange={(checked) => {
                  setPriceSymbol(checked);
                  savePriceSymbolPref(checked);
                }}
                onSelect={(e) => e.preventDefault()}
                className="font-serif text-xs cursor-pointer"
              >
                Dollar sign on prices
              </DropdownMenuCheckboxItem>
            </>
          )}
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
            posterDefaults={posterDefaults(exhibition, ownerName, exhibitionUrl)}
            posterOverrides={posterOverrides}
            onPosterOverridesChange={changePosterText}
            onPrint={handleExhibitionQr}
          />
        )}
      </Dialog>

      <WallLabelsDialog
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
        count={exhibition.artworks.length}
        optionsStorageKey={LABEL_OPTIONS_KEY}
        extraQrStorageKey={`provenance.exhibition.labelQrs.${exhibition.id}`}
        bioEditsStorageKey={bioEditsKey(exhibition.id)}
        loadBios={() => getExhibitionArtistBios(exhibition.id)}
        hints={{ price: 'Exhibition list price', creditLine: 'Only when marked public' }}
        onPrint={handleWallLabels}
      />
    </>
  );
}

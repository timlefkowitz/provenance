'use client';

import { useRef, useState, useSyncExternalStore } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { BookOpen, Camera, ChevronDown, Grid3x3, List, Printer, QrCode, Tag } from 'lucide-react';
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
  buildWallGroupLabelHtml,
  buildExhibitionQrHtml,
  buildWallLabelsHtml,
  exhibitionLabelItems,
  posterDefaults,
  type LabelQr,
  type WallGroupLabelOptions,
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
import { WallScanDialog } from './wall-scan-dialog';
import { CatalogDialog } from './catalog-dialog';
import {
  buildCatalogHtml,
  type CatalogArtist,
  type CatalogItem,
  type CatalogOptions,
} from '../_helpers/catalog-print-html';
import { stripMarkdown } from '~/lib/strip-markdown';

const LABEL_OPTIONS_KEY = 'provenance.exhibition.wallLabelOptions';
const CATALOG_OPTIONS_KEY = 'provenance.exhibition.catalogOptions';
/** Per-exhibition bio edits on this device, keyed by ArtistBio.key. */
const bioEditsKey = (exhibitionId: string) => `provenance.exhibition.artistBios.${exhibitionId}`;

const noopSubscribe = () => () => {};

// ── Component ─────────────────────────────────────────────────────────────────

export function ExhibitionPrintMenu({
  exhibition,
  ownerName,
  selectedArtworkIds,
}: {
  exhibition: ExhibitionWithDetails;
  ownerName: string | null;
  /**
   * When set, wall labels, artwork QR codes and the checklist print only these
   * works (curator mode's selection). The show's QR poster is unaffected.
   */
  selectedArtworkIds?: Set<string>;
}) {
  const origin = useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => '',
  );
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [wallScanOpen, setWallScanOpen] = useState(false);
  /** Hanging order from a wall scan; while set, wall labels print just these works in this order. */
  const [wallOrder, setWallOrder] = useState<string[] | null>(null);
  // The show's QR style (exhibitions.metadata.qr), used by the poster,
  // downloads, artwork QR sheet and checklist. Wall labels have their own
  // style, picked in the labels dialog.
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
  // What the show's QR codes encode: the page, marked so the scan is counted.
  const exhibitionQrUrl = exhibitionUrl ? `${exhibitionUrl}?scan=poster` : '';
  const printArtworks = selectedArtworkIds
    ? exhibition.artworks.filter((a) => selectedArtworkIds.has(a.id))
    : exhibition.artworks;
  const hasWorks = printArtworks.length > 0;
  const labelArtworks = wallOrder
    ? wallOrder.flatMap((id) => exhibition.artworks.find((a) => a.id === id) ?? [])
    : printArtworks;
  const hasPrices = printArtworks.some((a) => a.listPriceDisplay?.trim());

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
    openPrintWindow(buildChecklistHtml({ ...exhibition, artworks: printArtworks }, ownerName, readStyled('exhibition'), priceSymbol));
  };

  const handleArtworkQrSheet = () => {
    console.log('[Exhibitions] Print artwork QR sheet', {
      exhibitionId: exhibition.id,
      count: printArtworks.length,
    });
    const qrSvgs = new Map(printArtworks.map((a) => [a.id, readStyled(`sheet-${a.id}`)]));
    openPrintWindow(buildArtworkQrSheetHtml(exhibition.title, printArtworks, qrSvgs), 860, 760);
  };

  const handleWallLabels = (
    options: WallLabelOptions,
    biosByArtwork: Map<string, string>,
    extraQrs: (artworkId: string) => LabelQr[],
    labelQrStyle: QrStyleSettings,
  ) => {
    console.log('[Exhibitions] Print wall labels', {
      exhibitionId: exhibition.id,
      count: labelArtworks.length,
      fromWallScan: !!wallOrder,
      options,
      qrStyle: labelQrStyle.style,
    });
    setPriceSymbol(options.priceSymbol);
    // Plain stays the level-M code, which reads best at label size; any other
    // style is composed from the level-H code.
    const labelQr = (id: string) => {
      if (labelQrStyle.style === 'plain') return readQr(id);
      const base = readQr(`sheet-${id}`);
      return base ? composeStyledQr(base, labelQrStyle) : '';
    };
    const qrSvgs = new Map(labelArtworks.map((a) => [a.id, labelQr(a.id)]));
    openPrintWindow(
      buildWallLabelsHtml(exhibition.title, exhibitionLabelItems(labelArtworks), options, qrSvgs, biosByArtwork, extraQrs),
      960,
      760,
    );
  };

  const handleWallGroupLabel = (orderedIds: string[], options: WallGroupLabelOptions) => {
    const works = orderedIds.flatMap((id) => exhibition.artworks.find((a) => a.id === id) ?? []);
    console.log('[Exhibitions] Print wall label from scan', {
      exhibitionId: exhibition.id,
      count: works.length,
      wallName: options.wallName || null,
    });
    setPriceSymbol(options.priceSymbol);
    openPrintWindow(
      buildWallGroupLabelHtml(exhibition.title, exhibitionLabelItems(works), options, readStyled('exhibition')),
      820,
      900,
    );
  };

  const handleCatalog = (options: CatalogOptions, artists: CatalogArtist[]) => {
    console.log('[Exhibitions] Print catalog', {
      exhibitionId: exhibition.id,
      count: printArtworks.length,
      style: options.style,
    });
    setPriceSymbol(options.priceSymbol);
    const items: CatalogItem[] = printArtworks.map((a) => ({
      id: a.id,
      title: a.title,
      artist_name: a.artist_name,
      creation_date: a.creation_date,
      medium: a.medium,
      dimensions: a.dimensions,
      edition: a.edition,
      description: a.description,
      credit_line: a.credit_line ?? null,
      image_url: a.image_url,
      price: a.listPriceDisplay ?? null,
    }));
    const subtitle = [posterDefaults(exhibition, ownerName, exhibitionUrl).dates, exhibition.location]
      .filter(Boolean)
      .join(' · ');
    const qrSvgs = new Map(printArtworks.map((a) => [a.id, readStyled(`sheet-${a.id}`)]));
    openPrintWindow(
      buildCatalogHtml(
        {
          kicker: ownerName ?? '',
          title: exhibition.title,
          subtitle,
          introduction: exhibition.description ? stripMarkdown(exhibition.description) : null,
          printDate: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
          qrSvg: readStyled('exhibition'),
          label: 'Exhibition catalogue',
        },
        items,
        options,
        qrSvgs,
        artists,
      ),
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
            <QRCodeSVG value={exhibitionQrUrl} size={512} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
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

      {/* The catalog is also in the menu; this button keeps it easy to find. */}
      <Button
        variant="outline"
        size="sm"
        className="font-serif h-8 gap-1.5 border-wine/30 text-wine hover:bg-wine/5 hover:text-wine"
        disabled={!origin || !hasWorks}
        onClick={() => setCatalogOpen(true)}
        title={
          selectedArtworkIds
            ? `Print a catalog of the ${printArtworks.length} selected ${printArtworks.length === 1 ? 'work' : 'works'}`
            : 'Print a catalog of the show: standard, editorial or monograph'
        }
      >
        <BookOpen className="h-3.5 w-3.5" />
        {/* Icon only on phones, where the owner row is already full. */}
        <span className="sr-only sm:not-sr-only">Catalog</span>
      </Button>

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
            title={
              selectedArtworkIds
                ? `Wall labels, catalog, QR codes and checklist for ${printArtworks.length} selected ${printArtworks.length === 1 ? 'work' : 'works'}, or the show's QR poster`
                : 'Print the exhibition QR code, wall labels, catalog, artwork QR codes or checklist'
            }
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
              setWallOrder(null);
              setLabelsOpen(true);
            }}
            disabled={!hasWorks}
            className="font-serif text-xs cursor-pointer"
          >
            <Tag className="h-3.5 w-3.5 mr-2 opacity-60" />
            Wall Labels…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setWallScanOpen(true)}
            disabled={!hasWorks}
            className="font-serif text-xs cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5 mr-2 opacity-60" />
            Label a Wall from a Photo…
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => setCatalogOpen(true)}
            disabled={!hasWorks}
            className="font-serif text-xs cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 mr-2 opacity-60" />
            Catalog…
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
            qrUrl={exhibitionQrUrl}
            qrStyle={qrStyle}
            onQrStyleChange={(next) => void saveQrStyle(next)}
            posterDefaults={posterDefaults(exhibition, ownerName, exhibitionUrl)}
            posterOverrides={posterOverrides}
            onPosterOverridesChange={changePosterText}
            onPrint={handleExhibitionQr}
          />
        )}
      </Dialog>

      <WallScanDialog
        open={wallScanOpen}
        onOpenChange={setWallScanOpen}
        exhibitionId={exhibition.id}
        artworks={printArtworks}
        onPrintWallLabel={handleWallGroupLabel}
        onPrintIndividualLabels={(ids) => {
          setWallOrder(ids);
          setWallScanOpen(false);
          setLabelsOpen(true);
        }}
      />

      <WallLabelsDialog
        open={labelsOpen}
        onOpenChange={(open) => {
          setLabelsOpen(open);
          if (!open) setWallOrder(null);
        }}
        count={labelArtworks.length}
        optionsStorageKey={LABEL_OPTIONS_KEY}
        extraQrStorageKey={`provenance.exhibition.labelQrs.${exhibition.id}`}
        qrStyleStorageKey={`provenance.exhibition.labelQrStyle.${exhibition.id}`}
        sampleQrUrl={
          origin && labelArtworks[0]
            ? `${origin}/artworks/${labelArtworks[0].id}/certificate?scan=true`
            : ''
        }
        bioEditsStorageKey={bioEditsKey(exhibition.id)}
        loadBios={() => getExhibitionArtistBios(exhibition.id)}
        hints={{ price: 'Exhibition list price', creditLine: 'Only when marked public' }}
        onPrint={handleWallLabels}
      />

      <CatalogDialog
        open={catalogOpen}
        onOpenChange={setCatalogOpen}
        count={printArtworks.length}
        optionsStorageKey={CATALOG_OPTIONS_KEY}
        bioEditsStorageKey={bioEditsKey(exhibition.id)}
        loadBios={async () => {
          // Only the artists of the works being printed.
          const ids = new Set(printArtworks.map((a) => a.id));
          return (await getExhibitionArtistBios(exhibition.id)).filter((b) =>
            b.artworkIds.some((id) => ids.has(id)),
          );
        }}
        hasPrices={hasPrices}
        hasProvenance={false}
        priceHint="Exhibition list prices"
        onPrint={handleCatalog}
      />
    </>
  );
}

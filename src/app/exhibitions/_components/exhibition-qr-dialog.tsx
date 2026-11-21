'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { PosterTextEditor } from './poster-text-editor';
import { QrStylePicker } from './qr-style-picker';
import { deliverFile, renderStyledQrPng } from '../_helpers/qr-export';
import type { PosterOverrides, PosterText } from '../_helpers/poster-text';
import { composeStyledQr, type QrStyleSettings } from '../_helpers/qr-style';

const PNG_SIZE = 1024;

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'exhibition'
  );
}

/**
 * Dialog body for the exhibition QR code: style picker (plain, Photon Labs,
 * Provenance wordmark, neon, or an uploaded image), preview, PNG / SVG
 * download, copy link and print. Render inside a controlled `<Dialog>`.
 */
export function ExhibitionQrDialogContent({
  exhibitionId,
  exhibitionTitle,
  exhibitionUrl,
  qrUrl,
  qrStyle,
  onQrStyleChange,
  posterDefaults,
  posterOverrides,
  onPosterOverridesChange,
  onPrint,
}: {
  exhibitionId: string;
  exhibitionTitle: string;
  exhibitionUrl: string;
  /** What the code encodes: the page plus ?scan=poster, so scans are counted. */
  qrUrl: string;
  qrStyle: QrStyleSettings;
  onQrStyleChange: (next: QrStyleSettings) => void;
  /** Poster lines before edits, the saved edits, and where edits go. */
  posterDefaults: PosterText;
  posterOverrides: PosterOverrides;
  onPosterOverridesChange: (next: PosterOverrides) => void;
  onPrint: () => void;
}) {
  const [baseSvg, setBaseSvg] = useState('');
  const [copied, setCopied] = useState(false);
  const baseName = `${slugify(exhibitionTitle)}-qr`;

  const handlePng = async () => {
    console.log('[Exhibitions] Download exhibition QR PNG', { exhibitionId, style: qrStyle.style });
    if (!baseSvg) return;
    try {
      const blob = await renderStyledQrPng(baseSvg, qrStyle, { size: PNG_SIZE });
      await deliverFile(new File([blob], `${baseName}.png`, { type: 'image/png' }));
    } catch (err) {
      console.error('[Exhibitions] QR PNG export failed', err);
      toast.error('Could not create the image. Please try again.');
    }
  };

  const handleSvg = () => {
    console.log('[Exhibitions] Download exhibition QR SVG', { exhibitionId, style: qrStyle.style });
    if (!baseSvg) return;
    const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${composeStyledQr(baseSvg, qrStyle, {
      pixelSize: PNG_SIZE,
      title: `QR code for ${exhibitionTitle}`,
    })}`;
    void deliverFile(new File([markup], `${baseName}.svg`, { type: 'image/svg+xml' }));
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(exhibitionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[Exhibitions] Copy exhibition link failed', err);
      toast.error('Could not copy the link.');
    }
  };

  return (
    <EditorialDialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Exhibition QR code</DialogTitle>
        <DialogDescription>
          Visitors who scan it open this exhibition page with the list of works. Put it on
          flyers, posts or the gallery wall. The style you pick is used for the poster, the
          artwork QR sheet and the checklist.
        </DialogDescription>
      </DialogHeader>

      {/* Plain code (level H, no margin) that every style is composed from. */}
      <div
        aria-hidden="true"
        className="hidden"
        ref={(el) => {
          const svg = el?.innerHTML ?? '';
          if (svg && svg !== baseSvg) setBaseSvg(svg);
        }}
      >
        <QRCodeSVG value={qrUrl} size={512} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
      </div>

      <div className="flex flex-col items-center gap-3 py-2">
        <div
          className="w-52 max-w-full rounded-md border border-wine/15 bg-white p-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
          role="img"
          aria-label={`QR code for ${exhibitionTitle}`}
          dangerouslySetInnerHTML={{ __html: baseSvg ? composeStyledQr(baseSvg, qrStyle) : '' }}
        />
        <p className="max-w-full break-all text-center font-serif text-[11px] text-ink/40">
          {exhibitionUrl}
        </p>
      </div>

      <QrStylePicker
        baseSvg={baseSvg}
        qrStyle={qrStyle}
        onQrStyleChange={onQrStyleChange}
        logTag="[Exhibitions]"
      />

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={() => void handlePng()} disabled={!baseSvg}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PNG
        </Button>
        <Button variant="outline" onClick={handleSvg} disabled={!baseSvg}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          SVG
        </Button>
      </div>

      <PosterTextEditor
        defaults={posterDefaults}
        overrides={posterOverrides}
        onChange={onPosterOverridesChange}
      />

      <DialogFooter className="gap-2 sm:gap-2">
        <Button variant="outline" onClick={handleCopy}>
          {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button onClick={onPrint}>
          <Printer className="mr-1.5 h-3.5 w-3.5" />
          Print poster
        </Button>
      </DialogFooter>
    </EditorialDialogContent>
  );
}

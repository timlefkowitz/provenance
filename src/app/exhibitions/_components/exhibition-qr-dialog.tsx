'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { PosterTextEditor } from './poster-text-editor';
import { loadImage, QrStylePicker } from './qr-style-picker';
import type { PosterOverrides, PosterText } from '../_helpers/poster-text';
import { centreImagePlacement, composeStyledQr, type QrStyleSettings } from '../_helpers/qr-style';

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
 * Hand a file to the user. On iOS (the native app and Safari) a plain
 * `<a download>` is unreliable, so prefer the share sheet when it accepts
 * files — that's where "Save Image" lives. Falls back to a download link.
 */
async function deliverFile(file: File): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === 'AbortError') return;
      console.error('[Exhibitions] QR share failed, falling back to download', err);
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Renders a styled QR SVG to a PNG blob. The centre image is drawn separately so the canvas isn't tainted. */
async function renderPng(baseSvg: string, settings: QrStyleSettings): Promise<Blob> {
  const svg = composeStyledQr(baseSvg, settings, { pixelSize: PNG_SIZE, omitImages: true });
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const canvas = document.createElement('canvas');
    canvas.width = PNG_SIZE;
    canvas.height = PNG_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(await loadImage(svgUrl), 0, 0, PNG_SIZE, PNG_SIZE);

    const placement = centreImagePlacement(baseSvg, settings);
    if (placement) {
      const k = PNG_SIZE / placement.total;
      const img = await loadImage(placement.href);
      // Same "cover" crop as the SVG's preserveAspectRatio="xMidYMid slice".
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      ctx.drawImage(
        img,
        (img.naturalWidth - side) / 2,
        (img.naturalHeight - side) / 2,
        side,
        side,
        placement.x * k,
        placement.y * k,
        placement.size * k,
        placement.size * k,
      );
    }
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG export failed'))), 'image/png'),
    );
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
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
      const blob = await renderPng(baseSvg, qrStyle);
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
        <QRCodeSVG value={exhibitionUrl} size={512} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
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

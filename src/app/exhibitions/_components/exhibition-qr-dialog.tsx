'use client';

import { useRef, useState } from 'react';
import { QRCodeCanvas, QRCodeSVG } from 'qrcode.react';
import { Check, Copy, Download, Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';
import { EditorialDialogContent } from '~/components/editorial-dialog';

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

/**
 * Dialog body for the exhibition QR code: preview plus PNG / SVG download,
 * copy link and print. Render inside a controlled `<Dialog>`.
 */
export function ExhibitionQrDialogContent({
  exhibitionId,
  exhibitionTitle,
  exhibitionUrl,
  onPrint,
}: {
  exhibitionId: string;
  exhibitionTitle: string;
  exhibitionUrl: string;
  onPrint: () => void;
}) {
  const svgRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const baseName = `${slugify(exhibitionTitle)}-qr`;

  const handlePng = () => {
    console.log('[Exhibitions] Download exhibition QR PNG', { exhibitionId });
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        toast.error('Could not create the image. Please try again.');
        return;
      }
      void deliverFile(new File([blob], `${baseName}.png`, { type: 'image/png' }));
    }, 'image/png');
  };

  const handleSvg = () => {
    console.log('[Exhibitions] Download exhibition QR SVG', { exhibitionId });
    const svg = svgRef.current?.querySelector('svg');
    if (!svg) return;
    const markup = `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
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
    <EditorialDialogContent className="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>Exhibition QR code</DialogTitle>
        <DialogDescription>
          Visitors who scan it open this exhibition page with the list of works. Put it on
          flyers, posts or the gallery wall.
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col items-center gap-3 py-2">
        <div ref={svgRef} className="rounded-md border border-wine/15 bg-white p-3">
          <QRCodeSVG
            value={exhibitionUrl}
            size={208}
            level="M"
            marginSize={1}
            title={`QR code for ${exhibitionTitle}`}
          />
        </div>
        <p className="max-w-full break-all text-center font-serif text-[11px] text-ink/40">
          {exhibitionUrl}
        </p>
      </div>

      {/* High-resolution canvas used only for the PNG export. */}
      <div ref={canvasRef} aria-hidden="true" className="hidden">
        <QRCodeCanvas value={exhibitionUrl} size={PNG_SIZE} level="M" marginSize={2} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={handlePng}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          PNG
        </Button>
        <Button variant="outline" onClick={handleSvg}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          SVG
        </Button>
      </div>

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

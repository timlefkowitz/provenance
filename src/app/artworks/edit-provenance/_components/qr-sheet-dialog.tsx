'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Printer } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Dialog, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@kit/ui/dialog';
import { EditorialDialogContent } from '~/components/editorial-dialog';
import { QrStylePicker } from '~/app/exhibitions/_components/qr-style-picker';
import { composeStyledQr, readQrStyle, type QrStyleSettings } from '~/app/exhibitions/_helpers/qr-style';

const QR_STYLE_KEY = 'provenance.collection.qrStyle';

/** The collection's QR style on this device (validated like a saved exhibition style). */
export function loadCollectionQrStyle(): QrStyleSettings {
  try {
    const raw = window.localStorage.getItem(QR_STYLE_KEY);
    return readQrStyle({ qr: raw ? (JSON.parse(raw) as unknown) : null });
  } catch {
    return readQrStyle(null);
  }
}

export function saveCollectionQrStyle(style: QrStyleSettings): boolean {
  try {
    window.localStorage.setItem(QR_STYLE_KEY, JSON.stringify(style));
    return true;
  } catch {
    return false;
  }
}

/**
 * Artwork QR codes for the collection: pick a style (same choices as an
 * exhibition's QR code), preview it on the first work, then print the sheet.
 */
export function QrSheetDialog({
  open,
  onOpenChange,
  count,
  sampleUrl,
  qrStyle,
  onQrStyleChange,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  /** Certificate URL of one selected work, for the preview. */
  sampleUrl: string;
  qrStyle: QrStyleSettings;
  onQrStyleChange: (next: QrStyleSettings) => void;
  onPrint: () => void;
}) {
  const [baseSvg, setBaseSvg] = useState('');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <EditorialDialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Artwork QR codes</DialogTitle>
          <DialogDescription>
            One code per work, each opening its certificate. {count} {count === 1 ? 'code' : 'codes'}, four
            across on letter paper. Your style is remembered on this device.
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
          {sampleUrl && (
            <QRCodeSVG value={sampleUrl} size={256} level="H" marginSize={0} fgColor="#000000" bgColor="#FFFFFF" />
          )}
        </div>

        <div className="flex justify-center py-2">
          <div
            className="w-40 max-w-full rounded-md border border-wine/15 bg-white p-2 [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
            role="img"
            aria-label="QR code preview"
            dangerouslySetInnerHTML={{ __html: baseSvg ? composeStyledQr(baseSvg, qrStyle) : '' }}
          />
        </div>

        <QrStylePicker baseSvg={baseSvg} qrStyle={qrStyle} onQrStyleChange={onQrStyleChange} logTag="[Collection]" />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onPrint} disabled={count === 0 || !baseSvg}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print QR codes
          </Button>
        </DialogFooter>
      </EditorialDialogContent>
    </Dialog>
  );
}

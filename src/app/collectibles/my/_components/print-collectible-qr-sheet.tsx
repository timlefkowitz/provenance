'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@kit/ui/button';
import { Printer } from 'lucide-react';

type CollectibleForQR = {
  id: string;
  title: string;
  category: string | null;
  certificate_number: string | null;
};

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Renders a hidden grid of QRCodeCanvas elements (one per selected collectible)
 * and, on press, serialises them to data URLs into a print-ready sheet.
 * Mirrors the artwork PrintQRSheet: 4 columns of 1.5in QR codes on US Letter.
 */
export function PrintCollectibleQRSheet({
  collectibles,
  selectedIds,
}: {
  collectibles: CollectibleForQR[];
  selectedIds: Set<string>;
}) {
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState('');
  const [printing, setPrinting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
  }, []);

  const selected = collectibles.filter((c) => selectedIds.has(c.id));

  const handlePrint = () => {
    if (!containerRef.current || selected.length === 0) return;
    console.log('[Collectibles] PrintCollectibleQRSheet print', { count: selected.length });
    setPrinting(true);
    try {
      const canvases = containerRef.current.querySelectorAll('canvas');
      const cells = selected
        .map((c, idx) => {
          const canvas = canvases[idx] as HTMLCanvasElement | undefined;
          const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
          const title = escapeHtml(c.title || 'Untitled');
          const category = c.category ? escapeHtml(c.category.replace('-', ' ')) : '';
          const cert = c.certificate_number ? escapeHtml(c.certificate_number) : '';
          return `
          <div class="cell">
            ${dataUrl ? `<img src="${dataUrl}" alt="QR code for ${title}" />` : '<div class="qr-placeholder"></div>'}
            <div class="title">${title}</div>
            ${category ? `<div class="cat">${category}</div>` : ''}
            ${cert ? `<div class="cert">${cert}</div>` : ''}
          </div>`;
        })
        .join('');

      const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>QR Codes — Provenance Collectibles</title>
<style>
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #1a1209; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.06in; }
  .cell { break-inside: avoid; page-break-inside: avoid; border: 0.4pt solid #d4c9b0; padding: 4pt 4pt 5pt; text-align: center; }
  .cell img, .qr-placeholder { display: block; margin: 0 auto; width: 1.5in; height: 1.5in; }
  .qr-placeholder { background: #f5f0e8; }
  .title { margin-top: 4pt; font-size: 8pt; font-weight: bold; line-height: 1.25; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .cat { margin-top: 2pt; font-size: 7pt; color: #5a4a30; text-transform: capitalize; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .cert { margin-top: 2pt; font-size: 5.5pt; color: #9a8060; font-family: 'Courier New', monospace; letter-spacing: 0.02em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
</style></head>
<body>
  <div class="grid">${cells}</div>
  <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
</body></html>`;

      const win = window.open('', '_blank', 'width=860,height=700');
      if (!win) {
        alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
        return;
      }
      win.document.write(html);
      win.document.close();
    } finally {
      setPrinting(false);
    }
  };

  return (
    <>
      {mounted && (
        <div
          ref={containerRef}
          aria-hidden="true"
          style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', visibility: 'hidden' }}
        >
          {selected.map((c) => (
            <QRCodeCanvas
              key={c.id}
              value={`${origin}/collectibles/${c.id}/certificate`}
              size={288}
              level="M"
              includeMargin
            />
          ))}
        </div>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={handlePrint}
        disabled={printing || selected.length === 0}
        className="font-serif border-wine/30 hover:bg-wine/10"
        title={
          selected.length === 0
            ? 'Select collectibles to print QR codes'
            : `Print QR codes for ${selected.length} selected`
        }
      >
        <Printer className="h-4 w-4 mr-2" />
        {printing ? 'Preparing…' : `Print QR${selected.length > 0 ? ` (${selected.length})` : ''}`}
      </Button>
    </>
  );
}

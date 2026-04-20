'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@kit/ui/button';
import { Printer } from 'lucide-react';

type ArtworkForQR = {
  id: string;
  title: string;
  artist_name: string | null;
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
 * Renders a hidden grid of QRCodeCanvas elements (one per selected artwork)
 * and—on button press—serialises them to data URLs, builds a print-ready
 * HTML document in a new window, and triggers window.print().
 *
 * Layout target: 4 columns × 5 rows = 20 QR codes per US-Letter page.
 * Each QR code is 1.5 in × 1.5 in with title and artist name below.
 */
export function PrintQRSheet({
  artworks,
  selectedArtworkIds,
}: {
  artworks: ArtworkForQR[];
  selectedArtworkIds: Set<string>;
}) {
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState('');
  const [printing, setPrinting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
  }, []);

  const selectedArtworks = artworks.filter((a) => selectedArtworkIds.has(a.id));

  const handlePrint = async () => {
    if (!containerRef.current || selectedArtworks.length === 0) return;
    console.log('[Collection] PrintQRSheet print', { count: selectedArtworks.length });

    setPrinting(true);
    try {
      const canvases = containerRef.current.querySelectorAll('canvas');

      const cells = selectedArtworks
        .map((artwork, idx) => {
          const canvas = canvases[idx] as HTMLCanvasElement | undefined;
          const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
          const title = escapeHtml(artwork.title || 'Untitled');
          const artist = artwork.artist_name ? escapeHtml(artwork.artist_name) : '';
          const cert = artwork.certificate_number
            ? escapeHtml(artwork.certificate_number)
            : '';
          return `
          <div class="cell">
            ${dataUrl ? `<img src="${dataUrl}" alt="QR code for ${title}" />` : '<div class="qr-placeholder"></div>'}
            <div class="title">${title}</div>
            ${artist ? `<div class="artist">${artist}</div>` : ''}
            ${cert ? `<div class="cert">${cert}</div>` : ''}
          </div>`;
        })
        .join('');

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>QR Codes — Provenance</title>
  <style>
    @page {
      size: letter;
      margin: 0.45in;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff;
      color: #1a1209;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.06in;
    }
    .cell {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 0.4pt solid #d4c9b0;
      padding: 4pt 4pt 5pt;
      text-align: center;
    }
    .cell img,
    .qr-placeholder {
      display: block;
      margin: 0 auto;
      width: 1.5in;
      height: 1.5in;
    }
    .qr-placeholder {
      background: #f5f0e8;
    }
    .title {
      margin-top: 4pt;
      font-size: 8pt;
      font-weight: bold;
      line-height: 1.25;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .artist {
      margin-top: 2pt;
      font-size: 7pt;
      color: #5a4a30;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .cert {
      margin-top: 2pt;
      font-size: 5.5pt;
      color: #9a8060;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.02em;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
  </style>
</head>
<body>
  <div class="grid">${cells}</div>
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;

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
      {/* Hidden canvas grid — stays off-screen but in the DOM so canvases render */}
      {mounted && (
        <div
          ref={containerRef}
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: -9999,
            top: -9999,
            pointerEvents: 'none',
            visibility: 'hidden',
          }}
        >
          {selectedArtworks.map((artwork) => (
            <QRCodeCanvas
              key={artwork.id}
              value={`${origin}/artworks/${artwork.id}/certificate`}
              size={288}
              level="M"
              includeMargin={true}
            />
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={handlePrint}
        disabled={printing || selectedArtworks.length === 0}
        className="h-9 min-h-9 px-3 text-xs font-serif touch-manipulation sm:h-7 sm:min-h-0 sm:px-2"
        title={
          selectedArtworks.length === 0
            ? 'Select artworks to print QR codes'
            : `Print QR codes for ${selectedArtworks.length} selected ${selectedArtworks.length === 1 ? 'artwork' : 'artworks'}`
        }
      >
        <Printer className="h-3.5 w-3.5 mr-1.5" />
        {printing ? 'Preparing…' : 'Print QR'}
      </Button>
    </>
  );
}

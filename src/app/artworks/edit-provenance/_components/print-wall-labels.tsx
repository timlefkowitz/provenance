'use client';

import { Button } from '@kit/ui/button';
import { Tag } from 'lucide-react';

type ArtworkForLabel = {
  id: string;
  title: string;
  artist_name: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  owned_by: string | null;
  edition: string | null;
};

type ArtworkFormDataForLabel = {
  title: string;
  artist_name: string;
  creation_date: string;
  medium: string;
  dimensions: string;
  owned_by: string;
  edition: string;
};

/** Label sizes in inches (width × height). */
type LabelSize = {
  label: string;
  wIn: number;
  hIn: number;
};

const SIZES: Record<'small' | 'standard' | 'medium' | 'extended', LabelSize> = {
  small:    { label: '2 × 3 in',   wIn: 2,  hIn: 3  },
  standard: { label: '2 × 4 in',   wIn: 2,  hIn: 4  },
  medium:   { label: '2 × 5 in',   wIn: 2,  hIn: 5  },
  extended: { label: '2 × 6 in',   wIn: 2,  hIn: 6  },
};

/**
 * Parse a dimensions string and return the largest measurement in inches.
 *
 * Handles formats like:
 *   "24 × 36 in"  |  "60 x 90 cm"  |  "18 × 24"  |  "72 in"
 *
 * Returns null when no numeric value is found.
 */
function parseLargestDimensionInches(dimensions: string | null | undefined): number | null {
  if (!dimensions) return null;

  // Extract all numbers (integer or decimal) from the string.
  const numbers = [...dimensions.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  if (numbers.length === 0) return null;

  const max = Math.max(...numbers);

  // Convert cm to inches when "cm" appears anywhere in the string.
  const isCm = /\bcm\b/i.test(dimensions);
  return isCm ? max / 2.54 : max;
}

function chooseLabelSize(dimensions: string | null | undefined): LabelSize {
  const maxIn = parseLargestDimensionInches(dimensions);

  if (maxIn === null) return SIZES.standard;
  if (maxIn <= 12)   return SIZES.small;
  if (maxIn <= 36)   return SIZES.standard;
  if (maxIn <= 72)   return SIZES.medium;
  return SIZES.extended;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getYear(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).getFullYear().toString();
  } catch {
    return iso.slice(0, 4);
  }
}

export function PrintWallLabels({
  artworks,
  artworkData,
  selectedArtworkIds,
}: {
  artworks: ArtworkForLabel[];
  artworkData: Record<string, ArtworkFormDataForLabel>;
  selectedArtworkIds: Set<string>;
}) {
  const selectedArtworks = artworks.filter((a) => selectedArtworkIds.has(a.id));

  const handlePrint = () => {
    if (selectedArtworks.length === 0) return;
    console.log('[Collection] PrintWallLabels print', { count: selectedArtworks.length });

    const DPI = 96; // CSS px per inch in browsers

    const labelCells = selectedArtworks
      .map((artwork) => {
        const form = artworkData[artwork.id];

        const title      = escapeHtml(form?.title      || artwork.title       || 'Untitled');
        const artist     = escapeHtml(form?.artist_name || artwork.artist_name || '');
        const year       = getYear(form?.creation_date  || artwork.creation_date);
        const medium     = escapeHtml(form?.medium      || artwork.medium      || '');
        const dims       = escapeHtml(form?.dimensions  || artwork.dimensions  || '');
        const creditLine = escapeHtml(form?.owned_by    || artwork.owned_by    || '');
        const edition    = escapeHtml(form?.edition     || artwork.edition     || '');

        // Use the live dimensions from the form (may have been edited this session).
        const labelSize  = chooseLabelSize(form?.dimensions || artwork.dimensions);
        const wPx = Math.round(labelSize.wIn * DPI);
        const hPx = Math.round(labelSize.hIn * DPI);

        const titleLine  = year ? `${title}, ${year}` : title;
        const metaParts  = [medium, dims].filter(Boolean).join('; ');
        const editionStr = edition ? `Edition ${edition}` : '';

        return `
          <div class="label" style="width:${wPx}px;height:${hPx}px;" data-size="${escapeHtml(labelSize.label)}">
            ${artist ? `<div class="artist">${artist}</div>` : ''}
            <div class="title">${titleLine}</div>
            ${metaParts ? `<div class="meta">${metaParts}</div>` : ''}
            ${editionStr ? `<div class="edition">${editionStr}</div>` : ''}
            ${creditLine ? `<div class="credit">${creditLine}</div>` : ''}
            <div class="size-badge">${escapeHtml(labelSize.label)}</div>
          </div>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Wall Labels — Provenance</title>
  <style>
    @page {
      size: letter;
      margin: 0.5in;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff;
      color: #0e0b07;
    }
    .page-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25in;
      align-items: flex-start;
    }
    .label {
      break-inside: avoid;
      page-break-inside: avoid;
      border: 0.4pt solid #ccc;
      padding: 7px 9px 18px;
      position: relative;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      gap: 3px;
      overflow: hidden;
    }
    .artist {
      font-size: 9pt;
      font-weight: bold;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }
    .title {
      font-size: 8pt;
      font-style: italic;
      line-height: 1.3;
      color: #1a1209;
    }
    .meta {
      font-size: 6.5pt;
      line-height: 1.4;
      color: #333;
      margin-top: 1px;
    }
    .edition {
      font-size: 6pt;
      color: #555;
    }
    .credit {
      font-size: 6pt;
      color: #555;
      font-style: normal;
    }
    /* Tiny size indicator — visible in screen preview, suppressed in print */
    .size-badge {
      position: absolute;
      bottom: 3px;
      right: 5px;
      font-size: 5pt;
      color: #bbb;
      font-family: 'Courier New', monospace;
      letter-spacing: 0.04em;
    }
    @media print {
      .size-badge { display: none; }
    }
  </style>
</head>
<body>
  <div class="page-grid">${labelCells}</div>
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=720');
    if (!win) {
      alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
      return;
    }
    win.document.write(html);
    win.document.close();
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={handlePrint}
      disabled={selectedArtworks.length === 0}
      className="h-9 min-h-9 px-3 text-xs font-serif touch-manipulation sm:h-7 sm:min-h-0 sm:px-2"
      title={
        selectedArtworks.length === 0
          ? 'Select artworks to print wall labels'
          : `Print wall labels for ${selectedArtworks.length} selected ${selectedArtworks.length === 1 ? 'artwork' : 'artworks'}`
      }
    >
      <Tag className="h-3.5 w-3.5 mr-1.5" />
      Wall Labels
    </Button>
  );
}

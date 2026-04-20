'use client';

import { Button } from '@kit/ui/button';
import { BookOpen, List } from 'lucide-react';

type ArtworkForCatalog = {
  id: string;
  title: string;
  artist_name: string | null;
  description: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  image_url: string | null;
  former_owners: string | null;
  auction_history: string | null;
  exhibition_history: string | null;
  historic_context: string | null;
  owned_by: string | null;
  value: string | null;
  value_is_public: boolean | null;
};

type ArtworkFormDataForCatalog = {
  title: string;
  artist_name: string;
  description: string;
  creation_date: string;
  medium: string;
  dimensions: string;
  edition: string;
  former_owners: string;
  auction_history: string;
  exhibition_history: string;
  historic_context: string;
  owned_by: string;
  value: string;
  value_is_public: boolean | null;
};

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

function merge(
  formVal: string | undefined,
  artworkVal: string | null | undefined,
): string {
  return formVal?.trim() || artworkVal?.trim() || '';
}

function buildCatalogHtml(
  artworks: ArtworkForCatalog[],
  artworkData: Record<string, ArtworkFormDataForCatalog>,
  galleryName: string,
  printDate: string,
): string {
  const heroArtwork = artworks.find((a) => a.image_url);

  // ── Cover ──────────────────────────────────────────────────────────────────

  const heroHtml = heroArtwork?.image_url
    ? `<div class="cover-hero">
        <img src="${escapeHtml(heroArtwork.image_url)}" alt="" onerror="this.parentElement.style.display='none'" />
      </div>`
    : '';

  const coverHtml = `
    <div class="cover">
      <div class="cover-top">
        <div class="cover-gallery">${escapeHtml(galleryName)}</div>
        <div class="cover-title">Collection Catalog</div>
        <div class="cover-subtitle">${artworks.length} ${artworks.length === 1 ? 'Work' : 'Works'}</div>
      </div>
      ${heroHtml}
      <div class="cover-bottom">
        <span class="cover-count">${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}</span>
        <span class="cover-date">${escapeHtml(printDate)}</span>
      </div>
    </div>`;

  // ── Artwork plates ─────────────────────────────────────────────────────────

  const plateRows = artworks
    .map((artwork, idx) => {
      const form = artworkData[artwork.id];

      const title = escapeHtml(merge(form?.title, artwork.title) || 'Untitled');
      const artist = escapeHtml(merge(form?.artist_name, artwork.artist_name));
      const year = getYear(form?.creation_date || artwork.creation_date);
      const medium = escapeHtml(merge(form?.medium, artwork.medium));
      const dims = escapeHtml(merge(form?.dimensions, artwork.dimensions));
      const edition = escapeHtml(merge(form?.edition, artwork.edition));
      const description = escapeHtml(merge(form?.description, artwork.description));
      const creditLine = escapeHtml(merge(form?.owned_by, artwork.owned_by));

      const formerOwners = escapeHtml(merge(form?.former_owners, artwork.former_owners));
      const auctionHistory = escapeHtml(merge(form?.auction_history, artwork.auction_history));
      const exhibitionHistory = escapeHtml(merge(form?.exhibition_history, artwork.exhibition_history));
      const historicContext = escapeHtml(merge(form?.historic_context, artwork.historic_context));

      const titleLine = year ? `${title}, ${year}` : title;
      const metaFields: string[] = [];
      if (medium) metaFields.push(`<span class="plate-field-label">Medium</span>${medium}`);
      if (dims) metaFields.push(`<span class="plate-field-label">Dimensions</span>${dims}`);
      if (edition) metaFields.push(`<span class="plate-field-label">Edition</span>${edition}`);
      if (creditLine) metaFields.push(`<span class="plate-field-label">Collection</span>${creditLine}`);

      const imageHtml = artwork.image_url
        ? `<img src="${escapeHtml(artwork.image_url)}" alt="" onerror="this.parentElement.innerHTML='<div class=\\'plate-image-placeholder\\'>No image</div>'" />`
        : `<div class="plate-image-placeholder">No image</div>`;

      const provenanceParts: string[] = [];
      if (formerOwners) provenanceParts.push(`<strong>Provenance:</strong> ${formerOwners}`);
      if (auctionHistory) provenanceParts.push(`<strong>Auction history:</strong> ${auctionHistory}`);
      if (exhibitionHistory) provenanceParts.push(`<strong>Exhibition history:</strong> ${exhibitionHistory}`);
      if (historicContext) provenanceParts.push(`<strong>Historic context:</strong> ${historicContext}`);

      const provenanceHtml = provenanceParts.length > 0
        ? `<div class="plate-provenance">
             <div class="plate-prov-heading">Provenance &amp; History</div>
             ${provenanceParts.join('<br />')}
           </div>`
        : '';

      return `
        <div class="plate${idx === 0 ? ' plate-first' : ''}">
          <div class="plate-image-wrap">${imageHtml}</div>
          <div class="plate-meta">
            <div class="plate-num">No. ${String(idx + 1).padStart(2, '0')}</div>
            ${artist ? `<div class="plate-artist">${artist}</div>` : ''}
            <div class="plate-title">${titleLine}</div>
            ${metaFields.map((f) => `<div class="plate-field">${f}</div>`).join('')}
            ${description ? `<div class="plate-description">${description}</div>` : ''}
            ${provenanceHtml}
          </div>
        </div>`;
    })
    .join('');

  const platesHtml = `
    <div class="plates-section">
      <div class="section-header">
        <div class="section-label">Catalog</div>
        <div class="section-title">Works</div>
      </div>
      ${plateRows}
    </div>`;

  // ── Checklist ──────────────────────────────────────────────────────────────

  const checklistRows = artworks
    .map((artwork, idx) => {
      const form = artworkData[artwork.id];
      const title = escapeHtml(merge(form?.title, artwork.title) || 'Untitled');
      const artist = escapeHtml(merge(form?.artist_name, artwork.artist_name));
      const year = getYear(form?.creation_date || artwork.creation_date);
      const medium = escapeHtml(merge(form?.medium, artwork.medium));
      const dims = escapeHtml(merge(form?.dimensions, artwork.dimensions));

      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td class="title-cell">${title}${year ? `, ${year}` : ''}</td>
          <td>${artist}</td>
          <td>${medium}</td>
          <td>${dims}</td>
        </tr>`;
    })
    .join('');

  const checklistHtml = `
    <div class="checklist-section">
      <div class="checklist-header">
        <div class="section-label">Complete listing</div>
        <div class="section-title">Checklist of Works</div>
      </div>
      <table class="checklist">
        <thead>
          <tr>
            <th>#</th>
            <th>Title &amp; Year</th>
            <th>Artist</th>
            <th>Medium</th>
            <th>Dimensions</th>
          </tr>
        </thead>
        <tbody>${checklistRows}</tbody>
      </table>
    </div>`;

  // ── Price list (conditional) ───────────────────────────────────────────────

  const priceWorks = artworks.filter((a) => {
    const form = artworkData[a.id];
    const val = form?.value?.trim() || a.value?.trim() || '';
    const pub = form?.value_is_public ?? a.value_is_public;
    return val.length > 0 && pub === true;
  });

  const priceListHtml =
    priceWorks.length > 0
      ? `
        <div class="pricelist-section">
          <div class="pricelist-header">
            <div class="section-label pricelist-confidential">For Collectors — Confidential</div>
            <div class="section-title">Price List</div>
          </div>
          <table class="pricelist">
            <thead>
              <tr>
                <th>#</th>
                <th>Title &amp; Year</th>
                <th>Artist</th>
                <th>Medium</th>
                <th style="text-align:right">Price</th>
              </tr>
            </thead>
            <tbody>
              ${priceWorks
                .map((artwork, idx) => {
                  const form = artworkData[artwork.id];
                  const title = escapeHtml(merge(form?.title, artwork.title) || 'Untitled');
                  const artist = escapeHtml(merge(form?.artist_name, artwork.artist_name));
                  const year = getYear(form?.creation_date || artwork.creation_date);
                  const medium = escapeHtml(merge(form?.medium, artwork.medium));
                  const value = escapeHtml(form?.value?.trim() || artwork.value?.trim() || '');
                  return `
                    <tr>
                      <td class="num">${idx + 1}</td>
                      <td class="title-cell">${title}${year ? `, ${year}` : ''}</td>
                      <td>${artist}</td>
                      <td>${medium}</td>
                      <td class="price">${value}</td>
                    </tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>`
      : '';

  // ── Full document ──────────────────────────────────────────────────────────

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Collection Catalog — ${escapeHtml(galleryName)}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff;
      color: #0e0b07;
      line-height: 1.5;
    }

    /* Cover */
    .cover {
      page-break-after: always;
      min-height: 9.5in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover-top { border-top: 2pt solid #0e0b07; padding-top: 0.3in; }
    .cover-gallery {
      font-size: 8.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 400;
      color: #666;
    }
    .cover-title {
      font-size: 38pt;
      font-weight: bold;
      line-height: 1.05;
      letter-spacing: -0.01em;
      margin-top: 0.12in;
    }
    .cover-subtitle {
      font-size: 11pt;
      font-style: italic;
      color: #666;
      margin-top: 0.08in;
      letter-spacing: 0.02em;
    }
    .cover-hero {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.4in 0;
      overflow: hidden;
    }
    .cover-hero img {
      max-width: 100%;
      max-height: 5in;
      object-fit: contain;
      display: block;
    }
    .cover-bottom {
      border-top: 0.5pt solid #ccc;
      padding-top: 0.15in;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .cover-count, .cover-date {
      font-size: 7.5pt;
      color: #888;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }

    /* Section headers */
    .section-header {
      page-break-before: always;
      border-top: 2pt solid #0e0b07;
      padding-top: 0.25in;
      margin-bottom: 0.45in;
    }
    .section-label {
      font-size: 7.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 400;
      color: #999;
    }
    .section-title {
      font-size: 22pt;
      font-weight: bold;
      line-height: 1.1;
      margin-top: 0.06in;
    }

    /* Artwork plates */
    .plate {
      display: grid;
      grid-template-columns: 55% 1fr;
      gap: 0.45in;
      padding-bottom: 0.55in;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .plate + .plate {
      border-top: 0.5pt solid #e0d9d0;
      padding-top: 0.55in;
    }
    .plate-image-wrap {
      display: flex;
      align-items: flex-start;
      justify-content: center;
    }
    .plate-image-wrap img {
      max-width: 100%;
      max-height: 5.5in;
      object-fit: contain;
      display: block;
    }
    .plate-image-placeholder {
      width: 100%;
      aspect-ratio: 4 / 3;
      background: #f5f0eb;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ccc;
      font-size: 8pt;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .plate-meta {
      display: flex;
      flex-direction: column;
      gap: 0.1in;
      padding-top: 0.04in;
    }
    .plate-num {
      font-size: 7.5pt;
      color: #bbb;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.1em;
    }
    .plate-artist {
      font-size: 11.5pt;
      font-weight: bold;
      line-height: 1.2;
      letter-spacing: 0.01em;
    }
    .plate-title {
      font-size: 10pt;
      font-style: italic;
      color: #1a1209;
      line-height: 1.3;
    }
    .plate-field {
      font-size: 8.5pt;
      color: #444;
      line-height: 1.5;
    }
    .plate-field-label {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 6.5pt;
      color: #aaa;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      display: block;
      margin-bottom: 1px;
    }
    .plate-description {
      font-size: 8pt;
      color: #555;
      line-height: 1.65;
      font-style: italic;
      border-left: 1.5pt solid #ddd;
      padding-left: 0.1in;
      margin-top: 0.03in;
    }
    .plate-provenance {
      font-size: 7.5pt;
      color: #666;
      line-height: 1.55;
      margin-top: 0.03in;
      border-top: 0.5pt solid #e5e0da;
      padding-top: 0.08in;
    }
    .plate-prov-heading {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 6.5pt;
      color: #aaa;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    /* Checklist */
    .checklist-section { page-break-before: always; }
    .checklist-header {
      border-top: 2pt solid #0e0b07;
      padding-top: 0.25in;
      margin-bottom: 0.3in;
    }
    table.checklist {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    table.checklist thead tr { border-bottom: 0.75pt solid #0e0b07; }
    table.checklist th {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 7pt;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #999;
      text-align: left;
      padding: 0 0.08in 0.06in 0;
    }
    table.checklist th:first-child { width: 0.3in; }
    table.checklist td {
      padding: 0.07in 0.08in 0.07in 0;
      vertical-align: top;
      border-bottom: 0.5pt solid #eae5df;
      color: #1a1209;
      line-height: 1.4;
    }
    table.checklist td.num {
      color: #ccc;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 7.5pt;
    }
    table.checklist td.title-cell { font-style: italic; }

    /* Price list */
    .pricelist-section { page-break-before: always; }
    .pricelist-header {
      border-top: 2pt solid #0e0b07;
      padding-top: 0.25in;
      margin-bottom: 0.3in;
    }
    .pricelist-confidential {
      font-size: 7pt !important;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      color: #b03030 !important;
      margin-bottom: 0.08in;
    }
    table.pricelist {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    table.pricelist thead tr { border-bottom: 0.75pt solid #0e0b07; }
    table.pricelist th {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 7pt;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #999;
      text-align: left;
      padding: 0 0.08in 0.06in 0;
    }
    table.pricelist td {
      padding: 0.07in 0.08in 0.07in 0;
      vertical-align: top;
      border-bottom: 0.5pt solid #eae5df;
      color: #1a1209;
      line-height: 1.4;
    }
    table.pricelist td.num {
      color: #ccc;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 7.5pt;
    }
    table.pricelist td.title-cell { font-style: italic; }
    table.pricelist td.price {
      text-align: right;
      font-family: 'Helvetica Neue', Arial, sans-serif;
    }

    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  ${coverHtml}
  ${platesHtml}
  ${checklistHtml}
  ${priceListHtml}
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;
}

function buildChecklistOnlyHtml(
  artworks: ArtworkForCatalog[],
  artworkData: Record<string, ArtworkFormDataForCatalog>,
  galleryName: string,
  printDate: string,
): string {
  const checklistRows = artworks
    .map((artwork, idx) => {
      const form = artworkData[artwork.id];
      const title = escapeHtml(merge(form?.title, artwork.title) || 'Untitled');
      const artist = escapeHtml(merge(form?.artist_name, artwork.artist_name));
      const year = getYear(form?.creation_date || artwork.creation_date);
      const medium = escapeHtml(merge(form?.medium, artwork.medium));
      const dims = escapeHtml(merge(form?.dimensions, artwork.dimensions));

      return `
        <tr>
          <td class="num">${idx + 1}</td>
          <td class="title-cell">${title}${year ? `, ${year}` : ''}</td>
          <td>${artist}</td>
          <td>${medium}</td>
          <td>${dims}</td>
        </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Checklist of Works — ${escapeHtml(galleryName)}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: Georgia, 'Times New Roman', serif;
      background: #fff;
      color: #0e0b07;
      line-height: 1.5;
    }

    .header {
      border-top: 2pt solid #0e0b07;
      padding-top: 0.25in;
      margin-bottom: 0.35in;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .header-left {}
    .header-gallery {
      font-size: 7.5pt;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 400;
      color: #999;
    }
    .header-title {
      font-size: 22pt;
      font-weight: bold;
      line-height: 1.1;
      margin-top: 0.06in;
    }
    .header-meta {
      font-size: 7.5pt;
      color: #aaa;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      text-align: right;
    }

    table.checklist {
      width: 100%;
      border-collapse: collapse;
      font-size: 8.5pt;
    }
    table.checklist thead tr { border-bottom: 0.75pt solid #0e0b07; }
    table.checklist th {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 7pt;
      font-weight: 400;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #999;
      text-align: left;
      padding: 0 0.08in 0.06in 0;
    }
    table.checklist th:first-child { width: 0.3in; }
    table.checklist td {
      padding: 0.07in 0.08in 0.07in 0;
      vertical-align: top;
      border-bottom: 0.5pt solid #eae5df;
      color: #1a1209;
      line-height: 1.4;
    }
    table.checklist td.num {
      color: #ccc;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 7.5pt;
    }
    table.checklist td.title-cell { font-style: italic; }

    @media print {
      * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-gallery">${escapeHtml(galleryName)}</div>
      <div class="header-title">Checklist of Works</div>
    </div>
    <div class="header-meta">
      ${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}<br />${escapeHtml(printDate)}
    </div>
  </div>
  <table class="checklist">
    <thead>
      <tr>
        <th>#</th>
        <th>Title &amp; Year</th>
        <th>Artist</th>
        <th>Medium</th>
        <th>Dimensions</th>
      </tr>
    </thead>
    <tbody>${checklistRows}</tbody>
  </table>
  <script>
    window.onload = function () {
      window.print();
      window.onafterprint = function () { window.close(); };
    };
  </script>
</body>
</html>`;
}

export function PrintChecklist({
  artworks,
  artworkData,
  selectedArtworkIds,
  galleryName = 'Provenance',
}: {
  artworks: ArtworkForCatalog[];
  artworkData: Record<string, ArtworkFormDataForCatalog>;
  selectedArtworkIds: Set<string>;
  galleryName?: string;
}) {
  const selectedArtworks = artworks.filter((a) => selectedArtworkIds.has(a.id));

  const handlePrint = () => {
    if (selectedArtworks.length === 0) return;
    console.log('[Collection] PrintChecklist generating checklist', { count: selectedArtworks.length });

    const printDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = buildChecklistOnlyHtml(selectedArtworks, artworkData, galleryName, printDate);

    const win = window.open('', '_blank', 'width=960,height=780');
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
          ? 'Select artworks to print checklist'
          : `Print checklist for ${selectedArtworks.length} selected ${selectedArtworks.length === 1 ? 'artwork' : 'artworks'}`
      }
    >
      <List className="h-3.5 w-3.5 mr-1.5" />
      Checklist
    </Button>
  );
}

export function PrintCatalog({
  artworks,
  artworkData,
  selectedArtworkIds,
  galleryName = 'Provenance',
}: {
  artworks: ArtworkForCatalog[];
  artworkData: Record<string, ArtworkFormDataForCatalog>;
  selectedArtworkIds: Set<string>;
  galleryName?: string;
}) {
  const selectedArtworks = artworks.filter((a) => selectedArtworkIds.has(a.id));

  const handlePrint = () => {
    if (selectedArtworks.length === 0) return;
    console.log('[Collection] PrintCatalog generating catalog', { count: selectedArtworks.length });

    const printDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const html = buildCatalogHtml(selectedArtworks, artworkData, galleryName, printDate);

    const win = window.open('', '_blank', 'width=960,height=780');
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
          ? 'Select artworks to print catalog'
          : `Print catalog for ${selectedArtworks.length} selected ${selectedArtworks.length === 1 ? 'artwork' : 'artworks'}`
      }
    >
      <BookOpen className="h-3.5 w-3.5 mr-1.5" />
      Catalog
    </Button>
  );
}

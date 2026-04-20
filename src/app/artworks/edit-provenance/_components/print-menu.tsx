'use client';

import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { BookOpen, ChevronDown, List, Printer, Tag } from 'lucide-react';

// ── Shared helpers ────────────────────────────────────────────────────────────

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

function mergeField(formVal: string | undefined, artworkVal: string | null | undefined): string {
  return formVal?.trim() || artworkVal?.trim() || '';
}

function openPrintWindow(html: string, width = 960, height = 780): void {
  const win = window.open('', '_blank', `width=${width},height=${height}`);
  if (!win) {
    alert('Pop-up blocked. Please allow pop-ups for this site and try again.');
    return;
  }
  win.document.write(html);
  win.document.close();
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ArtworkForPrintMenu = {
  id: string;
  title: string;
  artist_name: string | null;
  certificate_number: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  owned_by: string | null;
  description: string | null;
  image_url: string | null;
  former_owners: string | null;
  auction_history: string | null;
  exhibition_history: string | null;
  historic_context: string | null;
  value: string | null;
  value_is_public: boolean | null;
};

export type ArtworkFormDataForPrintMenu = {
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

// ── Wall Labels ───────────────────────────────────────────────────────────────

type LabelSize = { label: string; wIn: number; hIn: number };
const LABEL_SIZES: Record<'small' | 'standard' | 'medium' | 'extended', LabelSize> = {
  small:    { label: '2 × 3 in', wIn: 2, hIn: 3 },
  standard: { label: '2 × 4 in', wIn: 2, hIn: 4 },
  medium:   { label: '2 × 5 in', wIn: 2, hIn: 5 },
  extended: { label: '2 × 6 in', wIn: 2, hIn: 6 },
};

function parseLargestDimensionInches(dimensions: string | null | undefined): number | null {
  if (!dimensions) return null;
  const numbers = [...dimensions.matchAll(/(\d+(?:\.\d+)?)/g)].map((m) => parseFloat(m[1]));
  if (numbers.length === 0) return null;
  const max = Math.max(...numbers);
  return /\bcm\b/i.test(dimensions) ? max / 2.54 : max;
}

function chooseLabelSize(dimensions: string | null | undefined): LabelSize {
  const maxIn = parseLargestDimensionInches(dimensions);
  if (maxIn === null) return LABEL_SIZES.standard;
  if (maxIn <= 12) return LABEL_SIZES.small;
  if (maxIn <= 36) return LABEL_SIZES.standard;
  if (maxIn <= 72) return LABEL_SIZES.medium;
  return LABEL_SIZES.extended;
}

function buildWallLabelsHtml(
  artworks: ArtworkForPrintMenu[],
  artworkData: Record<string, ArtworkFormDataForPrintMenu>,
): string {
  const DPI = 96;
  const labelCells = artworks
    .map((artwork) => {
      const form = artworkData[artwork.id];
      const title      = escapeHtml(form?.title       || artwork.title       || 'Untitled');
      const artist     = escapeHtml(form?.artist_name  || artwork.artist_name  || '');
      const year       = getYear(form?.creation_date   || artwork.creation_date);
      const medium     = escapeHtml(form?.medium        || artwork.medium        || '');
      const dims       = escapeHtml(form?.dimensions    || artwork.dimensions    || '');
      const creditLine = escapeHtml(form?.owned_by      || artwork.owned_by      || '');
      const edition    = escapeHtml(form?.edition       || artwork.edition       || '');
      const labelSize  = chooseLabelSize(form?.dimensions || artwork.dimensions);
      const wPx = Math.round(labelSize.wIn * DPI);
      const hPx = Math.round(labelSize.hIn * DPI);
      const titleLine  = year ? `${title}, ${year}` : title;
      const metaParts  = [medium, dims].filter(Boolean).join('; ');
      const editionStr = edition ? `Edition ${edition}` : '';

      return `
        <div class="label" style="width:${wPx}px;height:${hPx}px;" data-size="${escapeHtml(labelSize.label)}">
          ${artist     ? `<div class="artist">${artist}</div>`           : ''}
          <div class="title">${titleLine}</div>
          ${metaParts  ? `<div class="meta">${metaParts}</div>`          : ''}
          ${editionStr ? `<div class="edition">${editionStr}</div>`      : ''}
          ${creditLine ? `<div class="credit">${creditLine}</div>`       : ''}
          <div class="size-badge">${escapeHtml(labelSize.label)}</div>
        </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Wall Labels — Provenance</title>
  <style>
    @page { size: letter; margin: 0.5in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #0e0b07; }
    .page-grid { display: flex; flex-wrap: wrap; gap: 0.25in; align-items: flex-start; }
    .label {
      break-inside: avoid; page-break-inside: avoid;
      border: 0.4pt solid #ccc; padding: 7px 9px 18px;
      position: relative; display: flex; flex-direction: column;
      justify-content: flex-start; gap: 3px; overflow: hidden;
    }
    .artist   { font-size: 9pt; font-weight: bold; line-height: 1.2; letter-spacing: 0.01em; }
    .title    { font-size: 8pt; font-style: italic; line-height: 1.3; color: #1a1209; }
    .meta     { font-size: 6.5pt; line-height: 1.4; color: #333; margin-top: 1px; }
    .edition  { font-size: 6pt; color: #555; }
    .credit   { font-size: 6pt; color: #555; font-style: normal; }
    .size-badge {
      position: absolute; bottom: 3px; right: 5px;
      font-size: 5pt; color: #bbb;
      font-family: 'Courier New', monospace; letter-spacing: 0.04em;
    }
    @media print { .size-badge { display: none; } * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="page-grid">${labelCells}</div>
  <script>
    window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };
  </script>
</body>
</html>`;
}

// ── Catalog ───────────────────────────────────────────────────────────────────

function buildCatalogHtml(
  artworks: ArtworkForPrintMenu[],
  artworkData: Record<string, ArtworkFormDataForPrintMenu>,
  galleryName: string,
  printDate: string,
): string {
  const heroArtwork = artworks.find((a) => a.image_url);
  const heroHtml = heroArtwork?.image_url
    ? `<div class="cover-hero"><img src="${escapeHtml(heroArtwork.image_url)}" alt="" onerror="this.parentElement.style.display='none'" /></div>`
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

  const platesHtml = `
    <div class="plates-section">
      <div class="section-header">
        <div class="section-label">Catalog</div>
        <div class="section-title">Works</div>
      </div>
      ${artworks.map((artwork, idx) => {
        const form = artworkData[artwork.id];
        const title  = escapeHtml(mergeField(form?.title,  artwork.title)  || 'Untitled');
        const artist = escapeHtml(mergeField(form?.artist_name, artwork.artist_name));
        const year   = getYear(form?.creation_date || artwork.creation_date);
        const medium = escapeHtml(mergeField(form?.medium, artwork.medium));
        const dims   = escapeHtml(mergeField(form?.dimensions, artwork.dimensions));
        const edition = escapeHtml(mergeField(form?.edition, artwork.edition));
        const description = escapeHtml(mergeField(form?.description, artwork.description));
        const creditLine = escapeHtml(mergeField(form?.owned_by, artwork.owned_by));
        const formerOwners = escapeHtml(mergeField(form?.former_owners, artwork.former_owners));
        const auctionHistory = escapeHtml(mergeField(form?.auction_history, artwork.auction_history));
        const exhibitionHistory = escapeHtml(mergeField(form?.exhibition_history, artwork.exhibition_history));
        const historicContext = escapeHtml(mergeField(form?.historic_context, artwork.historic_context));
        const titleLine = year ? `${title}, ${year}` : title;
        const metaFields: string[] = [];
        if (medium) metaFields.push(`<span class="plate-field-label">Medium</span>${medium}`);
        if (dims)   metaFields.push(`<span class="plate-field-label">Dimensions</span>${dims}`);
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
          ? `<div class="plate-provenance"><div class="plate-prov-heading">Provenance &amp; History</div>${provenanceParts.join('<br />')}</div>`
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
      }).join('')}
    </div>`;

  const checklistRows = artworks.map((artwork, idx) => {
    const form = artworkData[artwork.id];
    const title  = escapeHtml(mergeField(form?.title,  artwork.title)  || 'Untitled');
    const artist = escapeHtml(mergeField(form?.artist_name, artwork.artist_name));
    const year   = getYear(form?.creation_date || artwork.creation_date);
    const medium = escapeHtml(mergeField(form?.medium, artwork.medium));
    const dims   = escapeHtml(mergeField(form?.dimensions, artwork.dimensions));
    return `<tr><td class="num">${idx + 1}</td><td class="title-cell">${title}${year ? `, ${year}` : ''}</td><td>${artist}</td><td>${medium}</td><td>${dims}</td></tr>`;
  }).join('');

  const checklistHtml = `
    <div class="checklist-section">
      <div class="checklist-header">
        <div class="section-label">Complete listing</div>
        <div class="section-title">Checklist of Works</div>
      </div>
      <table class="checklist">
        <thead><tr><th>#</th><th>Title &amp; Year</th><th>Artist</th><th>Medium</th><th>Dimensions</th></tr></thead>
        <tbody>${checklistRows}</tbody>
      </table>
    </div>`;

  const priceWorks = artworks.filter((a) => {
    const form = artworkData[a.id];
    const val = form?.value?.trim() || a.value?.trim() || '';
    const pub = form?.value_is_public ?? a.value_is_public;
    return val.length > 0 && pub === true;
  });
  const priceListHtml = priceWorks.length > 0
    ? `<div class="pricelist-section">
        <div class="pricelist-header">
          <div class="section-label pricelist-confidential">For Collectors — Confidential</div>
          <div class="section-title">Price List</div>
        </div>
        <table class="pricelist">
          <thead><tr><th>#</th><th>Title &amp; Year</th><th>Artist</th><th>Medium</th><th style="text-align:right">Price</th></tr></thead>
          <tbody>${priceWorks.map((artwork, idx) => {
            const form = artworkData[artwork.id];
            const title  = escapeHtml(mergeField(form?.title,  artwork.title)  || 'Untitled');
            const artist = escapeHtml(mergeField(form?.artist_name, artwork.artist_name));
            const year   = getYear(form?.creation_date || artwork.creation_date);
            const medium = escapeHtml(mergeField(form?.medium, artwork.medium));
            const value  = escapeHtml(form?.value?.trim() || artwork.value?.trim() || '');
            return `<tr><td class="num">${idx + 1}</td><td class="title-cell">${title}${year ? `, ${year}` : ''}</td><td>${artist}</td><td>${medium}</td><td class="price">${value}</td></tr>`;
          }).join('')}</tbody>
        </table>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Collection Catalog — ${escapeHtml(galleryName)}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #0e0b07; line-height: 1.5; }
    .cover { page-break-after: always; min-height: 9.5in; display: flex; flex-direction: column; justify-content: space-between; }
    .cover-top { border-top: 2pt solid #0e0b07; padding-top: 0.3in; }
    .cover-gallery { font-size: 8.5pt; letter-spacing: 0.2em; text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 400; color: #666; }
    .cover-title { font-size: 38pt; font-weight: bold; line-height: 1.05; letter-spacing: -0.01em; margin-top: 0.12in; }
    .cover-subtitle { font-size: 11pt; font-style: italic; color: #666; margin-top: 0.08in; letter-spacing: 0.02em; }
    .cover-hero { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0.4in 0; overflow: hidden; }
    .cover-hero img { max-width: 100%; max-height: 5in; object-fit: contain; display: block; }
    .cover-bottom { border-top: 0.5pt solid #ccc; padding-top: 0.15in; display: flex; justify-content: space-between; align-items: flex-end; }
    .cover-count, .cover-date { font-size: 7.5pt; color: #888; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; }
    .section-header { page-break-before: always; border-top: 2pt solid #0e0b07; padding-top: 0.25in; margin-bottom: 0.45in; }
    .section-label { font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 400; color: #999; }
    .section-title { font-size: 22pt; font-weight: bold; line-height: 1.1; margin-top: 0.06in; }
    .plate { display: grid; grid-template-columns: 55% 1fr; gap: 0.45in; padding-bottom: 0.55in; page-break-inside: avoid; break-inside: avoid; }
    .plate + .plate { border-top: 0.5pt solid #e0d9d0; padding-top: 0.55in; }
    .plate-image-wrap { display: flex; align-items: flex-start; justify-content: center; }
    .plate-image-wrap img { max-width: 100%; max-height: 5.5in; object-fit: contain; display: block; }
    .plate-image-placeholder { width: 100%; aspect-ratio: 4/3; background: #f5f0eb; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 8pt; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; }
    .plate-meta { display: flex; flex-direction: column; gap: 0.1in; padding-top: 0.04in; }
    .plate-num { font-size: 7.5pt; color: #bbb; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.1em; }
    .plate-artist { font-size: 11.5pt; font-weight: bold; line-height: 1.2; letter-spacing: 0.01em; }
    .plate-title { font-size: 10pt; font-style: italic; color: #1a1209; line-height: 1.3; }
    .plate-field { font-size: 8.5pt; color: #444; line-height: 1.5; }
    .plate-field-label { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 6.5pt; color: #aaa; letter-spacing: 0.12em; text-transform: uppercase; display: block; margin-bottom: 1px; }
    .plate-description { font-size: 8pt; color: #555; line-height: 1.65; font-style: italic; border-left: 1.5pt solid #ddd; padding-left: 0.1in; margin-top: 0.03in; }
    .plate-provenance { font-size: 7.5pt; color: #666; line-height: 1.55; margin-top: 0.03in; border-top: 0.5pt solid #e5e0da; padding-top: 0.08in; }
    .plate-prov-heading { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 6.5pt; color: #aaa; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; }
    .checklist-section { page-break-before: always; }
    .checklist-header { border-top: 2pt solid #0e0b07; padding-top: 0.25in; margin-bottom: 0.3in; }
    table.checklist { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    table.checklist thead tr { border-bottom: 0.75pt solid #0e0b07; }
    table.checklist th { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: #999; text-align: left; padding: 0 0.08in 0.06in 0; }
    table.checklist th:first-child { width: 0.3in; }
    table.checklist td { padding: 0.07in 0.08in 0.07in 0; vertical-align: top; border-bottom: 0.5pt solid #eae5df; color: #1a1209; line-height: 1.4; }
    table.checklist td.num { color: #ccc; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; }
    table.checklist td.title-cell { font-style: italic; }
    .pricelist-section { page-break-before: always; }
    .pricelist-header { border-top: 2pt solid #0e0b07; padding-top: 0.25in; margin-bottom: 0.3in; }
    .pricelist-confidential { font-size: 7pt !important; letter-spacing: 0.18em; text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; color: #b03030 !important; margin-bottom: 0.08in; }
    table.pricelist { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    table.pricelist thead tr { border-bottom: 0.75pt solid #0e0b07; }
    table.pricelist th { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: #999; text-align: left; padding: 0 0.08in 0.06in 0; }
    table.pricelist td { padding: 0.07in 0.08in 0.07in 0; vertical-align: top; border-bottom: 0.5pt solid #eae5df; color: #1a1209; line-height: 1.4; }
    table.pricelist td.num { color: #ccc; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; }
    table.pricelist td.title-cell { font-style: italic; }
    table.pricelist td.price { text-align: right; font-family: 'Helvetica Neue', Arial, sans-serif; }
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  ${coverHtml}
  ${platesHtml}
  ${checklistHtml}
  ${priceListHtml}
  <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
</body>
</html>`;
}

// ── Checklist-only ────────────────────────────────────────────────────────────

function buildChecklistOnlyHtml(
  artworks: ArtworkForPrintMenu[],
  artworkData: Record<string, ArtworkFormDataForPrintMenu>,
  galleryName: string,
  printDate: string,
): string {
  const rows = artworks.map((artwork, idx) => {
    const form  = artworkData[artwork.id];
    const title  = escapeHtml(mergeField(form?.title,  artwork.title)  || 'Untitled');
    const artist = escapeHtml(mergeField(form?.artist_name, artwork.artist_name));
    const year   = getYear(form?.creation_date || artwork.creation_date);
    const medium = escapeHtml(mergeField(form?.medium, artwork.medium));
    const dims   = escapeHtml(mergeField(form?.dimensions, artwork.dimensions));
    return `<tr><td class="num">${idx + 1}</td><td class="title-cell">${title}${year ? `, ${year}` : ''}</td><td>${artist}</td><td>${medium}</td><td>${dims}</td></tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Checklist of Works — ${escapeHtml(galleryName)}</title>
  <style>
    @page { size: letter; margin: 0.75in; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #0e0b07; line-height: 1.5; }
    .header { border-top: 2pt solid #0e0b07; padding-top: 0.25in; margin-bottom: 0.35in; display: flex; justify-content: space-between; align-items: flex-end; }
    .header-gallery { font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; font-family: 'Helvetica Neue', Arial, sans-serif; font-weight: 400; color: #999; }
    .header-title { font-size: 22pt; font-weight: bold; line-height: 1.1; margin-top: 0.06in; }
    .header-meta { font-size: 7.5pt; color: #aaa; font-family: 'Helvetica Neue', Arial, sans-serif; letter-spacing: 0.06em; text-transform: uppercase; text-align: right; }
    table.checklist { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
    table.checklist thead tr { border-bottom: 0.75pt solid #0e0b07; }
    table.checklist th { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: #999; text-align: left; padding: 0 0.08in 0.06in 0; }
    table.checklist th:first-child { width: 0.3in; }
    table.checklist td { padding: 0.07in 0.08in 0.07in 0; vertical-align: top; border-bottom: 0.5pt solid #eae5df; color: #1a1209; line-height: 1.4; }
    table.checklist td.num { color: #ccc; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; }
    table.checklist td.title-cell { font-style: italic; }
    @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <div class="header-gallery">${escapeHtml(galleryName)}</div>
      <div class="header-title">Checklist of Works</div>
    </div>
    <div class="header-meta">${artworks.length} ${artworks.length === 1 ? 'work' : 'works'}<br />${escapeHtml(printDate)}</div>
  </div>
  <table class="checklist">
    <thead><tr><th>#</th><th>Title &amp; Year</th><th>Artist</th><th>Medium</th><th>Dimensions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
</body>
</html>`;
}

// ── PrintMenu component ───────────────────────────────────────────────────────

export function PrintMenu({
  artworks,
  artworkData,
  selectedArtworkIds,
  galleryName = 'Provenance',
}: {
  artworks: ArtworkForPrintMenu[];
  artworkData: Record<string, ArtworkFormDataForPrintMenu>;
  selectedArtworkIds: Set<string>;
  galleryName?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const [origin, setOrigin] = useState('');
  const [printingQR, setPrintingQR] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    setOrigin(window.location.origin);
  }, []);

  const selectedArtworks = artworks.filter((a) => selectedArtworkIds.has(a.id));
  const disabled = selectedArtworks.length === 0;

  const printDate = () =>
    new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // QR
  const handlePrintQR = async () => {
    if (!containerRef.current || disabled) return;
    console.log('[Collection] PrintMenu: Print QR', { count: selectedArtworks.length });
    setPrintingQR(true);
    try {
      const canvases = containerRef.current.querySelectorAll('canvas');
      const cells = selectedArtworks
        .map((artwork, idx) => {
          const canvas = canvases[idx] as HTMLCanvasElement | undefined;
          const dataUrl = canvas ? canvas.toDataURL('image/png') : '';
          const title  = escapeHtml(artwork.title || 'Untitled');
          const artist = artwork.artist_name ? escapeHtml(artwork.artist_name) : '';
          const cert   = artwork.certificate_number ? escapeHtml(artwork.certificate_number) : '';
          return `
            <div class="cell">
              ${dataUrl ? `<img src="${dataUrl}" alt="QR code for ${title}" />` : '<div class="qr-placeholder"></div>'}
              <div class="title">${title}</div>
              ${artist ? `<div class="artist">${artist}</div>` : ''}
              ${cert   ? `<div class="cert">${cert}</div>`     : ''}
            </div>`;
        })
        .join('');
      const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><title>QR Codes — Provenance</title>
<style>
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #1a1209; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.06in; }
  .cell { break-inside: avoid; page-break-inside: avoid; border: 0.4pt solid #d4c9b0; padding: 4pt 4pt 5pt; text-align: center; }
  .cell img, .qr-placeholder { display: block; margin: 0 auto; width: 1.5in; height: 1.5in; }
  .qr-placeholder { background: #f5f0e8; }
  .title  { margin-top: 4pt; font-size: 8pt; font-weight: bold; line-height: 1.25; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .artist { margin-top: 2pt; font-size: 7pt; color: #5a4a30; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .cert   { margin-top: 2pt; font-size: 5.5pt; color: #9a8060; font-family: 'Courier New', monospace; letter-spacing: 0.02em; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
</style></head>
<body><div class="grid">${cells}</div>
<script>window.onload = function () { window.print(); window.onafterprint = function () { window.close(); }; };</script>
</body></html>`;
      openPrintWindow(html, 860, 700);
    } finally {
      setPrintingQR(false);
    }
  };

  // Wall Labels
  const handlePrintWallLabels = () => {
    if (disabled) return;
    console.log('[Collection] PrintMenu: Wall Labels', { count: selectedArtworks.length });
    openPrintWindow(buildWallLabelsHtml(selectedArtworks, artworkData), 900, 720);
  };

  // Catalog
  const handlePrintCatalog = () => {
    if (disabled) return;
    console.log('[Collection] PrintMenu: Catalog', { count: selectedArtworks.length });
    openPrintWindow(buildCatalogHtml(selectedArtworks, artworkData, galleryName, printDate()));
  };

  // Checklist
  const handlePrintChecklist = () => {
    if (disabled) return;
    console.log('[Collection] PrintMenu: Checklist', { count: selectedArtworks.length });
    openPrintWindow(buildChecklistOnlyHtml(selectedArtworks, artworkData, galleryName, printDate()));
  };

  return (
    <>
      {/* Hidden QR canvas grid — must stay in the DOM for canvas.toDataURL() to work */}
      {mounted && (
        <div
          ref={containerRef}
          aria-hidden="true"
          style={{ position: 'fixed', left: -9999, top: -9999, pointerEvents: 'none', visibility: 'hidden' }}
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

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 min-h-9 px-3 text-xs font-serif touch-manipulation sm:h-7 sm:min-h-0 sm:px-2"
            title={
              disabled
                ? 'Select artworks to print'
                : `Print options for ${selectedArtworks.length} selected ${selectedArtworks.length === 1 ? 'artwork' : 'artworks'}`
            }
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" />
            Print
            <ChevronDown className="h-3 w-3 ml-1 opacity-60" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem
            onSelect={handlePrintQR}
            disabled={printingQR}
            className="text-xs font-serif cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 mr-2 opacity-60" />
            {printingQR ? 'Preparing…' : 'Print QR'}
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={handlePrintWallLabels}
            className="text-xs font-serif cursor-pointer"
          >
            <Tag className="h-3.5 w-3.5 mr-2 opacity-60" />
            Wall Labels
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            onSelect={handlePrintCatalog}
            className="text-xs font-serif cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5 mr-2 opacity-60" />
            Catalog
          </DropdownMenuItem>

          <DropdownMenuItem
            onSelect={handlePrintChecklist}
            className="text-xs font-serif cursor-pointer"
          >
            <List className="h-3.5 w-3.5 mr-2 opacity-60" />
            Checklist
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

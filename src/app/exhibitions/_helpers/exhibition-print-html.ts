import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';
import { parseDateOnly } from '~/lib/parse-date-only';

// ── Helpers ───────────────────────────────────────────────────────────────────

type PrintArtwork = ExhibitionWithDetails['artworks'][number];

function esc(str: string | null | undefined): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getYear(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseDateOnly(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 4) : String(d.getFullYear());
}

function formatRange(start: string, end: string | null): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric', year: 'numeric' };
  const s = parseDateOnly(start);
  if (!end) return s.toLocaleDateString('en-US', opts);
  const e = parseDateOnly(end);
  const startStr =
    s.getFullYear() === e.getFullYear()
      ? s.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
      : s.toLocaleDateString('en-US', opts);
  return `${startStr} – ${e.toLocaleDateString('en-US', opts)}`;
}

const AUTO_PRINT = `<script>window.onload = function () { setTimeout(function () { window.print(); }, 150); window.onafterprint = function () { window.close(); }; };</script>`;

// ── Wall label options ────────────────────────────────────────────────────────

export type WallLabelOptions = {
  year: boolean;
  medium: boolean;
  dimensions: boolean;
  edition: boolean;
  price: boolean;
  creditLine: boolean;
  description: boolean;
  qrCode: boolean;
  size: 'standard' | 'large';
};

export const DEFAULT_LABEL_OPTIONS: WallLabelOptions = {
  year: true,
  medium: true,
  dimensions: true,
  edition: true,
  price: false,
  creditLine: true,
  description: false,
  qrCode: true,
  size: 'standard',
};

// ── HTML builders ─────────────────────────────────────────────────────────────

export function buildExhibitionQrHtml(
  exhibition: ExhibitionWithDetails,
  ownerName: string | null,
  qrSvg: string,
  url: string,
): string {
  const dates = formatRange(exhibition.start_date, exhibition.end_date ?? null);
  const count = exhibition.artworks.length;
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Exhibition QR Code — ${esc(exhibition.title)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #0e0b07; background: #fff; }
  .sheet { min-height: 9.4in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .owner { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9pt; letter-spacing: 0.24em; text-transform: uppercase; color: #777; }
  .title { font-size: 34pt; font-weight: bold; line-height: 1.05; letter-spacing: -0.01em; margin-top: 0.15in; max-width: 6.5in; }
  .dates { font-size: 12pt; font-style: italic; color: #555; margin-top: 0.14in; }
  .location { font-size: 10pt; color: #777; margin-top: 0.04in; }
  .qr { width: 4.25in; height: 4.25in; margin: 0.45in auto 0.3in; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .cta { font-size: 14pt; font-weight: bold; }
  .sub { font-size: 10pt; color: #666; margin-top: 0.06in; }
  .url { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; color: #999; margin-top: 0.3in; letter-spacing: 0.03em; word-break: break-all; }
  .brand { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: #bbb; margin-top: 0.12in; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body><div class="sheet">
  ${ownerName ? `<div class="owner">${esc(ownerName)}</div>` : ''}
  <div class="title">${esc(exhibition.title)}</div>
  <div class="dates">${esc(dates)}</div>
  ${exhibition.location ? `<div class="location">${esc(exhibition.location)}</div>` : ''}
  <div class="qr">${qrSvg}</div>
  <div class="cta">Scan for the list of works</div>
  <div class="sub">${count > 0 ? `${count} ${count === 1 ? 'work' : 'works'} · ` : ''}titles, details and certificates</div>
  <div class="url">${esc(url)}</div>
  <div class="brand">Provenance</div>
</div>${AUTO_PRINT}</body></html>`;
}

export function buildWallLabelsHtml(
  exhibition: ExhibitionWithDetails,
  artworks: PrintArtwork[],
  options: WallLabelOptions,
  qrSvgs: Map<string, string>,
): string {
  const large = options.size === 'large';
  const widthIn = large ? 5 : 4;
  const minHeightIn = large ? 3.5 : 2.5;

  const cells = artworks
    .map((a) => {
      const year = options.year ? getYear(a.creation_date) : '';
      const title = esc(a.title || 'Untitled');
      const titleLine = year ? `${title}, ${year}` : title;
      const meta: string[] = [];
      if (options.medium && a.medium?.trim()) meta.push(esc(a.medium.trim()));
      if (options.dimensions && a.dimensions?.trim()) meta.push(esc(a.dimensions.trim()));
      if (options.edition && a.edition?.trim()) meta.push(`Edition ${esc(a.edition.trim())}`);
      if (options.price && a.listPriceDisplay?.trim()) meta.push(esc(a.listPriceDisplay.trim()));
      const credit = options.creditLine ? esc(a.credit_line) : '';
      const description = options.description ? esc(a.description?.trim()) : '';
      const qr = options.qrCode ? qrSvgs.get(a.id) ?? '' : '';

      return `
      <div class="label">
        <div class="body">
          ${a.artist_name ? `<div class="artist">${esc(a.artist_name)}</div>` : ''}
          <div class="title">${titleLine}</div>
          ${meta.map((m) => `<div class="meta">${m}</div>`).join('')}
          ${credit ? `<div class="credit">${credit}</div>` : ''}
          ${description ? `<div class="description">${description}</div>` : ''}
        </div>
        ${qr ? `<div class="qr-col"><div class="qr">${qr}</div><div class="qr-caption">Scan for certificate</div></div>` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Wall Labels — ${esc(exhibition.title)}</title>
<style>
  @page { size: letter landscape; margin: 0.5in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #111; }
  .grid { display: flex; flex-wrap: wrap; gap: 0.25in; align-items: flex-start; }
  .label {
    width: ${widthIn}in; min-height: ${minHeightIn}in;
    break-inside: avoid; page-break-inside: avoid;
    border: 0.5pt solid #d0cdc8; padding: 0.16in 0.18in;
    display: flex; gap: 0.16in; align-items: flex-start;
  }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .artist { font-size: ${large ? 12 : 10}pt; font-weight: bold; line-height: 1.25; margin-bottom: 6px; }
  .title { font-size: ${large ? 11 : 9.5}pt; font-style: italic; line-height: 1.3; }
  .meta { font-size: ${large ? 10 : 9}pt; line-height: 1.4; }
  .credit { font-size: ${large ? 9 : 8}pt; color: #555; margin-top: 3px; }
  .description { font-size: ${large ? 9 : 7.5}pt; line-height: 1.5; color: #333; margin-top: 8px; }
  .qr-col { flex: none; width: ${large ? 1 : 0.8}in; text-align: center; }
  .qr svg { width: 100%; height: auto; display: block; }
  .qr-caption { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 5.5pt; color: #888; letter-spacing: 0.04em; margin-top: 2px; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body><div class="grid">${cells}</div>${AUTO_PRINT}</body></html>`;
}

export function buildChecklistHtml(
  exhibition: ExhibitionWithDetails,
  ownerName: string | null,
  qrSvg: string,
): string {
  const dates = formatRange(exhibition.start_date, exhibition.end_date ?? null);
  const rows = exhibition.artworks
    .map((a, i) => {
      const year = getYear(a.creation_date);
      return `<tr><td class="num">${i + 1}</td><td>${esc(a.artist_name)}</td><td class="t">${esc(a.title || 'Untitled')}${year ? `, ${year}` : ''}</td><td>${esc(a.medium)}</td><td>${esc(a.dimensions)}</td><td class="price">${esc(a.listPriceDisplay)}</td></tr>`;
    })
    .join('');
  const hasPrices = exhibition.artworks.some((a) => a.listPriceDisplay);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Checklist — ${esc(exhibition.title)}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #0e0b07; background: #fff; line-height: 1.5; }
  .header { border-top: 2pt solid #0e0b07; padding-top: 0.22in; margin-bottom: 0.35in; display: flex; justify-content: space-between; gap: 0.3in; align-items: flex-start; }
  .owner { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #999; }
  .title { font-size: 22pt; font-weight: bold; line-height: 1.1; margin-top: 0.06in; }
  .dates { font-size: 9.5pt; font-style: italic; color: #666; margin-top: 0.06in; }
  .qr { width: 0.95in; flex: none; text-align: center; }
  .qr svg { width: 100%; height: auto; display: block; }
  .qr div { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 5.5pt; color: #999; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  thead tr { border-bottom: 0.75pt solid #0e0b07; }
  th { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: #999; text-align: left; padding: 0 0.08in 0.06in 0; }
  td { padding: 0.07in 0.08in 0.07in 0; vertical-align: top; border-bottom: 0.5pt solid #eae5df; }
  td.num { color: #bbb; font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; width: 0.3in; }
  td.t { font-style: italic; }
  .price { text-align: right; white-space: nowrap; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <div class="header">
    <div>
      ${ownerName ? `<div class="owner">${esc(ownerName)}</div>` : ''}
      <div class="title">${esc(exhibition.title)}</div>
      <div class="dates">${esc(dates)}${exhibition.location ? ` · ${esc(exhibition.location)}` : ''}</div>
    </div>
    <div class="qr">${qrSvg}<div>Scan to view online</div></div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Artist</th><th>Title &amp; Year</th><th>Medium</th><th>Dimensions</th>${hasPrices ? '<th class="price">Price</th>' : '<th></th>'}</tr></thead>
    <tbody>${rows}</tbody>
  </table>
${AUTO_PRINT}</body></html>`;
}


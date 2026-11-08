import type { ExhibitionWithDetails } from '../_actions/get-exhibitions';
import { parseDateOnly } from '~/lib/parse-date-only';
import type { PosterText } from './poster-text';
import { formatPrintPrice } from '~/lib/print-price';

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
  /** Prefix prices with "$"; off prints e.g. "12,000". */
  priceSymbol: boolean;
  creditLine: boolean;
  description: boolean;
  artistBio: boolean;
  qrCode: boolean;
  size: 'standard' | 'large';
  /**
   * compact: each label is only as tall as its text, packed in columns to fit
   * the most on a page. institutional: every label the same height in a grid,
   * text shrunk slightly if a label runs long.
   */
  layout: 'compact' | 'institutional';
  /** Where the QR codes sit on each label. */
  qrPosition: 'top' | 'bottom';
};

/** Label sizes on US Letter. Widths are chosen so two labels fill a row. */
export const LABEL_GEOMETRY = {
  standard: { orientation: 'portrait', widthIn: 3.8, heightIn: 2.45, colGapIn: 0.2, rowGapIn: 0.15, cols: 2, rows: 4 },
  large: { orientation: 'landscape', widthIn: 5, heightIn: 3.6, colGapIn: 0.3, rowGapIn: 0.2, cols: 2, rows: 2 },
} as const;

/** Page margin for wall labels (all sides). */
const LABEL_PAGE_MARGIN_IN = 0.35;

export const DEFAULT_LABEL_OPTIONS: WallLabelOptions = {
  year: true,
  medium: true,
  dimensions: true,
  edition: true,
  price: false,
  priceSymbol: true,
  creditLine: true,
  description: false,
  artistBio: false,
  qrCode: true,
  size: 'standard',
  layout: 'institutional',
  qrPosition: 'top',
};

// ── HTML builders ─────────────────────────────────────────────────────────────

/** The flyer's lines before any edits (see poster-text.ts). */
export function posterDefaults(
  exhibition: ExhibitionWithDetails,
  ownerName: string | null,
  url: string,
): PosterText {
  const count = exhibition.artworks.length;
  return {
    owner: ownerName ?? '',
    title: exhibition.title,
    dates: formatRange(exhibition.start_date, exhibition.end_date ?? null),
    location: exhibition.location ?? '',
    cta: 'Scan for the list of works',
    sub: `${count > 0 ? `${count} ${count === 1 ? 'work' : 'works'} · ` : ''}titles, details and certificates`,
    url,
    brand: 'Provenance',
  };
}

/** Escapes a line and keeps the line breaks typed into it. */
function lines(str: string): string {
  return esc(str).replace(/\n/g, '<br />');
}

export function buildExhibitionQrHtml(text: PosterText, qrSvg: string): string {
  const line = (cls: string, value: string) => (value ? `<div class="${cls}">${lines(value)}</div>` : '');
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Exhibition QR Code — ${esc(text.title.replace(/\n/g, ' ') || 'Exhibition')}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #0e0b07; background: #fff; }
  .sheet { min-height: 9.4in; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .owner { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 9pt; letter-spacing: 0.24em; text-transform: uppercase; color: #777; margin-bottom: 0.15in; }
  .title { font-size: 34pt; font-weight: bold; line-height: 1.05; letter-spacing: -0.01em; max-width: 6.5in; }
  .dates { font-size: 12pt; font-style: italic; color: #555; margin-top: 0.14in; }
  .location { font-size: 10pt; color: #777; margin-top: 0.04in; }
  .qr { width: 4.25in; height: 4.25in; margin: 0.45in auto 0.3in; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .cta { font-size: 14pt; font-weight: bold; }
  .sub { font-size: 10pt; color: #666; margin-top: 0.06in; max-width: 6in; }
  .url { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7.5pt; color: #999; margin-top: 0.3in; letter-spacing: 0.03em; word-break: break-all; }
  .brand { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: #bbb; margin-top: 0.12in; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body><div class="sheet">
  ${line('owner', text.owner)}
  ${line('title', text.title)}
  ${line('dates', text.dates)}
  ${line('location', text.location)}
  <div class="qr">${qrSvg}</div>
  ${line('cta', text.cta)}
  ${line('sub', text.sub)}
  ${line('url', text.url)}
  ${line('brand', text.brand)}
</div>${AUTO_PRINT}</body></html>`;
}

/** One wall label's text, from an exhibition work or a collection work. */
export type WallLabelItem = {
  id: string;
  title: string | null;
  artist_name: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  /** Raw price text; formatted with formatPrintPrice. */
  price: string | null;
  credit_line: string | null;
  description: string | null;
};

export function exhibitionLabelItems(artworks: PrintArtwork[]): WallLabelItem[] {
  return artworks.map((a) => ({
    id: a.id,
    title: a.title,
    artist_name: a.artist_name,
    creation_date: a.creation_date,
    medium: a.medium,
    dimensions: a.dimensions,
    edition: a.edition,
    price: a.listPriceDisplay ?? null,
    credit_line: a.credit_line ?? null,
    description: a.description ?? null,
  }));
}

/** A QR code printed on a label: SVG or <img> markup, and a short caption. */
export type LabelQr = { html: string; caption: string };

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Wall labels on US Letter, two across. "compact" packs labels that are only
 * as tall as their text into columns; "institutional" prints a uniform grid
 * (8 standard or 4 large per page) and shrinks text (to two-thirds at most) on any label that runs long.
 */
export function buildWallLabelsHtml(
  /** Shown in the print window's title, e.g. the exhibition or gallery name. */
  docTitle: string,
  items: WallLabelItem[],
  options: WallLabelOptions,
  qrSvgs: Map<string, string>,
  /** Artwork id → artist bio text, used when options.artistBio is on. */
  artistBios: Map<string, string> = new Map(),
  /** Extra QR codes for a work (e.g. the artist's own), after the certificate code. */
  extraQrs: (artworkId: string) => LabelQr[] = () => [],
): string {
  const large = options.size === 'large';
  const g = LABEL_GEOMETRY[options.size] ?? LABEL_GEOMETRY.standard;
  const institutional = options.layout !== 'compact';
  const qrBase = large ? 1 : 0.8;

  const label = (a: WallLabelItem) => {
    const year = options.year ? getYear(a.creation_date) : '';
    const title = esc(a.title || 'Untitled');
    const titleLine = year ? `${title}, ${year}` : title;
    const meta: string[] = [];
    if (options.medium && a.medium?.trim()) meta.push(esc(a.medium.trim()));
    if (options.dimensions && a.dimensions?.trim()) meta.push(esc(a.dimensions.trim()));
    if (options.edition && a.edition?.trim()) meta.push(`Edition ${esc(a.edition.trim())}`);
    if (options.price) {
      const price = formatPrintPrice(a.price, options.priceSymbol);
      if (price) meta.push(esc(price));
    }
    const credit = options.creditLine ? esc(a.credit_line?.trim()) : '';
    const description = options.description ? esc(a.description?.trim()) : '';
    const bio = options.artistBio ? esc(artistBios.get(a.id)?.trim()) : '';

    const codes: LabelQr[] = [];
    const cert = options.qrCode ? qrSvgs.get(a.id) ?? '' : '';
    if (cert) codes.push({ html: cert, caption: 'Scan for certificate' });
    codes.push(...extraQrs(a.id).filter((c) => c.html));
    // Smaller codes as more share the column; three or more go two across.
    const n = codes.length;
    const size = n <= 1 ? qrBase : n === 2 ? qrBase * 0.8 : qrBase * 0.68;
    const qrCol = n
      ? `<div class="qr-col${n >= 3 ? ' two' : ''}" style="--qs:${size.toFixed(2)}in">${codes
          .map(
            (c) =>
              `<div class="qr-item"><div class="qr">${c.html}</div>${c.caption ? `<div class="qr-caption">${esc(c.caption)}</div>` : ''}</div>`,
          )
          .join('')}</div>`
      : '';

    return `
      <div class="label">
        <div class="body">
          ${a.artist_name ? `<div class="artist">${esc(a.artist_name)}</div>` : ''}
          <div class="title">${titleLine}</div>
          ${meta.map((m) => `<div class="meta">${m}</div>`).join('')}
          ${credit ? `<div class="credit">${credit}</div>` : ''}
          ${description ? `<div class="description">${description}</div>` : ''}
          ${bio ? `<div class="bio">${bio.replace(/\n+/g, '<br />')}</div>` : ''}
        </div>
        ${qrCol}
      </div>`;
  };

  const body = institutional
    ? chunk(items, g.cols * g.rows)
        .map((page) => `<div class="sheet">${page.map(label).join('')}</div>`)
        .join('')
    : `<div class="flow">${items.map(label).join('')}</div>`;

  // Institutional labels have a fixed height: shrink the text of any that
  // overflow (down to 70%) before printing.
  const fitScript = institutional
    ? `<script>function fitLabels(){document.querySelectorAll('.label').forEach(function(el){var b=el.querySelector('.body');var k=1;while(b&&b.scrollHeight>b.clientHeight+1&&k>0.66){k-=0.04;el.style.setProperty('--k',k.toFixed(2));}});}</script>`
    : '<script>function fitLabels(){}</script>';

  const pt = (n: number) => `calc(var(--k, 1) * ${n}pt)`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Wall Labels — ${esc(docTitle)}</title>
<style>
  @page { size: letter ${g.orientation}; margin: ${LABEL_PAGE_MARGIN_IN}in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #111; }
  .sheet {
    display: grid;
    grid-template-columns: repeat(${g.cols}, ${g.widthIn}in);
    grid-auto-rows: ${g.heightIn}in;
    column-gap: ${g.colGapIn}in; row-gap: ${g.rowGapIn}in;
    break-after: page; page-break-after: always;
  }
  .sheet:last-child { break-after: auto; page-break-after: auto; }
  .sheet .label { height: ${g.heightIn}in; overflow: hidden; }
  .sheet .body { overflow: hidden; }
  .flow { width: ${(g.widthIn * g.cols + g.colGapIn * (g.cols - 1)).toFixed(2)}in; column-count: ${g.cols}; column-gap: ${g.colGapIn}in; column-fill: auto; }
  .flow .label { margin-bottom: 0.12in; }
  .label {
    width: ${g.widthIn}in;
    break-inside: avoid; page-break-inside: avoid;
    border: 0.5pt solid #d0cdc8; padding: ${institutional ? '0.16in 0.18in' : '0.12in 0.14in'};
    display: flex; gap: 0.14in; align-items: stretch;
  }
  .body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .artist { font-size: ${pt(large ? 12 : 10)}; font-weight: bold; line-height: 1.25; margin-bottom: 5px; }
  .title { font-size: ${pt(large ? 11 : 9.5)}; font-style: italic; line-height: 1.3; }
  .meta { font-size: ${pt(large ? 10 : 9)}; line-height: 1.4; }
  .credit { font-size: ${pt(large ? 9 : 8)}; color: #555; margin-top: 3px; }
  .description { font-size: ${pt(large ? 9 : 7.5)}; line-height: 1.45; color: #333; margin-top: 6px; }
  .bio { font-size: ${pt(large ? 8.5 : 7)}; line-height: 1.45; color: #555; margin-top: 6px; padding-top: 5px; border-top: 0.5pt solid #e5e0da; }
  .qr-col { flex: none; display: grid; grid-template-columns: var(--qs); gap: 0.06in; align-content: ${options.qrPosition === 'bottom' ? 'end' : 'start'}; }
  .qr-col.two { grid-template-columns: var(--qs) var(--qs); }
  .qr-item { width: var(--qs); text-align: center; }
  .qr svg, .qr img { width: 100%; height: auto; display: block; }
  .qr-caption { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 5.5pt; line-height: 1.2; color: #888; letter-spacing: 0.02em; margin-top: 2px; overflow-wrap: anywhere; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>${fitScript}</head>
<body>${body}<script>window.onload = function () { fitLabels(); setTimeout(function () { window.print(); }, 150); window.onafterprint = function () { window.close(); }; };</script></body></html>`;
}

export function buildChecklistHtml(
  exhibition: ExhibitionWithDetails,
  ownerName: string | null,
  qrSvg: string,
  priceSymbol: boolean,
): string {
  const dates = formatRange(exhibition.start_date, exhibition.end_date ?? null);
  const rows = exhibition.artworks
    .map((a, i) => {
      const year = getYear(a.creation_date);
      return `<tr><td class="num">${i + 1}</td><td>${esc(a.artist_name)}</td><td class="t">${esc(a.title || 'Untitled')}${year ? `, ${year}` : ''}</td><td>${esc(a.medium)}</td><td>${esc(a.dimensions)}</td><td class="price">${esc(formatPrintPrice(a.listPriceDisplay, priceSymbol))}</td></tr>`;
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


/** One cell of the artwork QR sheet. */
export type QrSheetItem = {
  id: string;
  title: string | null;
  artist_name: string | null;
  certificate_number: string | null;
};

/**
 * One QR code per work, linking to its certificate — 4 across on US Letter,
 * with title, artist and certificate number under each.
 */
export function buildArtworkQrSheetHtml(
  /** Exhibition title or gallery name, printed above the grid. */
  heading: string,
  items: QrSheetItem[],
  qrSvgs: Map<string, string>,
): string {
  const cells = items
    .map((a) => {
      const qr = qrSvgs.get(a.id) ?? '';
      return `
      <div class="cell">
        <div class="qr">${qr}</div>
        <div class="title">${esc(a.title || 'Untitled')}</div>
        ${a.artist_name ? `<div class="artist">${esc(a.artist_name)}</div>` : ''}
        ${a.certificate_number ? `<div class="cert">${esc(a.certificate_number)}</div>` : ''}
      </div>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>Artwork QR Codes — ${esc(heading)}</title>
<style>
  @page { size: letter; margin: 0.45in; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #1a1209; }
  .head { font-size: 9pt; color: #777; margin-bottom: 0.15in; }
  .head strong { color: #1a1209; font-size: 11pt; }
  .grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.06in; }
  .cell { break-inside: avoid; page-break-inside: avoid; border: 0.4pt solid #d4c9b0; padding: 4pt 4pt 5pt; text-align: center; }
  .qr { width: 1.5in; height: 1.5in; margin: 0 auto; }
  .qr svg { width: 100%; height: 100%; display: block; }
  .title { margin-top: 4pt; font-size: 8pt; font-weight: bold; line-height: 1.25; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .artist { margin-top: 2pt; font-size: 7pt; color: #5a4a30; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  .cert { margin-top: 2pt; font-size: 5.5pt; color: #9a8060; font-family: 'Courier New', monospace; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style></head>
<body>
  <div class="head">${heading ? `<strong>${esc(heading)}</strong> · ` : ''}${items.length} ${items.length === 1 ? 'work' : 'works'} · each code opens the work's certificate</div>
  <div class="grid">${cells}</div>
${AUTO_PRINT}</body></html>`;
}

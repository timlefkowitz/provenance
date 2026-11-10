import { formatPrintPrice } from '~/lib/print-price';
import { parseDateOnly } from '~/lib/parse-date-only';

/**
 * Printed catalogs for an exhibition or a selection of collection works, in
 * three looks:
 *
 * - standard: the classic catalog — cover, one plate per work with its image
 *   beside the text, checklist and price list.
 * - editorial: the app's navbar look — bone paper, the italic "Provenance."
 *   wordmark with its vermillion dot, mono uppercase labels and hairline
 *   rules, four works to a page.
 * - monograph: image first — a dark cover, each work alone on a page with a
 *   quiet caption beneath, and a dark back page with the show's QR code.
 *
 * Every style prints on US Letter and ends with a checklist (and a price list
 * when prices are on).
 */

export type CatalogStyle = 'standard' | 'editorial' | 'monograph';

export const CATALOG_STYLES: Array<{ value: CatalogStyle; label: string; hint: string }> = [
  { value: 'standard', label: 'Standard', hint: 'Classic plates, image beside text' },
  { value: 'editorial', label: 'Editorial', hint: 'Our navbar look, four to a page' },
  { value: 'monograph', label: 'Monograph', hint: 'One work per page, image first' },
];

export type CatalogItem = {
  id: string;
  title: string | null;
  artist_name: string | null;
  creation_date: string | null;
  medium: string | null;
  dimensions: string | null;
  edition: string | null;
  description: string | null;
  /** Owner, collection or credit line. */
  credit_line: string | null;
  image_url: string | null;
  /** Raw price text, only when it may be printed (public); formatted with formatPrintPrice. */
  price: string | null;
  formerOwners?: string | null;
  auctionHistory?: string | null;
  exhibitionHistory?: string | null;
  historicContext?: string | null;
};

export type CatalogMeta = {
  /** Small line above the title: gallery, institution or owner name. */
  kicker: string;
  /** "Collection Catalog" or the exhibition's title. */
  title: string;
  /** Dates and place, or the number of works. */
  subtitle: string;
  /** Opening text (the show's description), plain text with line breaks. */
  introduction?: string | null;
  /** Printed on the cover. */
  printDate: string;
  /** The exhibition's QR code, printed on the cover or back page. */
  qrSvg?: string;
  /** What kind of catalog, e.g. "Exhibition catalogue". */
  label: string;
};

/** The name above the title: the owner's (gallery, institution) or ours. */
export type CatalogCoverName = 'owner' | 'provenance';

export type CatalogOptions = {
  style: CatalogStyle;
  coverName: CatalogCoverName;
  /** Price list at the end (and the price under each work in editorial). */
  prices: boolean;
  priceSymbol: boolean;
  descriptions: boolean;
  /** Former owners, auction and exhibition history (collection works). */
  provenance: boolean;
  /** A small certificate QR code by each work. */
  qrCodes: boolean;
  artistBios: boolean;
  checklist: boolean;
};

export const DEFAULT_CATALOG_OPTIONS: CatalogOptions = {
  style: 'standard',
  coverName: 'owner',
  prices: true,
  priceSymbol: true,
  descriptions: true,
  provenance: true,
  qrCodes: false,
  artistBios: false,
  checklist: true,
};

/** An artist and their bio, for the "About the artists" pages. */
export type CatalogArtist = {
  name: string;
  bio: string;
  /** Museum line, e.g. "Nigerian, b. 1984, Lagos". */
  tombstone?: string;
  statement?: string;
};

/** One artist's block: name, tombstone line, bio and statement. */
function artistBlock(a: CatalogArtist): string {
  const tomb = a.tombstone?.trim() ? `<div class="bio-tomb">${esc(a.tombstone.trim())}</div>` : '';
  const statement = a.statement?.trim()
    ? `<div class="bio-statement"><div class="bio-label">Artist statement</div>${paragraphs(a.statement)}</div>`
    : '';
  return `<div class="bio"><div class="bio-name">${esc(a.name)}</div>${tomb}${a.bio.trim() ? paragraphs(a.bio) : ''}${statement}</div>`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export function esc(str: string | null | undefined): string {
  return (str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getYear(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseDateOnly(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 4) : String(d.getFullYear());
}

export function paragraphs(text: string | null | undefined): string {
  return (text ?? '')
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

const num = (i: number) => String(i + 1).padStart(2, '0');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

type Work = {
  item: CatalogItem;
  title: string;
  artist: string;
  year: string;
  titleLine: string;
  medium: string;
  dimensions: string;
  edition: string;
  credit: string;
  description: string;
  price: string;
  provenance: Array<[string, string]>;
  qr: string;
};

function prepare(items: CatalogItem[], options: CatalogOptions, qrSvgs: Map<string, string>): Work[] {
  return items.map((item) => {
    const title = esc(item.title?.trim() || 'Untitled');
    const year = getYear(item.creation_date);
    const provenance: Array<[string, string]> = options.provenance
      ? (
          [
            ['Provenance', item.formerOwners],
            ['Auction history', item.auctionHistory],
            ['Exhibition history', item.exhibitionHistory],
            ['Historic context', item.historicContext],
          ] as Array<[string, string | null | undefined]>
        )
          .filter(([, v]) => v?.trim())
          .map(([k, v]) => [k, esc(v!.trim())])
      : [];
    return {
      item,
      title,
      artist: esc(item.artist_name?.trim()),
      year,
      titleLine: year ? `${title}, ${year}` : title,
      medium: esc(item.medium?.trim()),
      dimensions: esc(item.dimensions?.trim()),
      edition: esc(item.edition?.trim()),
      credit: esc(item.credit_line?.trim()),
      description: options.descriptions ? esc(item.description?.trim()) : '',
      price: options.prices ? esc(formatPrintPrice(item.price, options.priceSymbol)) : '',
      provenance,
      qr: options.qrCodes ? qrSvgs.get(item.id) ?? '' : '',
    };
  });
}

function imageTag(url: string | null, cls = ''): string {
  return url
    ? `<img class="${cls}" src="${esc(url)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'noimg',textContent:'No image'}))" />`
    : `<div class="noimg">No image</div>`;
}

/** Waits for images and web fonts (up to a few seconds) before printing. */
export const PRINT_WHEN_READY = `<script>
(function () {
  var printed = false;
  function go() { if (printed) return; printed = true; setTimeout(function () { window.print(); }, 200); }
  window.onafterprint = function () { window.close(); };
  window.addEventListener('load', function () {
    var fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    fonts.then(go, go);
    setTimeout(go, 4000);
  });
})();
</script>`;

function tableRows(works: Work[], withPrice: boolean): string {
  return works
    .map(
      (w, i) =>
        `<tr><td class="num">${i + 1}</td><td>${w.artist}</td><td class="t">${w.titleLine}</td><td>${w.medium}</td><td>${w.dimensions}</td>${withPrice ? `<td class="price">${w.price}</td>` : ''}</tr>`,
    )
    .join('');
}

function checklistTable(works: Work[]): string {
  return `<table class="list"><thead><tr><th>#</th><th>Artist</th><th>Title &amp; year</th><th>Medium</th><th>Dimensions</th></tr></thead><tbody>${tableRows(works, false)}</tbody></table>`;
}

function priceTable(works: Work[]): string {
  const priced = works.filter((w) => w.price);
  return `<table class="list"><thead><tr><th>#</th><th>Artist</th><th>Title &amp; year</th><th>Medium</th><th>Dimensions</th><th class="price">Price</th></tr></thead><tbody>${tableRows(priced, true)}</tbody></table>`;
}

function doc(title: string, fonts: string, css: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
${fonts}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @media print { * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
${css}
</style></head>
<body>${body}${PRINT_WHEN_READY}</body></html>`;
}

// ── Standard ──────────────────────────────────────────────────────────────────

function buildStandard(meta: CatalogMeta, works: Work[], options: CatalogOptions, artists: CatalogArtist[]): string {
  const hero = works.find((w) => w.item.image_url)?.item.image_url;
  const cover = `
    <div class="cover">
      <div class="cover-top">
        ${meta.kicker ? `<div class="cover-gallery">${esc(meta.kicker)}</div>` : ''}
        <div class="cover-title">${esc(meta.title)}</div>
        ${meta.subtitle ? `<div class="cover-subtitle">${esc(meta.subtitle)}</div>` : ''}
      </div>
      ${hero ? `<div class="cover-hero">${imageTag(hero)}</div>` : '<div class="cover-hero"></div>'}
      <div class="cover-bottom">
        <span class="cover-count">${plural(works.length, 'work')}</span>
        ${meta.qrSvg ? `<span class="cover-qr">${meta.qrSvg}<span>Scan to view online</span></span>` : ''}
        <span class="cover-date">${esc(meta.printDate)}</span>
      </div>
    </div>`;

  const intro = meta.introduction?.trim()
    ? `<div class="section-header"><div class="section-label">${esc(meta.label)}</div><div class="section-title">Introduction</div></div>
       <div class="intro">${paragraphs(meta.introduction)}</div>`
    : '';

  const plates = `
    <div class="section-header"><div class="section-label">Catalog</div><div class="section-title">Works</div></div>
    ${works
      .map((w, idx) => {
        const fields: string[] = [];
        if (w.medium) fields.push(`<span class="plate-field-label">Medium</span>${w.medium}`);
        if (w.dimensions) fields.push(`<span class="plate-field-label">Dimensions</span>${w.dimensions}`);
        if (w.edition) fields.push(`<span class="plate-field-label">Edition</span>${w.edition}`);
        if (w.credit) fields.push(`<span class="plate-field-label">Collection</span>${w.credit}`);
        const prov = w.provenance.length
          ? `<div class="plate-provenance"><div class="plate-prov-heading">Provenance &amp; History</div>${w.provenance
              .map(([k, v]) => `<strong>${k}:</strong> ${v}`)
              .join('<br />')}</div>`
          : '';
        return `
        <div class="plate">
          <div class="plate-image-wrap">${imageTag(w.item.image_url)}</div>
          <div class="plate-meta">
            <div class="plate-num">No. ${num(idx)}</div>
            ${w.artist ? `<div class="plate-artist">${w.artist}</div>` : ''}
            <div class="plate-title">${w.titleLine}</div>
            ${fields.map((f) => `<div class="plate-field">${f}</div>`).join('')}
            ${w.description ? `<div class="plate-description">${w.description}</div>` : ''}
            ${prov}
            ${w.qr ? `<div class="plate-qr">${w.qr}<span>Scan for certificate</span></div>` : ''}
          </div>
        </div>`;
      })
      .join('')}`;

  const bios = artists.length
    ? `<div class="section-header"><div class="section-label">Biographies</div><div class="section-title">About the Artists</div></div>
       ${artists.map(artistBlock).join('')}`
    : '';

  const checklist = options.checklist
    ? `<div class="section-header"><div class="section-label">Complete listing</div><div class="section-title">Checklist of Works</div></div>${checklistTable(works)}`
    : '';

  const prices =
    options.prices && works.some((w) => w.price)
      ? `<div class="section-header"><div class="section-label confidential">For Collectors — Confidential</div><div class="section-title">Price List</div></div>${priceTable(works)}`
      : '';

  const sans = `'Helvetica Neue', Arial, sans-serif`;
  const css = `
  @page { size: letter; margin: 0.75in; }
  body { font-family: Georgia, 'Times New Roman', serif; background: #fff; color: #0e0b07; line-height: 1.5; }
  .cover { page-break-after: always; break-after: page; min-height: 9.4in; display: flex; flex-direction: column; justify-content: space-between; }
  .cover-top { border-top: 2pt solid #0e0b07; padding-top: 0.3in; }
  .cover-gallery { font-size: 8.5pt; letter-spacing: 0.2em; text-transform: uppercase; font-family: ${sans}; color: #666; }
  .cover-title { font-size: 38pt; font-weight: bold; line-height: 1.05; letter-spacing: -0.01em; margin-top: 0.12in; }
  .cover-subtitle { font-size: 11pt; font-style: italic; color: #666; margin-top: 0.08in; }
  .cover-hero { flex: 1; display: flex; align-items: center; justify-content: center; padding: 0.4in 0; overflow: hidden; }
  .cover-hero img { max-width: 100%; max-height: 5in; object-fit: contain; display: block; }
  .cover-bottom { border-top: 0.5pt solid #ccc; padding-top: 0.15in; display: flex; justify-content: space-between; align-items: flex-end; gap: 0.2in; }
  .cover-count, .cover-date { font-size: 7.5pt; color: #888; font-family: ${sans}; letter-spacing: 0.06em; text-transform: uppercase; }
  .cover-qr { width: 0.8in; text-align: center; font-family: ${sans}; font-size: 5.5pt; color: #999; }
  .cover-qr svg { width: 100%; height: auto; display: block; margin-bottom: 2px; }
  .section-header { page-break-before: always; break-before: page; border-top: 2pt solid #0e0b07; padding-top: 0.25in; margin-bottom: 0.45in; }
  .section-label { font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; font-family: ${sans}; color: #999; }
  .section-label.confidential { color: #b03030; }
  .section-title { font-size: 22pt; font-weight: bold; line-height: 1.1; margin-top: 0.06in; }
  .intro { column-count: 2; column-gap: 0.4in; font-size: 10pt; line-height: 1.7; color: #222; }
  .intro p + p { margin-top: 0.12in; }
  .plate { display: grid; grid-template-columns: 55% 1fr; gap: 0.45in; padding-bottom: 0.55in; page-break-inside: avoid; break-inside: avoid; }
  .plate + .plate { border-top: 0.5pt solid #e0d9d0; padding-top: 0.55in; }
  .plate-image-wrap { display: flex; align-items: flex-start; justify-content: center; }
  .plate-image-wrap img { max-width: 100%; max-height: 5.5in; object-fit: contain; display: block; }
  .noimg { width: 100%; aspect-ratio: 4/3; background: #f5f0eb; display: flex; align-items: center; justify-content: center; color: #ccc; font-size: 8pt; font-family: ${sans}; letter-spacing: 0.08em; text-transform: uppercase; }
  .plate-meta { display: flex; flex-direction: column; gap: 0.1in; padding-top: 0.04in; }
  .plate-num { font-size: 7.5pt; color: #bbb; font-family: ${sans}; letter-spacing: 0.1em; }
  .plate-artist { font-size: 11.5pt; font-weight: bold; line-height: 1.2; }
  .plate-title { font-size: 10pt; font-style: italic; color: #1a1209; line-height: 1.3; }
  .plate-field { font-size: 8.5pt; color: #444; line-height: 1.5; }
  .plate-field-label { font-family: ${sans}; font-size: 6.5pt; color: #aaa; letter-spacing: 0.12em; text-transform: uppercase; display: block; margin-bottom: 1px; }
  .plate-description { font-size: 8pt; color: #555; line-height: 1.65; font-style: italic; border-left: 1.5pt solid #ddd; padding-left: 0.1in; }
  .plate-provenance { font-size: 7.5pt; color: #666; line-height: 1.55; border-top: 0.5pt solid #e5e0da; padding-top: 0.08in; }
  .plate-prov-heading { font-family: ${sans}; font-size: 6.5pt; color: #aaa; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 4px; }
  .plate-qr { width: 0.75in; font-family: ${sans}; font-size: 5.5pt; color: #999; text-align: center; margin-top: 0.04in; }
  .plate-qr svg { width: 100%; height: auto; display: block; margin-bottom: 2px; }
  .bio { break-inside: avoid; margin-bottom: 0.3in; font-size: 9.5pt; line-height: 1.65; color: #333; }
  .bio-name { font-size: 11.5pt; font-weight: bold; color: #0e0b07; margin-bottom: 0.05in; }
  .bio p + p { margin-top: 0.08in; }
  .bio-tomb { font-style: italic; opacity: 0.7; margin-bottom: 0.06in; }
  .bio-statement { margin-top: 0.1in; }
  .bio-label { font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.04in; }
  table.list { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.list thead tr { border-bottom: 0.75pt solid #0e0b07; }
  table.list th { font-family: ${sans}; font-size: 7pt; font-weight: 400; letter-spacing: 0.12em; text-transform: uppercase; color: #999; text-align: left; padding: 0 0.08in 0.06in 0; }
  table.list td { padding: 0.07in 0.08in 0.07in 0; vertical-align: top; border-bottom: 0.5pt solid #eae5df; color: #1a1209; line-height: 1.4; }
  table.list td.num { color: #ccc; font-family: ${sans}; font-size: 7.5pt; width: 0.3in; }
  table.list td.t { font-style: italic; }
  table.list .price { text-align: right; white-space: nowrap; }
  table.list td.price { font-family: ${sans}; }`;

  return doc(`${meta.title} — Catalog`, '', css, `${cover}${intro}${plates}${bios}${checklist}${prices}`);
}

// ── Editorial (navbar look) ───────────────────────────────────────────────────

/** Approximations of the app's oklch tokens (globals.css) for print. */
const ED = {
  bone: '#f6f1e7',
  ink: '#1c1814',
  vermillion: '#e2462c',
  gilt: '#d6a841',
  rule: '#2a2520',
  muted: '#6f675d',
};

function buildEditorial(meta: CatalogMeta, works: Work[], options: CatalogOptions, artists: CatalogArtist[]): string {
  const sections = ['Catalogue', 'Works', options.checklist ? 'Index' : null, options.prices && works.some((w) => w.price) ? 'Prices' : null].filter(Boolean) as string[];
  const bar = (active: string, right = meta.kicker) => `
    <div class="bar">
      <div class="wordmark">Provenance<span>.</span></div>
      <div class="nav">${sections.map((s) => `<span class="${s === active ? 'on' : ''}">${s}</span>`).join('')}</div>
      <div class="bar-right">${esc(right)}</div>
    </div>`;
  const eyebrow = (text: string) => `<div class="eyebrow"><span>${esc(text)}</span><i></i></div>`;

  const hero = works.find((w) => w.item.image_url)?.item.image_url;
  const cover = `
    <section class="page">
      ${bar('Catalogue')}
      <div class="cover">
        ${eyebrow(meta.label)}
        <h1>${esc(meta.title)}<span class="dot">.</span></h1>
        ${meta.subtitle ? `<div class="mono sub">${esc(meta.subtitle)}</div>` : ''}
        ${hero ? `<div class="cover-hero">${imageTag(hero)}</div>` : '<div class="cover-hero empty"></div>'}
      </div>
      <div class="foot">
        <span>${plural(works.length, 'work')}</span>
        <span>Printed ${esc(meta.printDate)}</span>
        ${meta.qrSvg ? `<span class="foot-qr">${meta.qrSvg}<em>Scan to view online</em></span>` : ''}
      </div>
    </section>`;

  const intro = meta.introduction?.trim()
    ? `<section class="page">
        ${bar('Catalogue')}
        ${eyebrow('Introduction')}
        <div class="intro">${paragraphs(meta.introduction)}</div>
      </section>`
    : '';

  const card = (w: Work, i: number) => {
    const meta2 = [w.medium, w.dimensions, w.edition ? `Edition ${w.edition}` : ''].filter(Boolean);
    return `
      <article class="card">
        <div class="card-img">${imageTag(w.item.image_url)}</div>
        <div class="card-head"><span class="no">N° ${num(i)}</span>${w.price ? `<span class="card-price">${w.price}</span>` : ''}</div>
        ${w.artist ? `<div class="card-artist">${w.artist}</div>` : ''}
        <div class="card-title">${w.title}${w.year ? `<span>, ${w.year}</span>` : ''}</div>
        <div class="card-foot">
          <div class="card-meta">
            ${meta2.map((m) => `<div>${m}</div>`).join('')}
            ${w.credit ? `<div class="credit">${w.credit}</div>` : ''}
            ${w.description ? `<p class="card-desc">${w.description}</p>` : ''}
            ${w.provenance.length ? `<p class="card-desc">${w.provenance.map(([k, v]) => `<b>${k}</b> ${v}`).join(' · ')}</p>` : ''}
          </div>
          ${w.qr ? `<div class="card-qr">${w.qr}</div>` : ''}
        </div>
      </article>`;
  };

  const workPages = chunk(works, 4)
    .map((page, p) => {
      const first = p * 4;
      const range = `${num(first)}–${num(first + page.length - 1)}`;
      return `<section class="page">${bar('Works', `Works ${range}`)}<div class="grid">${page.map((w, j) => card(w, first + j)).join('')}</div></section>`;
    })
    .join('');

  const bios = artists.length
    ? `<section class="page flow">${bar('Works', 'Artists')}${eyebrow('About the artists')}<div class="bios">${artists
        .map(artistBlock)
        .join('')}</div></section>`
    : '';

  const checklist = options.checklist
    ? `<section class="page flow">${bar('Index')}${eyebrow('Index of works')}${checklistTable(works)}</section>`
    : '';
  const prices = sections.includes('Prices')
    ? `<section class="page flow">${bar('Prices')}<div class="eyebrow red"><span>Price list · for collectors</span><i></i></div>${priceTable(works)}</section>`
    : '';

  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;1,9..144,400;1,9..144,500&family=JetBrains+Mono:wght@400;500&display=swap" />`;
  const mono = `'JetBrains Mono', ui-monospace, Menlo, monospace`;
  const serif = `'Fraunces', Georgia, 'Times New Roman', serif`;

  const css = `
  @page { size: letter; margin: 0; }
  html, body { background: ${ED.bone}; }
  body { font-family: ${serif}; color: ${ED.ink}; }
  .page { width: 8.5in; height: 10.98in; padding: 0.45in 0.55in 0.5in; background: ${ED.bone}; display: flex; flex-direction: column; overflow: hidden; break-after: page; page-break-after: always; }
  .page.flow { height: auto; min-height: 10.98in; overflow: visible; }
  .page:last-of-type { break-after: auto; page-break-after: auto; }
  .bar { display: flex; align-items: baseline; justify-content: space-between; gap: 0.2in; padding-bottom: 0.14in; border-bottom: 0.75pt solid ${ED.rule}; margin-bottom: 0.32in; flex: none; }
  .wordmark { font-family: ${serif}; font-style: italic; font-size: 17pt; letter-spacing: -0.01em; line-height: 1; }
  .wordmark span, .dot { color: ${ED.vermillion}; font-style: normal; }
  .nav { display: flex; gap: 0.22in; font-family: ${mono}; font-size: 6.5pt; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
  .nav span { padding-bottom: 2px; border-bottom: 1.5pt solid transparent; }
  .nav span.on { color: ${ED.vermillion}; border-bottom-color: ${ED.vermillion}; }
  .bar-right { font-family: ${mono}; font-size: 6.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: ${ED.muted}; text-align: right; max-width: 2.2in; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .mono { font-family: ${mono}; text-transform: uppercase; letter-spacing: 0.16em; }
  .eyebrow { display: flex; align-items: center; gap: 0.12in; font-family: ${mono}; font-size: 7pt; letter-spacing: 0.2em; text-transform: uppercase; color: #a67c1c; margin-bottom: 0.22in; flex: none; }
  .eyebrow i { flex: 1; height: 0.5pt; background: ${ED.rule}; opacity: 0.35; }
  .eyebrow.red { color: ${ED.vermillion}; }
  .cover { flex: 1; display: flex; flex-direction: column; min-height: 0; }
  .cover h1 { font-family: ${serif}; font-style: italic; font-weight: 400; font-size: 54pt; line-height: 0.95; letter-spacing: -0.02em; max-width: 7in; }
  .sub { font-size: 8pt; color: ${ED.muted}; margin-top: 0.2in; }
  .cover-hero { flex: 1; min-height: 0; margin-top: 0.35in; border: 0.75pt solid ${ED.rule}; padding: 0.18in; display: flex; align-items: center; justify-content: center; background: #fbf8f2; }
  .cover-hero.empty { background: repeating-linear-gradient(135deg, transparent 0 10px, rgba(0,0,0,0.035) 10px 11px); }
  .cover-hero img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .foot { flex: none; display: flex; align-items: flex-end; justify-content: space-between; gap: 0.2in; border-top: 0.75pt solid ${ED.rule}; padding-top: 0.14in; margin-top: 0.25in; font-family: ${mono}; font-size: 6.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: ${ED.muted}; }
  .foot-qr { width: 0.75in; text-align: center; }
  .foot-qr svg { width: 100%; height: auto; display: block; margin-bottom: 3px; }
  .foot-qr em { font-style: normal; font-size: 5pt; letter-spacing: 0.1em; }
  .intro { column-count: 2; column-gap: 0.4in; font-size: 10.5pt; line-height: 1.65; }
  .intro p + p { margin-top: 0.12in; }
  .intro p:first-child::first-letter { font-size: 34pt; float: left; line-height: 0.85; padding: 0.04in 0.06in 0 0; font-style: italic; color: ${ED.vermillion}; }
  .grid { flex: 1; min-height: 0; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 0.3in 0.35in; }
  .card { min-height: 0; display: flex; flex-direction: column; border-top: 0.75pt solid ${ED.rule}; padding-top: 0.1in; overflow: hidden; }
  .card-img { flex: 1; min-height: 1.6in; display: flex; align-items: center; justify-content: center; background: #fbf8f2; border: 0.5pt solid rgba(0,0,0,0.12); padding: 0.1in; margin-bottom: 0.1in; overflow: hidden; }
  .card-img img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .noimg { width: 100%; height: 100%; min-height: 1in; display: flex; align-items: center; justify-content: center; font-family: ${mono}; font-size: 6pt; letter-spacing: 0.18em; text-transform: uppercase; color: #b9b0a3; }
  .card-head { display: flex; justify-content: space-between; align-items: baseline; font-family: ${mono}; font-size: 6.5pt; letter-spacing: 0.16em; text-transform: uppercase; }
  .no { color: ${ED.vermillion}; font-weight: 500; }
  .card-price { color: ${ED.ink}; letter-spacing: 0.06em; }
  .card-artist { font-family: ${mono}; font-size: 7pt; letter-spacing: 0.14em; text-transform: uppercase; margin-top: 0.06in; }
  .card-title { font-style: italic; font-size: 13pt; line-height: 1.15; margin-top: 0.03in; }
  .card-title span { font-style: normal; color: ${ED.muted}; font-size: 10pt; }
  .card-foot { display: flex; gap: 0.12in; align-items: flex-end; margin-top: 0.05in; }
  .card-meta { flex: 1; min-width: 0; font-size: 8pt; line-height: 1.4; color: #3c352d; }
  .card-meta .credit { color: ${ED.muted}; font-size: 7.5pt; }
  .card-desc { font-size: 7.5pt; line-height: 1.45; color: ${ED.muted}; margin-top: 0.04in; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
  .card-desc b { font-family: ${mono}; font-weight: 500; font-size: 6pt; letter-spacing: 0.12em; text-transform: uppercase; }
  .card-qr { width: 0.6in; flex: none; background: #fff; padding: 2px; }
  .card-qr svg { width: 100%; height: auto; display: block; }
  .bios { column-count: 2; column-gap: 0.4in; }
  .bio { break-inside: avoid; margin-bottom: 0.25in; font-size: 9pt; line-height: 1.6; }
  .bio-name { font-family: ${mono}; font-size: 7.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: ${ED.vermillion}; margin-bottom: 0.05in; }
  .bio p + p { margin-top: 0.06in; }
  .bio-tomb { font-style: italic; opacity: 0.7; margin-bottom: 0.06in; }
  .bio-statement { margin-top: 0.1in; }
  .bio-label { font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.04in; }
  table.list { width: 100%; border-collapse: collapse; font-size: 8.5pt; }
  table.list thead tr { border-bottom: 0.75pt solid ${ED.rule}; }
  table.list th { font-family: ${mono}; font-size: 6.5pt; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; color: ${ED.muted}; text-align: left; padding: 0 0.08in 0.07in 0; }
  table.list td { padding: 0.075in 0.08in 0.075in 0; vertical-align: top; border-bottom: 0.5pt solid rgba(0,0,0,0.12); line-height: 1.35; }
  table.list tr { break-inside: avoid; }
  table.list td.num { font-family: ${mono}; font-size: 7pt; color: ${ED.vermillion}; width: 0.35in; }
  table.list td.t { font-style: italic; }
  table.list .price { text-align: right; white-space: nowrap; }
  table.list td.price { font-family: ${mono}; font-size: 8pt; }`;

  return doc(`${meta.title} — Catalog`, fonts, css, `${cover}${intro}${workPages}${bios}${checklist}${prices}`);
}

// ── Monograph ─────────────────────────────────────────────────────────────────

function buildMonograph(meta: CatalogMeta, works: Work[], options: CatalogOptions, artists: CatalogArtist[]): string {
  const hero = works.find((w) => w.item.image_url)?.item.image_url;
  const cover = `
    <section class="page dark cover">
      ${meta.kicker ? `<div class="kicker">${esc(meta.kicker)}</div>` : ''}
      <div class="cover-hero">${hero ? imageTag(hero) : ''}</div>
      <h1>${esc(meta.title)}</h1>
      ${meta.subtitle ? `<div class="cover-sub">${esc(meta.subtitle)}</div>` : ''}
      <div class="cover-rule"></div>
      <div class="kicker small">${esc(meta.label)} · ${plural(works.length, 'work')}</div>
    </section>`;

  const intro = meta.introduction?.trim()
    ? `<section class="page text"><div class="kicker">Introduction</div><div class="intro">${paragraphs(meta.introduction)}</div></section>`
    : '';

  const plates = works
    .map((w, i) => {
      const line = [w.medium, w.dimensions, w.edition ? `Edition ${w.edition}` : ''].filter(Boolean).join(' · ');
      return `
      <section class="page plate">
        <div class="plate-img">${imageTag(w.item.image_url)}</div>
        <div class="caption">
          ${w.artist ? `<div class="cap-artist">${w.artist}</div>` : ''}
          <div class="cap-title">${w.title}${w.year ? `<span>, ${w.year}</span>` : ''}</div>
          ${line ? `<div class="cap-line">${line}</div>` : ''}
          ${w.credit ? `<div class="cap-credit">${w.credit}</div>` : ''}
          ${w.description ? `<p class="cap-desc">${w.description}</p>` : ''}
          ${w.provenance.length ? `<p class="cap-desc">${w.provenance.map(([k, v]) => `<em>${k}.</em> ${v}`).join(' ')}</p>` : ''}
        </div>
        <div class="folio"><span>${num(i)}</span>${w.qr ? `<span class="folio-qr">${w.qr}</span>` : ''}</div>
      </section>`;
    })
    .join('');

  const bios = artists.length
    ? `<section class="page text flow"><div class="kicker">The artists</div>${artists
        .map(artistBlock)
        .join('')}</section>`
    : '';

  const checklist = options.checklist
    ? `<section class="page text flow"><div class="kicker">Checklist</div>${checklistTable(works)}</section>`
    : '';
  const prices =
    options.prices && works.some((w) => w.price)
      ? `<section class="page text flow"><div class="kicker">Price list</div>${priceTable(works)}</section>`
      : '';

  const back = `
    <section class="page dark back">
      ${meta.qrSvg ? `<div class="back-qr">${meta.qrSvg}</div><div class="kicker small">Scan to view the exhibition online</div>` : ''}
      <div class="back-brand">Provenance</div>
      <div class="kicker small">${esc(meta.printDate)}</div>
    </section>`;

  const fonts = `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&display=swap" />`;
  const serif = `'Cormorant Garamond', Garamond, Georgia, serif`;
  const sans = `'Helvetica Neue', Arial, sans-serif`;

  const css = `
  @page { size: letter; margin: 0; }
  body { font-family: ${serif}; color: #141414; background: #fff; }
  .page { width: 8.5in; height: 10.98in; padding: 0.7in 0.8in; display: flex; flex-direction: column; overflow: hidden; break-after: page; page-break-after: always; background: #fff; }
  .page.flow { height: auto; min-height: 10.98in; overflow: visible; }
  .page:last-of-type { break-after: auto; page-break-after: auto; }
  .dark { background: #121212; color: #f2efe9; align-items: center; text-align: center; }
  .kicker { font-family: ${sans}; font-size: 7pt; letter-spacing: 0.32em; text-transform: uppercase; color: #8a8580; margin-bottom: 0.3in; }
  .kicker.small { font-size: 6pt; margin: 0.1in 0 0; }
  .cover { justify-content: center; }
  .cover-hero { flex: 1; min-height: 0; width: 100%; display: flex; align-items: center; justify-content: center; margin-bottom: 0.45in; }
  .cover-hero img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; box-shadow: 0 0 0 0.5pt rgba(255,255,255,0.08); }
  .cover h1 { font-weight: 400; font-size: 40pt; line-height: 1; letter-spacing: 0.01em; max-width: 6.5in; }
  .cover-sub { font-style: italic; font-size: 13pt; color: #bdb7ae; margin-top: 0.12in; }
  .cover-rule { width: 0.5in; height: 0.75pt; background: #6d6862; margin: 0.3in 0 0.08in; }
  .plate { padding: 0.75in 0.85in 0.55in; }
  .plate-img { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
  .plate-img img { max-width: 100%; max-height: 100%; object-fit: contain; display: block; }
  .noimg { width: 70%; aspect-ratio: 4/3; background: #f3f1ee; display: flex; align-items: center; justify-content: center; font-family: ${sans}; font-size: 7pt; letter-spacing: 0.24em; text-transform: uppercase; color: #bbb; }
  .caption { flex: none; text-align: center; margin-top: 0.4in; max-width: 5.6in; align-self: center; }
  .cap-artist { font-family: ${sans}; font-size: 7.5pt; letter-spacing: 0.3em; text-transform: uppercase; color: #555; }
  .cap-title { font-style: italic; font-size: 17pt; line-height: 1.15; margin-top: 0.06in; }
  .cap-title span { font-style: normal; color: #777; }
  .cap-line { font-size: 10.5pt; color: #444; margin-top: 0.05in; }
  .cap-credit { font-size: 9.5pt; color: #888; margin-top: 0.02in; }
  .cap-desc { font-size: 9.5pt; line-height: 1.5; color: #555; margin-top: 0.12in; display: -webkit-box; -webkit-line-clamp: 5; -webkit-box-orient: vertical; overflow: hidden; }
  .folio { flex: none; display: flex; justify-content: space-between; align-items: flex-end; margin-top: 0.25in; font-family: ${sans}; font-size: 7pt; letter-spacing: 0.24em; color: #aaa; }
  .folio-qr { width: 0.55in; }
  .folio-qr svg { width: 100%; height: auto; display: block; }
  .text .intro { font-size: 13pt; line-height: 1.6; max-width: 5.4in; }
  .text .intro p + p { margin-top: 0.14in; text-indent: 0.3in; }
  .bio { break-inside: avoid; margin-bottom: 0.3in; max-width: 5.6in; font-size: 11.5pt; line-height: 1.55; }
  .bio-name { font-family: ${sans}; font-size: 7.5pt; letter-spacing: 0.28em; text-transform: uppercase; color: #555; margin-bottom: 0.06in; }
  .bio-tomb { font-style: italic; opacity: 0.7; margin-bottom: 0.06in; }
  .bio-statement { margin-top: 0.1in; }
  .bio-label { font-size: 0.8em; letter-spacing: 0.12em; text-transform: uppercase; opacity: 0.6; margin-bottom: 0.04in; }
  table.list { width: 100%; border-collapse: collapse; font-size: 10.5pt; }
  table.list thead tr { border-bottom: 0.5pt solid #141414; }
  table.list th { font-family: ${sans}; font-size: 6.5pt; font-weight: 400; letter-spacing: 0.24em; text-transform: uppercase; color: #888; text-align: left; padding: 0 0.1in 0.08in 0; }
  table.list td { padding: 0.08in 0.1in 0.08in 0; vertical-align: top; border-bottom: 0.5pt solid #e6e3df; line-height: 1.3; }
  table.list tr { break-inside: avoid; }
  table.list td.num { font-family: ${sans}; font-size: 7pt; color: #aaa; width: 0.35in; padding-top: 0.1in; }
  table.list td.t { font-style: italic; }
  table.list .price { text-align: right; white-space: nowrap; }
  .back { justify-content: center; }
  .back-qr { width: 1.6in; background: #fff; padding: 0.1in; }
  .back-qr svg { width: 100%; height: auto; display: block; }
  .back-brand { font-style: italic; font-size: 22pt; margin-top: 0.6in; }`;

  return doc(`${meta.title} — Catalog`, fonts, css, `${cover}${intro}${plates}${bios}${checklist}${prices}${back}`);
}

// ── Entry point ───────────────────────────────────────────────────────────────

export function buildCatalogHtml(
  meta: CatalogMeta,
  items: CatalogItem[],
  options: CatalogOptions,
  /** Artwork id → certificate QR SVG, used when options.qrCodes is on. */
  qrSvgs: Map<string, string> = new Map(),
  /** Printed when options.artistBios is on. */
  artists: CatalogArtist[] = [],
): string {
  if (options.coverName === 'provenance') {
    // Editorial already carries the "Provenance." wordmark beside this name.
    meta = { ...meta, kicker: options.style === 'editorial' ? '' : 'Provenance' };
  }
  const works = prepare(items, options, qrSvgs);
  const bios = options.artistBios ? artists.filter((a) => a.bio.trim() || a.statement?.trim()) : [];
  switch (options.style) {
    case 'editorial':
      return buildEditorial(meta, works, options, bios);
    case 'monograph':
      return buildMonograph(meta, works, options, bios);
    default:
      return buildStandard(meta, works, options, bios);
  }
}

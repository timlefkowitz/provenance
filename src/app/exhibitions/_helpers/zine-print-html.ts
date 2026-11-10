import { formatPrintPrice } from '~/lib/print-price';
import {
  esc,
  getYear,
  PRINT_WHEN_READY,
  type CatalogCoverName,
  type CatalogItem,
  type CatalogMeta,
} from './catalog-print-html';

/**
 * Printed zines for an exhibition or a selection of collection works. Pages
 * are half-letter (5.5 × 8.5in), in three looks:
 *
 * - layered: every work floats over a blown-up, blurred detail of itself,
 *   with the next work ghosted behind it. The cover is a collage of the show.
 * - riso: two fluorescent inks (pink and blue) on cream, halftone dots and a
 *   misregistered second ink, the way a risograph prints. No black anywhere.
 * - xerox: photocopied cut-and-paste: toner-black photos taped down at an
 *   angle, typewriter captions and a ransom-note cover.
 *
 * "booklet" imposes the pages two to a Letter sheet in saddle-stitch order:
 * print double-sided, flip on the short edge, fold the stack and staple.
 * "pages" prints one half-letter page per sheet, for a print shop.
 */

export type ZineStyle = 'layered' | 'riso' | 'xerox';
export type ZineLayout = 'booklet' | 'pages';

export const ZINE_STYLES: Array<{ value: ZineStyle; label: string; hint: string }> = [
  { value: 'layered', label: 'Layered', hint: 'Each work over its own detail' },
  { value: 'riso', label: 'Riso', hint: 'Two inks, halftone, misprinted' },
  { value: 'xerox', label: 'Xerox', hint: 'Photocopied, taped, typed' },
];

export type ZineOptions = {
  style: ZineStyle;
  layout: ZineLayout;
  coverName: CatalogCoverName;
  descriptions: boolean;
  /** An index of every work before the back cover. */
  index: boolean;
  prices: boolean;
  priceSymbol: boolean;
};

export const DEFAULT_ZINE_OPTIONS: ZineOptions = {
  style: 'layered',
  layout: 'booklet',
  coverName: 'owner',
  descriptions: true,
  index: true,
  prices: false,
  priceSymbol: true,
};

const INDEX_PER_PAGE = 16;

/** How many pages (and Letter sheets, for a booklet) the zine will print. */
export function zinePlan(
  workCount: number,
  { hasIntro, index, layout }: { hasIntro: boolean; index: boolean; layout: ZineLayout },
): { pages: number; sheets: number } {
  const content =
    1 + (hasIntro ? 1 : 0) + workCount + (index && workCount ? Math.ceil(workCount / INDEX_PER_PAGE) : 0) + 1;
  if (layout === 'pages') return { pages: content, sheets: content };
  const pages = Math.ceil(content / 4) * 4;
  return { pages, sheets: pages / 4 };
}

// ── Preparing works ───────────────────────────────────────────────────────────

type ZWork = {
  num: string;
  title: string;
  artist: string;
  year: string;
  meta: string;
  description: string;
  price: string;
  image: string | null;
};

/** Cuts long text at a word boundary so it fits a small page. */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}

function prepare(items: CatalogItem[], options: ZineOptions): ZWork[] {
  return items.map((item, i) => ({
    num: String(i + 1).padStart(2, '0'),
    title: esc(clip(item.title?.trim() || 'Untitled', 90)),
    artist: esc(item.artist_name?.trim()),
    year: getYear(item.creation_date),
    meta: [item.medium, item.dimensions, item.edition]
      .map((s) => s?.trim())
      .filter(Boolean)
      .map((s) => esc(s))
      .join(' · '),
    description: options.descriptions ? esc(clip(item.description?.trim() ?? '', 360)) : '',
    price: options.prices ? esc(formatPrintPrice(item.price, options.priceSymbol)) : '',
    image: item.image_url,
  }));
}

/** Cover type steps down for long titles so they stay on the page. */
const fit = (text: string, sizes: [number, number, number]) =>
  `font-size:${text.length > 42 ? sizes[2] : text.length > 22 ? sizes[1] : sizes[0]}pt`;

const img = (url: string | null, cls = '', style = '') =>
  url ? `<img class="${cls}" src="${esc(url)}" alt="" style="${style}" onerror="this.style.visibility='hidden'" />` : '';

/** Small, deterministic variety from a page's position. */
const pick = <T,>(list: T[], i: number): T => list[i % list.length]!;

function introText(text: string | null | undefined, max: number): string {
  return clip((text ?? '').trim(), max)
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${esc(p)}</p>`)
    .join('');
}

type Ctx = { meta: CatalogMeta; works: ZWork[]; options: ZineOptions };

type StyleKit = {
  fonts: string;
  /** Inline SVG (filters) placed once at the top of the body. */
  defs?: string;
  css: string;
  cover: (c: Ctx) => string;
  intro: (c: Ctx) => string;
  work: (w: ZWork, i: number, c: Ctx) => string;
  index: (rows: ZWork[], c: Ctx) => string;
  notes: (i: number) => string;
  back: (c: Ctx) => string;
};

const fontLink = (families: string) =>
  `<link rel="preconnect" href="https://fonts.googleapis.com" /><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin /><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${families}&display=swap" />`;

// ── Layered ───────────────────────────────────────────────────────────────────

/** Where each page's blown-up detail is taken from. */
const ORIGINS = ['30% 35%', '70% 30%', '50% 65%', '25% 70%', '65% 55%', '45% 25%'];

const layered: StyleKit = {
  fonts: fontLink('family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,500;1,9..144,300;1,9..144,400&family=Inter:wght@400;500;600'),
  css: `
  body { background: #0d0c0b; }
  .zp { background: #0d0c0b; color: #f4efe6; font-family: Inter, 'Helvetica Neue', Arial, sans-serif; }
  .bg { position: absolute; inset: 0; overflow: hidden; }
  .bg img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; transform: scale(2.1); filter: blur(5px) saturate(1.2) brightness(0.5); }
  .bg.deep img { transform: scale(1.4); filter: blur(12px) saturate(1.1) brightness(0.32); }
  .veil { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(13,12,11,0.1) 0%, rgba(13,12,11,0) 40%, rgba(13,12,11,0.85) 74%, #0d0c0b 100%); }
  .ghost { position: absolute; width: 3.4in; top: 1.1in; opacity: 0.3; mix-blend-mode: screen; filter: saturate(0.8); }
  .ghost.r { right: -1.3in; transform: rotate(5deg); }
  .ghost.l { left: -1.3in; transform: rotate(-5deg); }
  .art { position: absolute; top: 0.5in; left: 0.5in; right: 0.5in; height: 4.55in; display: flex; align-items: center; justify-content: center; }
  .art img { max-width: 100%; max-height: 100%; object-fit: contain; box-shadow: 0 0.14in 0.4in rgba(0,0,0,0.6), 0 0 0 0.5pt rgba(255,255,255,0.22); }
  .cap { position: absolute; left: 0.5in; right: 0.5in; bottom: 0.55in; }
  .no { font-family: Fraunces, Georgia, serif; font-style: italic; font-weight: 300; font-size: 28pt; line-height: 1; color: #d6a841; }
  .artist { font-size: 6.5pt; font-weight: 600; letter-spacing: 0.26em; text-transform: uppercase; color: rgba(244,239,230,0.72); margin-top: 0.14in; }
  .title { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 16pt; line-height: 1.12; margin-top: 0.05in; }
  .title .yr { font-style: normal; font-weight: 300; color: rgba(244,239,230,0.6); }
  .meta { font-size: 6.5pt; color: rgba(244,239,230,0.58); margin-top: 0.07in; }
  .desc { font-family: Fraunces, Georgia, serif; font-size: 8.5pt; line-height: 1.42; color: rgba(244,239,230,0.82); margin-top: 0.1in; }
  .price { font-size: 7pt; letter-spacing: 0.12em; color: #d6a841; margin-top: 0.08in; }
  .folio { position: absolute; bottom: 0.25in; font-size: 6pt; letter-spacing: 0.24em; color: rgba(244,239,230,0.45); }
  .zp:nth-child(odd) .folio { right: 0.5in; } .zp:nth-child(even) .folio { left: 0.5in; }
  .sheet .zp:nth-child(odd) .folio { left: 0.5in; right: auto; } .sheet .zp:nth-child(even) .folio { right: 0.5in; left: auto; }
  .card { position: absolute; height: 3.1in; background: #222; box-shadow: 0 0.12in 0.35in rgba(0,0,0,0.6); border: 0.05in solid #f4efe6; }
  .card img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .c0 { width: 2.5in; left: 0.4in; top: 0.75in; transform: rotate(-6deg); }
  .c1 { width: 2.3in; right: 0.35in; top: 1.25in; transform: rotate(4.5deg); }
  .c2 { width: 2.4in; left: 1.55in; top: 2.35in; transform: rotate(-1.5deg); }
  .solo { width: 3.4in; left: 1.05in; top: 0.9in; height: 3.9in; transform: rotate(-2deg); }
  .cover-text { position: absolute; left: 0.5in; right: 0.5in; bottom: 0.55in; }
  .kick { font-size: 6.5pt; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #d6a841; }
  .cover-title { font-family: Fraunces, Georgia, serif; font-style: italic; font-weight: 300; font-size: 34pt; line-height: 0.98; margin-top: 0.1in; }
  .cover-sub { font-size: 7pt; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,239,230,0.65); margin-top: 0.14in; }
  .text { position: absolute; inset: 0.75in 0.6in; }
  .h { font-size: 6.5pt; font-weight: 600; letter-spacing: 0.3em; text-transform: uppercase; color: #d6a841; margin-bottom: 0.25in; }
  .body p { font-family: Fraunces, Georgia, serif; font-size: 10pt; line-height: 1.55; margin-bottom: 0.12in; color: rgba(244,239,230,0.9); }
  .row { display: flex; gap: 0.15in; padding: 0.07in 0; border-bottom: 0.5pt solid rgba(244,239,230,0.14); }
  .row .n { font-family: Fraunces, Georgia, serif; font-style: italic; color: #d6a841; width: 0.3in; font-size: 9pt; }
  .row .t { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 9pt; }
  .row .a { font-size: 6pt; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,239,230,0.6); margin-top: 1pt; }
  .lines { position: absolute; inset: 1.3in 0.6in 0.8in; background: repeating-linear-gradient(180deg, transparent 0, transparent 0.3in, rgba(244,239,230,0.14) 0.3in, rgba(244,239,230,0.14) calc(0.3in + 0.5pt)); }
  .back { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .qr { width: 1.5in; background: #fff; padding: 0.1in; } .qr svg { width: 100%; height: auto; display: block; }
  .brand { font-family: Fraunces, Georgia, serif; font-style: italic; font-size: 20pt; margin-top: 0.45in; }
  .brand span { color: #e2462c; font-style: normal; }`,
  cover: ({ meta, works }) => {
    const shown = works.filter((w) => w.image).slice(0, 3);
    const cards =
      shown.length === 1
        ? `<div class="card solo">${img(shown[0]!.image)}</div>`
        : shown.map((w, i) => `<div class="card c${i}">${img(w.image)}</div>`).join('');
    return `<div class="bg deep">${img(shown[0]?.image ?? null)}</div>${cards}<div class="veil"></div>
      <div class="cover-text">
        ${meta.kicker ? `<div class="kick">${esc(meta.kicker)}</div>` : ''}
        <div class="cover-title" style="${fit(meta.title, [34, 26, 20])}">${esc(meta.title)}</div>
        ${meta.subtitle ? `<div class="cover-sub">${esc(meta.subtitle)}</div>` : ''}
      </div>`;
  },
  intro: ({ meta, works }) =>
    `<div class="bg deep">${img(works.find((w, i) => i > 0 && w.image)?.image ?? works[0]?.image ?? null)}</div>
     <div class="text"><div class="h">Introduction</div><div class="body">${introText(meta.introduction, 1400)}</div></div>`,
  work: (w, i, { works }) => {
    const next = works[(i + 1) % works.length];
    const ghost = works.length > 1 && next?.image && next !== w ? img(next.image, `ghost ${i % 2 ? 'l' : 'r'}`) : '';
    return `<div class="bg">${img(w.image, '', `transform-origin:${pick(ORIGINS, i)}`)}</div>${ghost}<div class="veil"></div>
      <div class="art">${img(w.image)}</div>
      <div class="cap">
        <div class="no">No. ${w.num}</div>
        ${w.artist ? `<div class="artist">${w.artist}</div>` : ''}
        <div class="title">${w.title}${w.year ? ` <span class="yr">${w.year}</span>` : ''}</div>
        ${w.meta ? `<div class="meta">${w.meta}</div>` : ''}
        ${w.description ? `<div class="desc">${w.description}</div>` : ''}
        ${w.price ? `<div class="price">${w.price}</div>` : ''}
      </div>`;
  },
  index: (rows) =>
    `<div class="text"><div class="h">Index of works</div>${rows
      .map((w) => `<div class="row"><div class="n">${w.num}</div><div><div class="t">${w.title}${w.year ? `, ${w.year}` : ''}</div>${w.artist ? `<div class="a">${w.artist}</div>` : ''}</div></div>`)
      .join('')}</div>`,
  notes: () => `<div class="text"><div class="h">Notes</div></div><div class="lines"></div>`,
  back: ({ meta, works }) =>
    `<div class="bg deep">${img(works.filter((w) => w.image).at(-1)?.image ?? null)}</div>
     <div class="back">
       ${meta.qrSvg ? `<div class="qr">${meta.qrSvg}</div><div class="kick" style="margin-top:0.15in">Scan to view online</div>` : ''}
       <div class="brand">Provenance<span>.</span></div>
       <div class="cover-sub">${esc(meta.printDate)}</div>
     </div>`,
};

// ── Riso ──────────────────────────────────────────────────────────────────────

const RISO_DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="duo-pink" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="1.000 0.984"/><feFuncG type="table" tableValues="0.282 0.973"/><feFuncB type="table" tableValues="0.690 0.945"/></feComponentTransfer></filter><filter id="duo-blue" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="0.000 0.984"/><feFuncG type="table" tableValues="0.471 0.973"/><feFuncB type="table" tableValues="0.749 0.945"/></feComponentTransfer></filter><filter id="shadow-pink" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="1.000 0.984 0.984 0.984"/><feFuncG type="table" tableValues="0.282 0.973 0.973 0.973"/><feFuncB type="table" tableValues="0.690 0.945 0.945 0.945"/></feComponentTransfer></filter><filter id="shadow-blue" color-interpolation-filters="sRGB"><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="table" tableValues="0.000 0.984 0.984 0.984"/><feFuncG type="table" tableValues="0.471 0.973 0.973 0.973"/><feFuncB type="table" tableValues="0.749 0.945 0.945 0.945"/></feComponentTransfer></filter></svg>`;

/** A riso print of an image: one ink, halftone, and the other ink's shadows off-register. */
const risoFig = (url: string, style = '') =>
  `<div class="fig"><div class="mono">${img(url, '', style)}<i class="dots"></i></div>${img(url, 'misreg', style)}</div>`;

const riso: StyleKit = {
  defs: RISO_DEFS,
  fonts: fontLink('family=Archivo+Black&family=Space+Mono:ital,wght@0,400;0,700;1,400'),
  css: `
  :root { --pink: #ff48b0; --blue: #0078bf; --paper: #fbf8f1; }
  body { background: var(--paper); }
  .zp { background: var(--paper); color: var(--blue); font-family: 'Space Mono', 'Courier New', monospace; }
  .p { --ink: var(--pink); --ink2: var(--blue); } .b { --ink: var(--blue); --ink2: var(--pink); }
  .fig { position: relative; display: inline-block; isolation: isolate; }
  .mono { position: relative; overflow: hidden; }
  .mono img { display: block; }
  .p .mono img { filter: contrast(1.25) url(#duo-pink); } .b .mono img { filter: contrast(1.25) url(#duo-blue); }
  .misreg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; transform: translate(0.06in, 0.045in); mix-blend-mode: multiply; pointer-events: none; }
  .p .misreg { filter: contrast(1.25) url(#shadow-blue); } .b .misreg { filter: contrast(1.25) url(#shadow-pink); }
  .mono .dots { position: absolute; inset: 0; background-image: radial-gradient(circle, var(--paper) 30%, transparent 34%); background-size: 3.4pt 3.4pt; mix-blend-mode: lighten; opacity: 0.55; }
  .over { mix-blend-mode: multiply; }
  .big { font-family: 'Archivo Black', Impact, sans-serif; text-transform: uppercase; }
  .wfig { position: absolute; top: 0.85in; left: 0.45in; right: 0.45in; height: 4.25in; display: flex; align-items: center; justify-content: center; }
  .wfig img { max-width: 4.45in; max-height: 4.1in; }
  .num { position: absolute; top: 0.3in; left: 0.32in; font-size: 64pt; line-height: 0.8; color: var(--ink2); z-index: 2; }
  .wtext { position: absolute; left: 0.5in; right: 0.5in; bottom: 0.55in; }
  .wtitle { font-size: 15pt; line-height: 1.02; color: var(--ink); }
  .wtitle.over { color: var(--ink); }
  .wartist { font-size: 7.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; margin-top: 0.08in; }
  .wmeta { font-size: 6.5pt; margin-top: 0.04in; opacity: 0.85; }
  .wdesc { font-size: 7pt; line-height: 1.45; margin-top: 0.09in; }
  .wprice { display: inline-block; margin-top: 0.08in; padding: 1pt 5pt; background: var(--ink); color: var(--paper); font-size: 7pt; font-weight: 700; }
  .folio { position: absolute; bottom: 0.22in; font-size: 6.5pt; font-weight: 700; }
  .zp:nth-child(odd) .folio { right: 0.4in; } .zp:nth-child(even) .folio { left: 0.4in; }
  .sheet .zp:nth-child(odd) .folio { left: 0.4in; right: auto; } .sheet .zp:nth-child(even) .folio { right: 0.4in; left: auto; }
  .chero { position: absolute; top: 0.45in; left: 0.45in; right: 0.45in; height: 4.4in; display: flex; justify-content: center; align-items: flex-start; }
  .ctitle { position: absolute; left: 0.38in; right: 0.38in; top: 3.65in; font-size: 36pt; line-height: 0.9; color: var(--blue); word-break: break-word; }
  .ckick { position: absolute; top: 0.2in; left: 0.45in; font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; color: var(--blue); }
  .csub { position: absolute; left: 0.45in; right: 1.6in; bottom: 0.5in; font-size: 7.5pt; font-weight: 700; text-transform: uppercase; }
  .sticker { position: absolute; right: 0.4in; bottom: 0.4in; width: 1.05in; height: 1.05in; border-radius: 50%; background: var(--pink); color: var(--paper); display: flex; flex-direction: column; align-items: center; justify-content: center; transform: rotate(-12deg); text-align: center; }
  .sticker b { font-family: 'Archivo Black', Impact, sans-serif; font-size: 24pt; line-height: 0.9; }
  .sticker span { font-size: 6pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }
  .flood-p { background: var(--pink); } .flood-b { background: var(--blue); color: var(--paper); }
  .text { position: absolute; inset: 0.6in 0.5in; }
  .h { font-size: 26pt; line-height: 0.95; margin-bottom: 0.22in; }
  .body p { font-size: 8.5pt; line-height: 1.55; margin-bottom: 0.1in; }
  .row { display: flex; gap: 0.12in; padding: 0.05in 0; border-bottom: 1pt dashed var(--pink); font-size: 7.5pt; }
  .row .n { font-weight: 700; color: var(--pink); width: 0.25in; }
  .row .a { font-weight: 700; text-transform: uppercase; font-size: 6.5pt; }
  .dotgrid { position: absolute; inset: 1.2in 0.5in 0.6in; background-image: radial-gradient(circle, var(--pink) 0.9pt, transparent 1.1pt); background-size: 0.25in 0.25in; }
  .back { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .qr { width: 1.55in; background: var(--paper); padding: 0.1in; box-shadow: 0.08in 0.07in 0 var(--pink); } .qr svg { width: 100%; height: auto; display: block; }
  .brand { font-size: 22pt; color: var(--pink); margin-top: 0.45in; }
  .small { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 0.12in; }`,
  cover: ({ meta, works }) => {
    const hero = works.find((w) => w.image)?.image ?? null;
    return `<div class="p">
      ${meta.kicker ? `<div class="ckick">${esc(meta.kicker)}</div>` : ''}
      <div class="chero">${hero ? risoFig(hero, 'width:4.6in;height:4.3in;object-fit:cover') : ''}</div>
      <div class="ctitle big over" style="${fit(meta.title, [36, 28, 20])}">${esc(meta.title)}</div>
      ${meta.subtitle ? `<div class="csub">${esc(meta.subtitle)}</div>` : ''}
      <div class="sticker"><b>${works.length}</b><span>${works.length === 1 ? 'work' : 'works'}</span></div>
    </div>`;
  },
  intro: ({ meta }) =>
    `<div class="text"><div class="h big">Intro&shy;duction</div><div class="body">${introText(meta.introduction, 1300)}</div></div>`,
  work: (w, i) =>
    `<div class="${i % 2 ? 'b' : 'p'}" style="position:absolute;inset:0">
      <div class="num big over">${w.num}</div>
      <div class="wfig">${w.image ? risoFig(w.image) : ''}</div>
      <div class="wtext">
        <div class="wtitle big over">${w.title}${w.year ? `, ${w.year}` : ''}</div>
        ${w.artist ? `<div class="wartist">${w.artist}</div>` : ''}
        ${w.meta ? `<div class="wmeta">${w.meta}</div>` : ''}
        ${w.description ? `<div class="wdesc">${w.description}</div>` : ''}
        ${w.price ? `<div class="wprice">${w.price}</div>` : ''}
      </div>
    </div>`,
  index: (rows) =>
    `<div class="text"><div class="h big">Index</div>${rows
      .map((w) => `<div class="row"><div class="n">${w.num}</div><div><div>${w.title}${w.year ? `, ${w.year}` : ''}</div>${w.artist ? `<div class="a">${w.artist}</div>` : ''}</div></div>`)
      .join('')}</div>`,
  notes: () => `<div class="text"><div class="h big">Notes</div></div><div class="dotgrid"></div>`,
  back: ({ meta }) =>
    `<div class="back">
      ${meta.qrSvg ? `<div class="qr">${meta.qrSvg}</div><div class="small">Scan to view online</div>` : ''}
      <div class="brand big">Provenance</div>
      <div class="small">${esc(meta.printDate)}</div>
    </div>`,
};

// ── Xerox ─────────────────────────────────────────────────────────────────────

const TILTS = [-2.4, 1.8, -1.1, 2.6, -0.7, 1.2];
const RANSOM = ['r0', 'r1', 'r2', 'r3', 'r4'];

/** Cut-out letters for the cover title. */
function ransom(text: string): string {
  return text
    .split(/(\s+)/)
    .map((word, wi) =>
      /^\s+$/.test(word)
        ? ' '
        : `<span class="word">${[...word]
            .map((ch, ci) => {
              const k = wi * 7 + ci * 3;
              return `<span class="ltr ${pick(RANSOM, k)}" style="transform:rotate(${pick([-4, 3, -2, 5, -1, 2], k)}deg)">${esc(ch)}</span>`;
            })
            .join('')}</span>`,
    )
    .join('');
}

const tape = (cls: string) => `<i class="tape ${cls}"></i>`;

const xerox: StyleKit = {
  fonts: fontLink('family=Special+Elite&family=Permanent+Marker&family=Archivo+Black&family=Fraunces:ital,opsz,wght@1,9..144,500'),
  css: `
  body { background: #efece5; }
  .zp { background: #efece5; color: #111; font-family: 'Special Elite', 'Courier New', monospace; box-shadow: inset 0 0 0.4in rgba(0,0,0,0.16); }
  .zp::before { content: ''; position: absolute; inset: 0; background-image: radial-gradient(rgba(0,0,0,0.09) 0.6px, transparent 0.8px), radial-gradient(rgba(0,0,0,0.06) 0.5px, transparent 0.7px); background-size: 9px 11px, 13px 7px; background-position: 0 0, 4px 5px; pointer-events: none; }
  .photo { position: absolute; background: #fff; padding: 0.08in; box-shadow: 0 1pt 3pt rgba(0,0,0,0.3); }
  .photo img { display: block; filter: grayscale(1) contrast(1.75) brightness(1.08); }
  .tape { position: absolute; width: 1.05in; height: 0.3in; background: rgba(226,218,176,0.78); box-shadow: 0 0.5pt 1pt rgba(0,0,0,0.15); }
  .tape.t { top: -0.14in; left: 50%; margin-left: -0.52in; transform: rotate(-3deg); }
  .tape.tl { top: -0.08in; left: -0.32in; transform: rotate(-38deg); }
  .tape.br { bottom: -0.08in; right: -0.32in; transform: rotate(-38deg); }
  .wfig { position: absolute; top: 0.6in; left: 0.4in; right: 0.4in; height: 4.4in; display: flex; align-items: center; justify-content: center; }
  .wfig .photo { position: relative; }
  .wfig img { max-width: 4.3in; max-height: 4.05in; }
  .num { position: absolute; top: 0.22in; right: 0.35in; font-family: 'Permanent Marker', cursive; font-size: 20pt; transform: rotate(6deg); }
  .wtext { position: absolute; left: 0.5in; right: 0.5in; bottom: 0.55in; }
  .strip { display: inline-block; background: #111; color: #efece5; padding: 2pt 6pt; font-size: 12pt; line-height: 1.25; transform: rotate(-1deg); box-decoration-break: clone; -webkit-box-decoration-break: clone; }
  .wartist { display: inline-block; background: #fff; padding: 1pt 5pt; font-size: 8.5pt; margin-top: 0.08in; transform: rotate(0.8deg); box-shadow: 0 0.5pt 1.5pt rgba(0,0,0,0.25); }
  .wmeta { font-size: 7pt; margin-top: 0.08in; }
  .wdesc { font-size: 7.5pt; line-height: 1.5; margin-top: 0.08in; }
  .wprice { font-family: 'Permanent Marker', cursive; font-size: 12pt; margin-top: 0.05in; transform: rotate(-3deg); display: inline-block; }
  .folio { position: absolute; bottom: 0.2in; font-family: 'Permanent Marker', cursive; font-size: 10pt; }
  .zp:nth-child(odd) .folio { right: 0.4in; } .zp:nth-child(even) .folio { left: 0.4in; }
  .sheet .zp:nth-child(odd) .folio { left: 0.4in; right: auto; } .sheet .zp:nth-child(even) .folio { right: 0.4in; left: auto; }
  .cphoto { width: 2.6in; height: 2.9in; } .cphoto img { width: 100%; height: 100%; object-fit: cover; }
  .k0 { left: 0.35in; top: 0.75in; transform: rotate(-5deg); }
  .k1 { right: 0.3in; top: 1.35in; transform: rotate(4deg); }
  .k2 { left: 1.35in; top: 2.4in; transform: rotate(-1.5deg); }
  .ksolo { left: 0.95in; top: 0.85in; width: 3.6in; height: 3.9in; transform: rotate(-2deg); }
  .ckick { position: absolute; top: 0.25in; left: 0.4in; font-family: 'Permanent Marker', cursive; font-size: 12pt; transform: rotate(-3deg); }
  .ctitle { position: absolute; left: 0.3in; right: 0.3in; bottom: 1.05in; line-height: 1.5; }
  .word { display: inline-block; white-space: nowrap; margin-right: 0.12in; }
  .ltr { display: inline-block; font-size: 1em; line-height: 1; padding: 2pt 3pt; margin: 1pt; box-shadow: 0 0.5pt 1.5pt rgba(0,0,0,0.3); }
  .r0 { background: #111; color: #efece5; font-family: 'Archivo Black', Impact, sans-serif; }
  .r1 { background: #fff; font-family: 'Special Elite', monospace; }
  .r2 { background: #d9d4c9; font-family: Fraunces, Georgia, serif; font-style: italic; }
  .r3 { background: #fff; font-family: 'Archivo Black', Impact, sans-serif; font-size: 0.85em; }
  .r4 { background: #111; color: #efece5; font-family: Fraunces, Georgia, serif; font-style: italic; }
  .csub { position: absolute; left: 0.45in; right: 0.45in; bottom: 0.45in; font-size: 8pt; }
  .text { position: absolute; inset: 0.7in 0.55in; }
  .h { margin-bottom: 0.25in; }
  .body p { font-size: 9pt; line-height: 1.6; margin-bottom: 0.11in; }
  .row { display: flex; gap: 0.12in; padding: 0.045in 0; font-size: 8pt; border-bottom: 0.5pt solid rgba(0,0,0,0.35); }
  .row .n { width: 0.28in; } .row .a { font-size: 7pt; opacity: 0.75; }
  .ruled { position: absolute; inset: 1.35in 0.55in 0.7in; background: repeating-linear-gradient(180deg, transparent 0, transparent 0.3in, rgba(0,0,0,0.3) 0.3in, rgba(0,0,0,0.3) calc(0.3in + 0.5pt)); }
  .scribble { font-family: 'Permanent Marker', cursive; font-size: 16pt; transform: rotate(-4deg); display: inline-block; }
  .back { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
  .back .photo { position: relative; transform: rotate(2deg); width: 1.7in; } .qr svg { width: 100%; height: auto; display: block; }
  .brand { margin-top: 0.5in; }`,
  cover: ({ meta, works }) => {
    const shown = works.filter((w) => w.image).slice(0, 3);
    const photos =
      shown.length === 1
        ? `<div class="photo cphoto ksolo">${tape('t')}${img(shown[0]!.image)}</div>`
        : shown.map((w, i) => `<div class="photo cphoto k${i}">${tape(i === 1 ? 'tl' : 't')}${img(w.image)}</div>`).join('');
    return `${photos}
      ${meta.kicker ? `<div class="ckick">${esc(meta.kicker)}</div>` : ''}
      <div class="ctitle" style="${fit(meta.title, [24, 18, 13])}">${ransom(meta.title)}</div>
      ${meta.subtitle ? `<div class="csub"><span class="strip" style="font-size:8pt">${esc(meta.subtitle)}</span></div>` : ''}`;
  },
  intro: ({ meta }) =>
    `<div class="text"><div class="h"><span class="strip">Introduction</span></div><div class="body">${introText(meta.introduction, 1200)}</div></div>`,
  work: (w, i) =>
    `<div class="num">#${w.num}</div>
     <div class="wfig">${w.image ? `<div class="photo" style="transform:rotate(${pick(TILTS, i)}deg)">${tape(i % 2 ? 't' : 'tl')}${i % 3 === 2 ? tape('br') : ''}${img(w.image)}</div>` : ''}</div>
     <div class="wtext">
       <div><span class="strip">${w.title}${w.year ? `, ${w.year}` : ''}</span></div>
       ${w.artist ? `<div class="wartist">${w.artist}</div>` : ''}
       ${w.meta ? `<div class="wmeta">${w.meta}</div>` : ''}
       ${w.description ? `<div class="wdesc">${w.description}</div>` : ''}
       ${w.price ? `<div class="wprice">${w.price}</div>` : ''}
     </div>`,
  index: (rows) =>
    `<div class="text"><div class="h"><span class="strip">Index of works</span></div>${rows
      .map((w) => `<div class="row"><div class="n">${w.num}</div><div><div>${w.title}${w.year ? `, ${w.year}` : ''}</div>${w.artist ? `<div class="a">${w.artist}</div>` : ''}</div></div>`)
      .join('')}</div>`,
  notes: () => `<div class="text"><span class="scribble">notes</span></div><div class="ruled"></div>`,
  back: ({ meta }) =>
    `<div class="back">
      ${meta.qrSvg ? `<div class="photo">${tape('t')}<div class="qr">${meta.qrSvg}</div></div><div class="scribble" style="margin-top:0.2in">scan me ↗</div>` : ''}
      <div class="brand"><span class="strip">Provenance</span></div>
      <div class="wmeta">${esc(meta.printDate)}</div>
    </div>`,
};

const KITS: Record<ZineStyle, StyleKit> = { layered, riso, xerox };

// ── Entry point ───────────────────────────────────────────────────────────────

export function buildZineHtml(meta: CatalogMeta, items: CatalogItem[], options: ZineOptions): string {
  if (options.coverName === 'provenance') meta = { ...meta, kicker: 'Provenance' };
  const kit = KITS[options.style] ?? layered;
  const works = prepare(items, options);
  const ctx: Ctx = { meta, works, options };

  // Interior pages carry folios; the covers don't.
  const interior: string[] = [];
  if (meta.introduction?.trim()) interior.push(kit.intro(ctx));
  works.forEach((w, i) => interior.push(kit.work(w, i, ctx)));
  const indexPages: string[] = [];
  if (options.index && works.length) {
    for (let i = 0; i < works.length; i += INDEX_PER_PAGE) indexPages.push(kit.index(works.slice(i, i + INDEX_PER_PAGE), ctx));
  }
  // A booklet needs a multiple of four pages: blank notes pages fill the gap.
  const total = 2 + interior.length + indexPages.length;
  const pad = options.layout === 'booklet' ? (4 - (total % 4)) % 4 : 0;
  const notes = Array.from({ length: pad }, (_, i) => kit.notes(i));

  const inner = [...interior, ...notes, ...indexPages].map(
    (html, i) => `<section class="zp">${html}<div class="folio">${String(i + 2).padStart(2, '0')}</div></section>`,
  );
  const pages = [`<section class="zp">${kit.cover(ctx)}</section>`, ...inner, `<section class="zp">${kit.back(ctx)}</section>`];

  let body: string;
  let pageCss: string;
  if (options.layout === 'booklet') {
    // Saddle-stitch order: sheet s front = [n-1-2s, 2s], back = [2s+1, n-2-2s].
    const n = pages.length;
    const sides: string[] = [];
    for (let s = 0; s < n / 4; s++) {
      sides.push(`<div class="sheet">${pages[n - 1 - 2 * s]}${pages[2 * s]}</div>`);
      sides.push(`<div class="sheet">${pages[2 * s + 1]}${pages[n - 2 - 2 * s]}</div>`);
    }
    body = sides.join('');
    pageCss = `@page { size: letter landscape; margin: 0; }
  .sheet { width: 11in; height: 8.5in; display: flex; overflow: hidden; break-after: page; page-break-after: always; }
  .sheet:last-child { break-after: auto; page-break-after: auto; }
  @media screen { body { padding: 0.3in 0; } .sheet { margin: 0 auto 0.3in; box-shadow: 0 2px 12px rgba(0,0,0,0.25); } }`;
  } else {
    body = pages.join('');
    pageCss = `@page { size: 5.5in 8.5in; margin: 0; }
  body > .zp { break-after: page; page-break-after: always; }
  body > .zp:last-of-type { break-after: auto; page-break-after: auto; }
  @media screen { body { padding: 0.3in 0; } body > .zp { margin: 0 auto 0.3in; box-shadow: 0 2px 12px rgba(0,0,0,0.25); } }`;
  }

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<title>${esc(meta.title)} — Zine</title>
${kit.fonts}
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  ${pageCss}
  .zp { position: relative; width: 5.5in; height: 8.5in; overflow: hidden; flex: none; }
${kit.css}
</style></head>
<body>${kit.defs ?? ''}${body}${PRINT_WHEN_READY}</body></html>`;
}

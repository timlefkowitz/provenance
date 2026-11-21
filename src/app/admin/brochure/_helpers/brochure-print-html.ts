import { doc, ED, EDITORIAL_FONTS, esc } from '~/app/exhibitions/_helpers/catalog-print-html';
import type { BrochureContent, BrochureImage, BrochureSection } from '../_content';

/**
 * The gallery & museum brochure as print HTML, in the catalog's Editorial
 * (navbar) look: bone paper, the italic "Provenance." wordmark, mono labels.
 *
 * Pages are laid out at the book size the catalog's imposition uses
 * (6.875 × 10.625in, scaled to 80% onto 5.5 × 8.5in half-letter pages), so
 * the eight pages print as a saddle-stitched booklet on two Letter sheets via
 * openPrintWindow → layoutBookWindow.
 */

type Opts = {
  /** Site origin, so images load inside the print window. */
  origin: string;
  /** Markup of the back-cover QR code. */
  qrSvg: string;
};

const mono = `'JetBrains Mono', ui-monospace, Menlo, monospace`;
const serif = `'Fraunces', Georgia, 'Times New Roman', serif`;

const CSS = `
  html, body { background: ${ED.bone}; }
  body { font-family: ${serif}; color: ${ED.ink}; }
  .page { width: 6.875in; height: 10.625in; padding: 0.5in 0.55in 0.42in; background: ${ED.bone}; display: flex; flex-direction: column; overflow: hidden; position: relative; }
  .bar { display: flex; align-items: baseline; justify-content: space-between; gap: 0.16in; padding-bottom: 0.13in; border-bottom: 0.75pt solid ${ED.rule}; margin-bottom: 0.32in; flex: none; }
  .wordmark { font-family: ${serif}; font-style: italic; font-size: 17pt; letter-spacing: -0.01em; line-height: 1; }
  .wordmark span, .dot { color: ${ED.vermillion}; font-style: normal; }
  .nav { display: flex; gap: 0.18in; font-family: ${mono}; font-size: 6.8pt; font-weight: 500; letter-spacing: 0.18em; text-transform: uppercase; }
  .nav span { padding-bottom: 2px; border-bottom: 1.5pt solid transparent; }
  .nav span.on { color: ${ED.vermillion}; border-bottom-color: ${ED.vermillion}; }
  .bar-right { font-family: ${mono}; font-size: 6.5pt; letter-spacing: 0.14em; text-transform: uppercase; color: ${ED.muted}; white-space: nowrap; }
  .eyebrow { display: flex; align-items: center; gap: 0.12in; font-family: ${mono}; font-size: 7.5pt; letter-spacing: 0.2em; text-transform: uppercase; color: #a67c1c; margin-bottom: 0.16in; flex: none; }
  .eyebrow i { flex: 1; height: 0.5pt; background: ${ED.rule}; opacity: 0.35; }
  h1 { font-family: ${serif}; font-style: italic; font-weight: 400; font-size: 31pt; line-height: 1.02; letter-spacing: -0.02em; flex: none; }
  .lead { font-size: 11pt; line-height: 1.5; color: #3c352d; margin-top: 0.18in; flex: none; }
  .mono { font-family: ${mono}; text-transform: uppercase; letter-spacing: 0.16em; }
  .photo { flex: 1; min-height: 1.4in; margin-top: 0.26in; border: 0.75pt solid ${ED.rule}; padding: 0.1in; background: #fbf8f2; display: flex; }
  .photo img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .photo.contain img { object-fit: contain; }
  .photo.fixed { flex: none; }
  .cap { flex: none; font-family: ${mono}; font-size: 6.3pt; letter-spacing: 0.12em; text-transform: uppercase; color: ${ED.muted}; margin-top: 0.07in; }
  .foot { flex: none; display: flex; justify-content: space-between; border-top: 0.75pt solid ${ED.rule}; padding-top: 0.11in; margin-top: auto; font-family: ${mono}; font-size: 6.5pt; letter-spacing: 0.16em; text-transform: uppercase; color: ${ED.muted}; }
  .foot b { color: ${ED.vermillion}; font-weight: 500; }
  .spacer { flex: none; height: 0.22in; }

  /* Cover */
  .cover h1 { font-size: 44pt; line-height: 0.96; }
  .cover .lead { font-size: 11.5pt; }

  /* Numbered points */
  .points { display: grid; grid-template-columns: 1fr 1fr; gap: 0.22in 0.3in; margin-top: 0.28in; flex: none; }
  .points.one { grid-template-columns: 1fr; gap: 0.16in; }
  .pt { border-top: 0.75pt solid ${ED.rule}; padding-top: 0.09in; }
  .pt .n { font-family: ${mono}; font-size: 6.8pt; color: ${ED.vermillion}; letter-spacing: 0.14em; font-weight: 500; }
  .pt h3 { font-family: ${serif}; font-style: italic; font-weight: 400; font-size: 13.5pt; line-height: 1.15; margin: 0.04in 0 0.05in; }
  .pt p { font-size: 9pt; line-height: 1.5; color: #3c352d; }
  .points.one .pt { display: grid; grid-template-columns: 0.4in 1fr; column-gap: 0.1in; }
  .points.one .pt .n { grid-row: span 2; padding-top: 0.05in; }
  .points.one .pt h3 { margin-top: 0; }

  .points.big .pt h3 { font-size: 16pt; }
  .points.big .pt p { font-size: 10.2pt; }
  .points.big { gap: 0.3in 0.32in; margin-top: 0.34in; }
  .quote { flex: none; margin: auto 0; border-left: 2.5pt solid ${ED.vermillion}; padding: 0.04in 0 0.04in 0.18in; font-style: italic; font-size: 21pt; line-height: 1.22; }

  /* Chain */
  .chain { flex: none; display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.1in; margin-top: 0.3in; position: relative; }
  .link { border: 0.75pt solid ${ED.rule}; background: #fbf8f2; padding: 0.1in 0.09in 0.11in; position: relative; }
  .link:not(:last-child)::after { content: '→'; position: absolute; right: -0.105in; top: 0.07in; font-family: ${mono}; font-size: 8pt; color: ${ED.vermillion}; background: ${ED.bone}; line-height: 1; }
  .link .role { font-family: ${mono}; font-size: 6.8pt; letter-spacing: 0.16em; text-transform: uppercase; color: ${ED.vermillion}; font-weight: 500; }
  .link p { font-size: 8.6pt; line-height: 1.4; margin-top: 0.05in; color: #3c352d; }
  .thread { flex: none; margin-top: 0.1in; border: 0.75pt solid ${ED.vermillion}; color: ${ED.vermillion}; text-align: center; padding: 0.06in; font-family: ${mono}; font-size: 6.8pt; letter-spacing: 0.2em; text-transform: uppercase; }

  table.cmp { flex: none; width: 100%; border-collapse: collapse; margin-top: 0.32in; font-size: 10pt; }
  table.cmp th { font-family: ${mono}; font-size: 6.8pt; font-weight: 500; letter-spacing: 0.16em; text-transform: uppercase; text-align: left; padding: 0 0.1in 0.08in 0; border-bottom: 0.75pt solid ${ED.rule}; color: ${ED.muted}; width: 50%; }
  table.cmp th.us { color: ${ED.vermillion}; }
  table.cmp td { padding: 0.09in 0.1in 0.09in 0; border-bottom: 0.5pt solid rgba(0,0,0,0.13); vertical-align: top; line-height: 1.4; }
  table.cmp td.them { color: ${ED.muted}; text-decoration: line-through; text-decoration-color: rgba(226,70,44,0.45); }
  table.cmp td.us { font-style: italic; }

  /* Tools grid */
  .tools { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.16in 0.2in; margin-top: 0.24in; flex: none; }
  .tools .pt h3 { font-size: 12pt; }
  .tools .pt p { font-size: 8.3pt; }

  /* Artists page: an odd count ends on a full-width point */
  .points.odd { gap: 0.18in 0.3in; margin-top: 0.22in; }
  .points.odd .pt:last-child:nth-child(odd) { grid-column: 1 / -1; }
  .callout { flex: none; margin-top: 0.2in; background: ${ED.ink}; color: ${ED.bone}; padding: 0.16in 0.2in; font-style: italic; font-size: 12pt; line-height: 1.35; }
  .callout b { color: ${ED.vermillion}; font-style: normal; }

  /* Back cover */
  .back { justify-content: center; align-items: center; text-align: center; }
  .back-inner { display: flex; flex-direction: column; align-items: center; gap: 0.16in; max-width: 4.6in; }
  .back h1 { font-size: 40pt; }
  .back .lead { margin-top: 0; }
  .back-qr { width: 1.6in; background: #fff; padding: 0.1in; border: 0.75pt solid ${ED.rule}; margin-top: 0.1in; }
  .back-qr svg { width: 100%; height: auto; display: block; }
  .back-mark { font-size: 26pt; margin-top: 0.2in; }
  .back-sub { font-size: 7pt; color: ${ED.muted}; }
  .contact { font-family: ${mono}; font-size: 7.5pt; letter-spacing: 0.1em; line-height: 1.8; }
  .roles { position: absolute; left: 0.55in; right: 0.55in; bottom: 0.42in; border-top: 0.75pt solid ${ED.rule}; padding-top: 0.11in; font-style: italic; font-size: 10.5pt; color: #3c352d; }
`;

/** On-screen preview: the pages side by side, at print size. */
const PREVIEW_CSS = `
  html, body { background: #8a8a8a !important; }
  body { display: flex; flex-wrap: wrap; justify-content: center; gap: 0.3in; padding: 0.3in; }
  .page { box-shadow: 0 2px 12px rgba(0,0,0,0.3); }`;

export function buildBrochureHtml(c: BrochureContent, opts: Opts, mode: 'print' | 'preview' = 'print'): string {
  const img = (i: BrochureImage) => `<img src="${esc(opts.origin + i.src)}" alt="" />`;
  const cap = (i: BrochureImage) => (i.caption ? `<div class="cap">${esc(i.caption)}</div>` : '');
  const bar = (on: BrochureSection | null) => `
    <div class="bar">
      <div class="wordmark">Provenance<span>.</span></div>
      <div class="nav">${c.nav.map((s) => `<span class="${s === on ? 'on' : ''}">${esc(s)}</span>`).join('')}</div>
      <div class="bar-right">${esc(c.kicker)}</div>
    </div>`;
  const eyebrow = (t: string) => `<div class="eyebrow"><span>${esc(t)}</span><i></i></div>`;
  const h1 = (t: string) => `<h1>${esc(t)}<span class="dot">.</span></h1>`;
  const foot = (n: number) => `<div class="foot"><span>${esc(c.website)}</span><span><b>${String(n).padStart(2, '0')}</b> / 08</span></div>`;
  const pt = (p: { title: string; body: string }, i: number) =>
    `<div class="pt"><div class="n">${String(i + 1).padStart(2, '0')}</div><h3>${esc(p.title)}</h3><p>${esc(p.body)}</p></div>`;

  const cover = `
    <section class="page cover">
      ${bar('Record')}
      ${eyebrow(c.cover.eyebrow)}
      ${h1(c.cover.headline)}
      <p class="lead">${esc(c.cover.sub)}</p>
      <div class="photo">${img(c.cover.image)}</div>
      <div class="spacer"></div>
      ${foot(1)}
    </section>`;

  const problem = `
    <section class="page">
      ${bar('Record')}
      ${eyebrow(c.problem.eyebrow)}
      ${h1(c.problem.headline)}
      <p class="lead">${esc(c.problem.lead)}</p>
      <div class="points big">${c.problem.points.map(pt).join('')}</div>
      <blockquote class="quote">${esc(c.problem.quote)}</blockquote>
      ${foot(2)}
    </section>`;

  const record = `
    <section class="page">
      ${bar('Record')}
      ${eyebrow(c.record.eyebrow)}
      ${h1(c.record.headline)}
      <p class="lead">${esc(c.record.lead)}</p>
      <div class="chain">${c.record.chain
        .map((l) => `<div class="link"><div class="role">${esc(l.role)}</div><p>${esc(l.does)}</p></div>`)
        .join('')}</div>
      <div class="thread">One record · shared by all four · history intact</div>
      <table class="cmp">
        <thead><tr><th>${esc(c.record.compare.left)}</th><th class="us">${esc(c.record.compare.right)}</th></tr></thead>
        <tbody>${c.record.compare.rows.map(([a, b]) => `<tr><td class="them">${esc(a)}</td><td class="us">${esc(b)}</td></tr>`).join('')}</tbody>
      </table>
      <blockquote class="quote">${esc(c.record.statement)}</blockquote>
      ${foot(3)}
    </section>`;

  const dropoff = `
    <section class="page">
      ${bar('Tools')}
      ${eyebrow(c.dropoff.eyebrow)}
      ${h1(c.dropoff.headline)}
      <p class="lead">${esc(c.dropoff.lead)}</p>
      <div class="photo">${img(c.dropoff.image)}</div>
      ${cap(c.dropoff.image)}
      <div class="points">${c.dropoff.steps.map(pt).join('')}</div>
      <div class="spacer"></div>
      ${foot(4)}
    </section>`;

  const tools = `
    <section class="page">
      ${bar('Tools')}
      ${eyebrow(c.tools.eyebrow)}
      ${h1(c.tools.headline)}
      <p class="lead">${esc(c.tools.lead)}</p>
      <div class="photo contain">${img(c.tools.image)}</div>
      ${cap(c.tools.image)}
      <div class="tools">${c.tools.items.map(pt).join('')}</div>
      <div class="spacer"></div>
      ${foot(5)}
    </section>`;

  const looking = `
    <section class="page">
      ${bar('Network')}
      ${eyebrow(c.looking.eyebrow)}
      ${h1(c.looking.headline)}
      <p class="lead">${esc(c.looking.lead)}</p>
      <div class="photo">${img(c.looking.image)}</div>
      ${cap(c.looking.image)}
      <div class="points one">${c.looking.points.map(pt).join('')}</div>
      <div class="spacer"></div>
      ${foot(6)}
    </section>`;

  const artists = `
    <section class="page">
      ${bar('Network')}
      ${eyebrow(c.artists.eyebrow)}
      ${h1(c.artists.headline)}
      <p class="lead">${esc(c.artists.lead)}</p>
      <div class="photo contain">${img(c.artists.image)}</div>
      ${cap(c.artists.image)}
      <div class="points odd">${c.artists.items.map(pt).join('')}</div>
      <div class="callout">${esc(c.artists.closing)}</div>
      <div class="spacer"></div>
      ${foot(7)}
    </section>`;

  const { name, email, phone } = c.back.contact;
  const contact = [name, email, phone].filter((s) => s.trim());
  const back = `
    <section class="page back">
      <div class="back-inner">
        ${h1(c.back.headline)}
        <p class="lead">${esc(c.back.sub)}</p>
        <div class="back-qr">${opts.qrSvg}</div>
        <div class="mono back-sub">${esc(c.back.qrLabel)} · ${esc(c.website)}</div>
        ${contact.length ? `<div class="contact">${contact.map(esc).join('<br />')}</div>` : ''}
        <div class="wordmark back-mark">Provenance<span>.</span></div>
      </div>
      <div class="roles">${esc(c.back.roles)}</div>
    </section>`;

  const body = [cover, problem, record, dropoff, tools, looking, artists, back].join('');
  const title = 'Provenance — For galleries & museums';
  if (mode === 'print') return doc(title, EDITORIAL_FONTS, CSS, body, 'staple');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><title>${esc(title)}</title>${EDITORIAL_FONTS}
<style>* { box-sizing: border-box; margin: 0; padding: 0; }${CSS}${PREVIEW_CSS}</style></head><body>${body}</body></html>`;
}

import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';

import type { Report } from './build-reports';

const PAGE: [number, number] = [792, 612]; // US Letter, landscape: tables need the width
const MARGIN = 40;
const WINE = rgb(0.45, 0.1, 0.16);
const INK = rgb(0.15, 0.13, 0.12);
const MUTED = rgb(0.45, 0.42, 0.4);

/** pdf-lib's standard fonts only encode WinAnsi; swap anything else. */
function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '?');
}

function fit(font: PDFFont, text: string, size: number, width: number): string {
  let t = safe(text);
  if (font.widthOfTextAtSize(t, size) <= width) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}...`, size) > width) t = t.slice(0, -1);
  return `${t}...`;
}

/** Renders a Report: title, then each section's figures and table, paginating as needed. */
export async function buildReportPdfBytes(report: Report): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.TimesRoman);
  const bold = await doc.embedFont(StandardFonts.TimesRomanBold);
  const width = PAGE[0] - MARGIN * 2;

  let page: PDFPage = doc.addPage(PAGE);
  let y = PAGE[1] - MARGIN;
  const ensure = (h: number) => {
    if (y - h < MARGIN) {
      page = doc.addPage(PAGE);
      y = PAGE[1] - MARGIN;
    }
  };
  const text = (t: string, x: number, size: number, f = font, color = INK, w = width) =>
    page.drawText(fit(f, t, size, w), { x, y, size, font: f, color });

  text(report.title, MARGIN, 20, bold, WINE);
  y -= 22;
  text(report.subtitle, MARGIN, 11, font, MUTED);
  y -= 26;

  for (const section of report.sections) {
    ensure(40);
    text(section.heading.toUpperCase(), MARGIN, 10, bold, WINE);
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.5, color: WINE });
    y -= 14;

    if (section.figures?.length) {
      const colW = width / 3;
      section.figures.forEach(([label, value], i) => {
        const col = i % 3;
        if (col === 0) ensure(16);
        const x = MARGIN + col * colW;
        text(label, x, 9, font, MUTED, colW * 0.55);
        text(value, x + colW * 0.55, 10, bold, INK, colW * 0.43);
        if (col === 2 || i === section.figures!.length - 1) y -= 15;
      });
      y -= 4;
    }

    if (section.note) {
      ensure(14);
      text(section.note, MARGIN, 8.5, font, MUTED);
      y -= 14;
    }

    if (section.table) {
      const { columns, rows } = section.table;
      // Size columns to their content; long text columns shrink (and truncate) first.
      const GAP = 10;
      const natural = columns.map((c, i) =>
        Math.max(
          bold.widthOfTextAtSize(safe(c), 8.5),
          ...rows.map((r) => font.widthOfTextAtSize(safe(r[i] ?? ''), 9)),
        ) + GAP,
      );
      const total = natural.reduce((a, b) => a + b, 0);
      let ws = natural;
      if (total > width) {
        // Keep short columns whole; share what's left among the wide ones.
        const fair = width / columns.length;
        const fixed = natural.filter((w) => w <= fair).reduce((a, b) => a + b, 0);
        const wide = natural.filter((w) => w > fair).reduce((a, b) => a + b, 0);
        ws = natural.map((w) => (w <= fair ? w : (w / wide) * (width - fixed)));
      } else {
        ws = natural.map((w) => w + (width - total) / columns.length);
      }
      const xs = ws.map((_, i) => MARGIN + ws.slice(0, i).reduce((a, b) => a + b, 0));
      ws = ws.map((w) => w - GAP);
      const header = () => {
        columns.forEach((c, i) => text(c, xs[i]!, 8.5, bold, MUTED, ws[i]));
        y -= 13;
      };
      ensure(30);
      header();
      if (!rows.length) {
        text('None', MARGIN, 9, font, MUTED);
        y -= 13;
      }
      for (const row of rows) {
        if (y - 13 < MARGIN) {
          ensure(1000);
          header();
        }
        row.forEach((cell, i) => text(cell, xs[i]!, 9, font, INK, ws[i]));
        y -= 13;
      }
      y -= 8;
    }
    y -= 6;
  }

  const pages = doc.getPages();
  pages.forEach((p, i) =>
    p.drawText(`${safe(report.title)} - page ${i + 1} of ${pages.length} - Provenance`, {
      x: MARGIN,
      y: 20,
      size: 8,
      font,
      color: MUTED,
    }),
  );
  return doc.save();
}

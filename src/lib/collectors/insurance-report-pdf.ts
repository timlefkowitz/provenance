import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';

export interface InsuranceScheduleItem {
  title: string;
  artistName: string | null;
  medium: string | null;
  dimensions: string | null;
  creationDate: string | null;
  certificateNumber: string | null;
  valueCents: number;
  /** e.g. "Formal valuation, Mar 4, 2026" */
  basis: string;
  paidCents: number | null;
}

const PAGE: [number, number] = [612, 792];
const MARGIN = 40;
const BOTTOM = 70;
const COLS = { title: 40, medium: 232, cert: 372, value: 452, basis: 522 };

/** Standard fonts only cover WinAnsi; swap anything else for '?' instead of throwing. */
function safeText(font: PDFFont, text: string): string {
  let out = '';
  for (const ch of text.replace(/\s+/g, ' ')) {
    try {
      font.encodeText(ch);
      out += ch;
    } catch {
      out += '?';
    }
  }
  return out;
}

function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const words = safeText(font, text).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) {
      current = next;
      continue;
    }
    if (current) lines.push(current);
    // Hard-break a single word that is wider than the column.
    let rest = word;
    while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
      let cut = rest.length - 1;
      while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
      lines.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    current = rest;
  }
  if (current) lines.push(current);
  return lines.length ? lines : ['—'];
}

export async function buildInsuranceReportPdfBytes(input: {
  ownerName: string;
  generatedAt: Date;
  items: InsuranceScheduleItem[];
}): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(`Collection schedule — ${input.ownerName}`);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const muted = rgb(0.4, 0.4, 0.4);
  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const money = (cents: number) => (cents ? fmt.format(cents / 100) : '—');
  const dateLabel = input.generatedAt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const totalValue = input.items.reduce((acc, i) => acc + i.valueCents, 0);
  const pages: PDFPage[] = [];

  const drawHeaderRow = (page: PDFPage, y: number) => {
    const size = 8;
    page.drawText('ARTWORK', { x: COLS.title, y, size, font: bold });
    page.drawText('MEDIUM / SIZE', { x: COLS.medium, y, size, font: bold });
    page.drawText('CERTIFICATE', { x: COLS.cert, y, size, font: bold });
    page.drawText('VALUE', { x: COLS.value, y, size, font: bold });
    page.drawText('BASIS', { x: COLS.basis, y, size, font: bold });
    page.drawLine({ start: { x: MARGIN, y: y - 4 }, end: { x: PAGE[0] - MARGIN, y: y - 4 }, thickness: 0.5, color: muted });
    return y - 16;
  };

  const newPage = () => {
    const page = pdfDoc.addPage(PAGE);
    pages.push(page);
    return page;
  };

  // Cover block
  let page = newPage();
  let y = 740;
  page.drawText('Collection Schedule', { x: MARGIN, y, size: 22, font: bold });
  y -= 18;
  page.drawText('Prepared for insurance purposes', { x: MARGIN, y, size: 10, font, color: muted });
  y -= 28;
  page.drawText(safeText(bold, input.ownerName), { x: MARGIN, y, size: 12, font: bold });
  y -= 15;
  page.drawText(`Generated ${dateLabel} via Provenance`, { x: MARGIN, y, size: 10, font });
  y -= 15;
  page.drawText(
    `${input.items.length} ${input.items.length === 1 ? 'work' : 'works'} · Total scheduled value ${money(totalValue)}`,
    { x: MARGIN, y, size: 10, font },
  );
  y -= 30;
  y = drawHeaderRow(page, y);

  input.items.forEach((item, index) => {
    const size = 8.5;
    const lead = 11;
    const titleLines = wrap(bold, `${index + 1}. ${item.title || 'Untitled'}`, size, COLS.medium - COLS.title - 8);
    const subLines = wrap(
      font,
      [item.artistName, item.creationDate].filter(Boolean).join(', ') || '—',
      size,
      COLS.medium - COLS.title - 8,
    );
    const mediumLines = wrap(font, [item.medium, item.dimensions].filter(Boolean).join(' · ') || '—', size, COLS.cert - COLS.medium - 8);
    const certLines = wrap(font, item.certificateNumber || '—', size, COLS.value - COLS.cert - 8);
    const basisLines = wrap(font, item.basis, 7.5, PAGE[0] - MARGIN - COLS.basis);
    const rowHeight =
      Math.max(titleLines.length + subLines.length, mediumLines.length, certLines.length, basisLines.length + (item.paidCents ? 1 : 0)) * lead + 8;

    if (y - rowHeight < BOTTOM) {
      page = newPage();
      y = drawHeaderRow(page, 740);
    }

    let ty = y;
    for (const line of titleLines) {
      page.drawText(line, { x: COLS.title, y: ty, size, font: bold });
      ty -= lead;
    }
    for (const line of subLines) {
      page.drawText(line, { x: COLS.title, y: ty, size, font, color: muted });
      ty -= lead;
    }
    mediumLines.forEach((line, i) => page.drawText(line, { x: COLS.medium, y: y - i * lead, size, font }));
    certLines.forEach((line, i) => page.drawText(line, { x: COLS.cert, y: y - i * lead, size, font }));
    page.drawText(money(item.valueCents), { x: COLS.value, y, size, font: bold });
    basisLines.forEach((line, i) => page.drawText(line, { x: COLS.basis, y: y - i * lead, size: 7.5, font, color: muted }));
    if (item.paidCents) {
      page.drawText(`Paid ${money(item.paidCents)}`, {
        x: COLS.basis,
        y: y - basisLines.length * lead,
        size: 7.5,
        font,
        color: muted,
      });
    }

    y -= rowHeight;
    page.drawLine({ start: { x: MARGIN, y: y + 6 }, end: { x: PAGE[0] - MARGIN, y: y + 6 }, thickness: 0.25, color: rgb(0.85, 0.85, 0.85) });
  });

  if (y < BOTTOM + 30) {
    page = newPage();
    y = 740;
  }
  y -= 10;
  page.drawText(`Total scheduled value: ${money(totalValue)}`, { x: COLS.cert, y, size: 10, font: bold });

  const disclaimer =
    'Values are estimates drawn from formal valuations, recorded sale prices or values declared by the owner, as noted per work. They are not appraisals. Confirm coverage amounts with your insurer or a qualified appraiser.';
  pages.forEach((p, i) => {
    const lines = wrap(font, disclaimer, 7, PAGE[0] - MARGIN * 2);
    lines.forEach((line, j) => p.drawText(line, { x: MARGIN, y: 44 - j * 9, size: 7, font, color: muted }));
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE[0] - MARGIN - 50, y: 20, size: 7, font, color: muted });
  });

  return pdfDoc.save();
}

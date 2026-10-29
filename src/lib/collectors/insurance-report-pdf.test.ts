import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';

import { buildInsuranceReportPdfBytes } from './insurance-report-pdf';

describe('buildInsuranceReportPdfBytes', () => {
  it('builds a multi-page schedule without choking on non-Latin text', async () => {
    const items = Array.from({ length: 40 }, (_, i) => ({
      title: i === 0 ? '無題 (Untitled) 🎨 with a very long title that has to wrap across several lines' : `Work ${i}`,
      artistName: 'Zoë Ångström',
      medium: 'Oil on linen',
      dimensions: '120 × 90 cm',
      creationDate: '2024',
      certificateNumber: `PRV-${1000 + i}`,
      valueCents: 250_000,
      basis: i % 2 ? 'Formal valuation, Mar 4, 2026' : 'Declared by owner',
      paidCents: i % 3 ? 200_000 : null,
    }));

    const bytes = await buildInsuranceReportPdfBytes({
      ownerName: 'Outflight Collector',
      generatedAt: new Date('2026-10-29T00:00:00Z'),
      items,
    });

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(1);
  });

  it('builds an empty schedule', async () => {
    const bytes = await buildInsuranceReportPdfBytes({ ownerName: 'Nobody', generatedAt: new Date(), items: [] });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';

import { eventToProvenanceLine, normalizeExtractedProvenance } from './extract-provenance-document';

describe('normalizeExtractedProvenance', () => {
  it('keeps valid works and events, maps refs past dropped rows', () => {
    const out = normalizeExtractedProvenance({
      doc_type: 'Bill of Sale',
      summary: 'Sale of two works',
      artworks: [
        { title: '  ', artist_name: 'Nobody' },
        { title: 'Blue Field', artist: 'A. Painter', year: 2004, price: '$12,500.00' },
        { title: 'Red Field', artist_name: 'null', price: 'n/a' },
      ],
      events: [
        { type: 'sale', artwork_ref: 1, party: 'Jane Doe', date: '2004-05-01', price: '12500', currency: 'USD' },
        { type: 'sale', artwork_ref: 0, party: 'Dropped row' },
        { type: 'shipping', party: 'Ignored' },
        { type: 'ownership' },
      ],
    });

    expect(out.doc_type).toBe('bill_of_sale');
    expect(out.artworks).toHaveLength(2);
    expect(out.artworks[0]).toMatchObject({ ref: 0, title: 'Blue Field', artist_name: 'A. Painter', year: '2004', price: '12500' });
    expect(out.artworks[1]).toMatchObject({ title: 'Red Field', artist_name: null, price: null });
    // ref 1 in the model's list is our 0; ref 0 was a dropped row → unclear (null) with 2 works.
    expect(out.events).toHaveLength(2);
    expect(out.events[0]).toMatchObject({ type: 'sale', artwork_ref: 0, party: 'Jane Doe' });
    expect(out.events[1]).toMatchObject({ artwork_ref: null, party: 'Dropped row' });
  });

  it('defaults unknown input safely', () => {
    expect(normalizeExtractedProvenance(null)).toEqual({ doc_type: 'other', summary: '', artworks: [], events: [] });
    expect(normalizeExtractedProvenance({ doc_type: 'tax form', artworks: 'x' }).doc_type).toBe('other');
  });

  it('attributes events to the only work when there is one', () => {
    const out = normalizeExtractedProvenance({
      artworks: [{ title: 'Solo' }],
      events: [{ type: 'exhibition', venue: 'Gallery X', date: '2019' }],
    });
    expect(out.events[0]?.artwork_ref).toBe(0);
  });
});

describe('eventToProvenanceLine', () => {
  it('formats who, where and when', () => {
    expect(
      eventToProvenanceLine({
        type: 'ownership',
        artwork_ref: 0,
        party: 'Jane Doe',
        venue: 'New York',
        date: '1990',
        price: null,
        currency: null,
        notes: null,
      }),
    ).toBe('Jane Doe, New York (1990)');
  });
});

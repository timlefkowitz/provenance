import { describe, expect, it } from 'vitest';
import { MAX_CHECKLIST_ARTWORKS, normalizeChecklist } from './checklist-parsing';

describe('normalizeChecklist', () => {
  it('maps model output to checklist rows', () => {
    const result = normalizeChecklist({
      exhibition_title: '  Summer   Light ',
      start_date: '2026-06-01',
      end_date: 'June 30',
      location: 'Gallery X, NYC',
      artworks: [
        { artist_name: 'Ana Ruiz', title: 'Untitled #3', price: '$4,500', dimensions: '30 x 40 in' },
        { artist_name: null, title: 'Dusk', price: null, dimensions: null },
      ],
    });

    expect(result).toEqual({
      exhibitionTitle: 'Summer Light',
      startDate: '2026-06-01',
      endDate: '',
      location: 'Gallery X, NYC',
      artworks: [
        { artistName: 'Ana Ruiz', title: 'Untitled #3', price: '$4,500', dimensions: '30 x 40 in' },
        { artistName: '', title: 'Dusk', price: '', dimensions: '' },
      ],
    });
  });

  it('drops rows without a title and tolerates junk input', () => {
    expect(normalizeChecklist(null).artworks).toEqual([]);
    expect(normalizeChecklist({ artworks: 'nope' }).artworks).toEqual([]);
    expect(
      normalizeChecklist({ artworks: [{ artist_name: 'A' }, null, { title: 'Kept', price: 1200 }] }).artworks,
    ).toEqual([{ artistName: '', title: 'Kept', price: '1200', dimensions: '' }]);
  });

  it('caps the number of rows', () => {
    const artworks = Array.from({ length: MAX_CHECKLIST_ARTWORKS + 5 }, (_, i) => ({ title: `W${i}` }));
    expect(normalizeChecklist({ artworks }).artworks).toHaveLength(MAX_CHECKLIST_ARTWORKS);
  });
});

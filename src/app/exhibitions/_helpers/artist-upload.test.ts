import { describe, expect, it } from 'vitest';
import {
  artistUploadNotificationCopy,
  MAX_ARTIST_UPLOAD_ITEMS,
  parseArtistUploadItems,
  yearToCreationDate,
} from './artist-upload';

describe('parseArtistUploadItems', () => {
  it('rejects malformed payloads', () => {
    expect(parseArtistUploadItems('not json')).toEqual({ error: 'Invalid upload data.' });
    expect(parseArtistUploadItems('{"a":1}')).toEqual({ error: 'Invalid upload data.' });
  });

  it('drops untitled rows and trims fields', () => {
    const result = parseArtistUploadItems(
      JSON.stringify([
        { key: 'a', title: '  Night Field ', medium: ' Oil ', year: '2024', dimensions: '' },
        { key: 'b', title: '   ' },
      ]),
    );
    expect(result).toEqual([
      {
        key: 'a',
        title: 'Night Field',
        medium: 'Oil',
        year: '2024',
        dimensions: null,
        price: null,
      },
    ]);
  });

  it('requires at least one titled work and caps the batch', () => {
    expect(parseArtistUploadItems('[]')).toEqual({
      error: 'Add at least one artwork with a title.',
    });
    const tooMany = Array.from({ length: MAX_ARTIST_UPLOAD_ITEMS + 1 }, (_, i) => ({
      key: String(i),
      title: `Work ${i}`,
    }));
    expect(parseArtistUploadItems(JSON.stringify(tooMany))).toHaveProperty('error');
  });
});

describe('artistUploadNotificationCopy', () => {
  it('names a single work', () => {
    expect(
      artistUploadNotificationCopy({
        organiserName: 'North Gallery',
        exhibitionTitle: 'Spring',
        titles: ['Night Field'],
        issuedCertificateOfShow: true,
      }),
    ).toEqual({
      title: 'Added to "Spring"',
      message:
        'North Gallery added "Night Field" to the exhibition "Spring" and issued a Certificate of Show crediting you.',
    });
  });

  it('summarises several works without a certificate', () => {
    const copy = artistUploadNotificationCopy({
      organiserName: 'Ana',
      exhibitionTitle: 'Spring',
      titles: ['A', 'B', 'C'],
      issuedCertificateOfShow: false,
    });
    expect(copy.title).toBe('3 works added to "Spring"');
    expect(copy.message).toBe('Ana added "A" and 2 more to the exhibition "Spring".');
  });
});

describe('yearToCreationDate', () => {
  it('turns a year into a date and drops free text', () => {
    expect(yearToCreationDate('2024')).toBe('2024-01-01');
    expect(yearToCreationDate('2019-06-02')).toBe('2019-06-02');
    expect(yearToCreationDate('c. 1990')).toBeNull();
    expect(yearToCreationDate(null)).toBeNull();
  });
});

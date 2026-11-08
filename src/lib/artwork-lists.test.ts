import { describe, expect, it } from 'vitest';

import {
  MAX_LIST_BATCH,
  MAX_LIST_NAME_LENGTH,
  cleanArtworkIds,
  isMissingInfo,
  isValidListId,
  normalizeListName,
} from './artwork-lists';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('normalizeListName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeListName('  To   print \n')).toBe('To print');
  });

  it('rejects empty and non-string names', () => {
    expect(normalizeListName('   ')).toBeNull();
    expect(normalizeListName(undefined)).toBeNull();
    expect(normalizeListName(42)).toBeNull();
  });

  it('caps the length', () => {
    expect(normalizeListName('x'.repeat(200))).toHaveLength(MAX_LIST_NAME_LENGTH);
  });
});

describe('cleanArtworkIds', () => {
  it('dedupes (case-insensitively) and drops non-uuids', () => {
    expect(cleanArtworkIds([A, A.toUpperCase(), 'nope', 3, B])).toEqual([A, B]);
  });

  it('returns [] for non-arrays', () => {
    expect(cleanArtworkIds('abc')).toEqual([]);
  });

  it('caps the batch size', () => {
    const many = Array.from({ length: MAX_LIST_BATCH + 50 }, (_, i) =>
      `00000000-0000-4000-8000-${i.toString().padStart(12, '0')}`,
    );
    expect(cleanArtworkIds(many)).toHaveLength(MAX_LIST_BATCH);
  });
});

describe('isValidListId', () => {
  it('accepts uuids only', () => {
    expect(isValidListId(A)).toBe(true);
    expect(isValidListId('1; drop table')).toBe(false);
  });
});

describe('isMissingInfo', () => {
  it('flags null or empty title', () => {
    expect(isMissingInfo({ title: null, artist_name: 'Rothko' })).toBe(true);
    expect(isMissingInfo({ title: '  ', artist_name: 'Rothko' })).toBe(true);
  });

  it('flags placeholder titles', () => {
    expect(isMissingInfo({ title: 'Untitled', artist_name: 'Rothko' })).toBe(true);
  });

  it('flags missing artist', () => {
    expect(isMissingInfo({ title: 'No. 61', artist_name: '' })).toBe(true);
    expect(isMissingInfo({ title: 'No. 61' })).toBe(true);
  });

  it('passes complete works', () => {
    expect(isMissingInfo({ title: 'No. 61', artist_name: 'Rothko' })).toBe(false);
  });
});

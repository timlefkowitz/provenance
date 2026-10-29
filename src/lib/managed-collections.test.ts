import { describe, expect, it } from 'vitest';

import { collectionOwnerName, isManagedCollectionOf } from './managed-collections';

const CREATOR = 'user-creator';

describe('isManagedCollectionOf', () => {
  const managed = { user_id: CREATOR, role: 'collector', is_claimed: false, is_active: true };

  it('accepts an unclaimed collector profile the user created', () => {
    expect(isManagedCollectionOf(managed, CREATOR)).toBe(true);
  });

  it('rejects another user', () => {
    expect(isManagedCollectionOf(managed, 'someone-else')).toBe(false);
  });

  it("rejects the user's own claimed collector profile", () => {
    expect(isManagedCollectionOf({ ...managed, is_claimed: true }, CREATOR)).toBe(false);
  });

  it('rejects non-collector profiles', () => {
    expect(isManagedCollectionOf({ ...managed, role: 'gallery' }, CREATOR)).toBe(false);
    expect(isManagedCollectionOf({ ...managed, role: 'artist' }, CREATOR)).toBe(false);
  });

  it('rejects inactive profiles', () => {
    expect(isManagedCollectionOf({ ...managed, is_active: false }, CREATOR)).toBe(false);
  });

  it('rejects missing profiles or users', () => {
    expect(isManagedCollectionOf(null, CREATOR)).toBe(false);
    expect(isManagedCollectionOf(undefined, CREATOR)).toBe(false);
    expect(isManagedCollectionOf(managed, '')).toBe(false);
  });
});

describe('collectionOwnerName', () => {
  it('prefers the managed owner name', () => {
    expect(collectionOwnerName({ name: 'Renamed', managed_for_name: 'Hartley Family' })).toBe('Hartley Family');
  });

  it('falls back to the profile name', () => {
    expect(collectionOwnerName({ name: 'Jane Doe', managed_for_name: null })).toBe('Jane Doe');
    expect(collectionOwnerName({ name: 'Jane Doe', managed_for_name: '  ' })).toBe('Jane Doe');
  });

  it('returns null when there is no name', () => {
    expect(collectionOwnerName(null)).toBeNull();
    expect(collectionOwnerName({ name: '' })).toBeNull();
  });
});

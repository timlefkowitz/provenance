import { describe, expect, it } from 'vitest';

import { houseAccountIds, isHouseAccount } from './house-accounts';

describe('house accounts', () => {
  it('always includes the company account (Provenance and FL!GHT galleries)', () => {
    expect(isHouseAccount('28f3c8e1-2d0f-4b3d-8902-77f9453a83f1', houseAccountIds(''))).toBe(true);
  });

  it('adds ids from the env var and ignores blanks', () => {
    const ids = houseAccountIds(' a , ,b');
    expect(isHouseAccount('a', ids)).toBe(true);
    expect(isHouseAccount('b', ids)).toBe(true);
    expect(isHouseAccount('c', ids)).toBe(false);
    expect(isHouseAccount(null, ids)).toBe(false);
  });
});

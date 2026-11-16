import { describe, expect, it } from 'vitest';

import { mergePeople, type AccountRow, type ProfileRow } from './search-people';
import { normalizePersonName } from './types';

const acct = (id: string, name: string, role: string | null): AccountRow => ({
  id,
  name,
  picture_url: null,
  public_data: role ? { role } : {},
});

const prof = (
  id: string,
  name: string,
  role: string,
  user_id: string | null,
  is_claimed = true,
): ProfileRow => ({ id, user_id, name, picture_url: null, location: null, role, is_claimed });

const base = { includeUnclaimed: true, excludeIds: new Set<string>(), query: 'jane', limit: 10 };

describe('mergePeople', () => {
  it('attaches the matching profile to its account', () => {
    const out = mergePeople(
      [acct('a1', 'Jane Doe', 'artist')],
      [prof('p1', 'Jane Doe', 'artist', 'a1')],
      { ...base, role: 'artist' },
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ accountId: 'a1', profileId: 'p1', claimed: true });
  });

  it('returns placeholder profiles only when asked', () => {
    const rows = [prof('p2', 'Jane Roe', 'artist', null, false)];
    expect(mergePeople([], rows, { ...base, role: 'artist' })).toHaveLength(1);
    expect(
      mergePeople([], rows, { ...base, role: 'artist', includeUnclaimed: false }),
    ).toHaveLength(0);
  });

  it('treats managed drafts (user_id = builder, unclaimed) as placeholders, not the builder', () => {
    const out = mergePeople(
      [acct('g1', 'Gallery Jane', 'gallery')],
      [prof('p3', 'Jane Collector', 'collector', 'g1', false)],
      { ...base, role: 'collector' },
    );
    expect(out).toEqual([
      expect.objectContaining({ accountId: null, profileId: 'p3', claimed: false }),
    ]);
  });

  it('finds a multi-role user under the searched role', () => {
    const out = mergePeople(
      [acct('a1', 'Jane Doe', 'collector')],
      [prof('p1', 'Jane Doe', 'artist', 'a1')],
      { ...base, role: 'artist' },
    );
    expect(out[0]).toMatchObject({ accountId: 'a1', profileId: 'p1', role: 'artist' });
  });

  it('filters by role, excluded ids and de-dupes placeholders by name', () => {
    const out = mergePeople(
      [acct('a1', 'Jane A', 'collector'), acct('a2', 'Jane B', 'artist')],
      [
        prof('p1', 'Jane  X', 'artist', null, false),
        prof('p2', 'jane x', 'artist', null, false),
      ],
      { ...base, role: 'artist', excludeIds: new Set(['a2']) },
    );
    expect(out.map((p) => p.key)).toEqual(['profile:p1']);
  });

  it('ranks exact matches first and real accounts before placeholders', () => {
    const out = mergePeople(
      [acct('a1', 'Janet Smith', 'artist'), acct('a2', 'Jane', 'artist')],
      [prof('p1', 'Jane', 'artist', null, false)],
      { ...base, role: 'artist' },
    );
    expect(out.map((p) => p.key)).toEqual(['account:a2', 'profile:p1', 'account:a1']);
  });
});

describe('normalizePersonName', () => {
  it('ignores case and extra spaces', () => {
    expect(normalizePersonName('  Jane   DOE ')).toBe('jane doe');
  });
});

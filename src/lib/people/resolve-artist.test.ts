import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it } from 'vitest';

import { resolveArtist } from './resolve-artist';

type Row = Record<string, unknown>;

/** Just enough of the Supabase query builder for resolveArtist. */
function fakeDb(tables: Record<string, Row[]>) {
  let seq = 0;
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    let filters: ((r: Row) => boolean)[] = [];
    let limit = Infinity;
    let pendingInsert: Row | null = null;
    const run = () => {
      if (pendingInsert) return [pendingInsert];
      return rows.filter((r) => filters.every((f) => f(r))).slice(0, limit);
    };
    const builder = {
      select: () => builder,
      eq: (col: string, val: unknown) => ((filters = [...filters, (r) => r[col] === val]), builder),
      is: (col: string, val: unknown) => ((filters = [...filters, (r) => (r[col] ?? null) === val]), builder),
      ilike: (col: string, pattern: string) => {
        const plain = pattern.replace(/\\(.)/g, '$1').toLowerCase();
        filters = [...filters, (r) => String(r[col] ?? '').toLowerCase() === plain];
        return builder;
      },
      order: () => builder,
      limit: (n: number) => ((limit = n), builder),
      insert: (row: Row) => {
        pendingInsert = { id: `new-${++seq}`, ...row };
        rows.push(pendingInsert);
        return builder;
      },
      maybeSingle: async () => ({ data: run()[0] ?? null, error: null }),
      single: async () => ({ data: run()[0] ?? null, error: run()[0] ? null : { message: 'none' } }),
      then: (resolve: (v: unknown) => void) => resolve({ data: run(), error: null }),
    };
    return builder;
  };
  return { from } as unknown as SupabaseClient;
}

const A1 = '11111111-1111-1111-1111-111111111111';
const COLLECTOR = '22222222-2222-2222-2222-222222222222';
const POSTER = '33333333-3333-3333-3333-333333333333';

let tables: Record<string, Row[]>;
beforeEach(() => {
  tables = {
    accounts: [
      { id: A1, name: 'Jane Doe', public_data: { role: 'artist' } },
      { id: COLLECTOR, name: 'Carl Collector', public_data: { role: 'collector' } },
    ],
    user_profiles: [
      { id: 'p-jane', user_id: A1, name: 'Jane Doe', role: 'artist', is_active: true, is_claimed: true },
      { id: 'p-ph', user_id: null, name: 'Sam Placeholder', role: 'artist', is_active: true, is_claimed: false },
      { id: 'p-coll', user_id: COLLECTOR, name: 'Carl', role: 'collector', is_active: true, is_claimed: true },
    ],
  };
});

const run = (artist: Parameters<typeof resolveArtist>[1]['artist']) =>
  resolveArtist(fakeDb(tables), { artist, posterAccountId: POSTER });

describe('resolveArtist', () => {
  it('links a picked artist account and its claimed profile', async () => {
    expect(await run({ accountId: A1, name: 'whatever' })).toEqual({
      name: 'Jane Doe',
      artistAccountId: A1,
      artistProfileId: 'p-jane',
      created: false,
    });
  });

  it('links a picked placeholder profile without an account', async () => {
    expect(await run({ profileId: 'p-ph', name: 'Sam Placeholder' })).toMatchObject({
      artistAccountId: null,
      artistProfileId: 'p-ph',
      created: false,
    });
  });

  it('rejects a forged id that is not an artist and falls back to the name', async () => {
    const out = await run({ accountId: COLLECTOR, name: 'New Person' });
    expect(out.artistAccountId).toBeNull();
    expect(out.created).toBe(true);
  });

  it('reuses a placeholder with the same name, ignoring case and spaces', async () => {
    const out = await run({ name: '  sam   PLACEHOLDER ', isNew: true });
    expect(out).toMatchObject({ artistProfileId: 'p-ph', created: false });
  });

  it('creates one placeholder for a new name, then reuses it', async () => {
    const first = await run({ name: 'Brand New', isNew: true });
    const second = await run({ name: 'brand new', isNew: true });
    expect(first.created).toBe(true);
    expect(second).toMatchObject({ artistProfileId: first.artistProfileId, created: false });
    const created = tables.user_profiles.find((p) => p.id === first.artistProfileId);
    expect(created).toMatchObject({ user_id: null, is_claimed: false, created_by_gallery_id: POSTER });
  });

  it('plain text links a unique registered artist by name', async () => {
    expect(await run({ name: 'jane doe' })).toMatchObject({ artistAccountId: A1, artistProfileId: 'p-jane' });
  });

  it('"add as new" never attaches to a registered account by name', async () => {
    const out = await run({ name: 'Jane Doe', isNew: true });
    expect(out.artistAccountId).toBeNull();
    expect(out.created).toBe(true);
  });

  it('returns nothing for an empty artist', async () => {
    expect(await run(null)).toMatchObject({ artistAccountId: null, artistProfileId: null });
  });
});

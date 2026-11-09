import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/notifications', () => ({ createNotification: vi.fn(async () => undefined) }));
vi.mock('~/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import {
  appendLineIfMissing,
  computeOwnershipTransfer,
  describeChangedFields,
  removeOwnerLine,
  syncProvenanceAcrossChain,
  transferOwnershipAcrossChain,
} from './chain';

type Row = Record<string, unknown> & { id: string };

/** Minimal stand-in for the Supabase query builder over in-memory tables. */
function fakeDb(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'update' | 'insert' = 'select';
    let patch: Record<string, unknown> = {};
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => (filters.push((r) => r[col] === val), q),
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), q),
      update: (p: Record<string, unknown>) => ((op = 'update'), (patch = p), q),
      insert: (r: Row | Row[]) => {
        rows.push(...(Array.isArray(r) ? r : [r]).map((x) => ({ ...x, id: x.id ?? `ev${rows.length}` })));
        return Promise.resolve({ data: null, error: null });
      },
      maybeSingle: () => Promise.resolve({ data: rows.find((r) => filters.every((f) => f(r))) ?? null, error: null }),
      then: (resolve: (v: unknown) => void) => {
        const matched = rows.filter((r) => filters.every((f) => f(r)));
        if (op === 'update') matched.forEach((r) => Object.assign(r, patch));
        resolve({ data: matched, error: null });
      },
    };
    void op;
    return q;
  };
  return { from } as never;
}

describe('ownership text helpers', () => {
  it('moves the previous owner into former owners and sets the new owner', () => {
    expect(
      computeOwnershipTransfer({ owned_by: 'Flight Gallery', former_owners: 'Ann (2020)' }, 'Jane Doe', '2026-11-07'),
    ).toEqual({ owned_by: 'Jane Doe', former_owners: 'Ann (2020)\nFlight Gallery (until 2026-11-07)' });
  });

  it("removes the buyer's own line that the old code put in former owners", () => {
    expect(
      computeOwnershipTransfer(
        { owned_by: 'Flight Gallery', former_owners: 'Jane Doe (2026-10-01)' },
        'Jane Doe',
        '2026-11-07',
      ),
    ).toEqual({ owned_by: 'Jane Doe', former_owners: 'Flight Gallery (until 2026-11-07)' });
  });

  it('is a no-op when the owner is unchanged (case-insensitive)', () => {
    expect(computeOwnershipTransfer({ owned_by: 'jane doe', former_owners: null }, 'Jane Doe', '2026-11-07')).toEqual({
      owned_by: 'jane doe',
      former_owners: null,
    });
  });

  it('keeps a fuller owner name that already includes the new owner', () => {
    expect(
      computeOwnershipTransfer(
        { owned_by: 'Monica and Papillon Romero', former_owners: 'Papillon Romero (2026-10-12)' },
        'Papillon Romero',
        '2026-11-07',
      ),
    ).toEqual({ owned_by: 'Monica and Papillon Romero', former_owners: null });
  });

  it('appendLineIfMissing / removeOwnerLine', () => {
    expect(appendLineIfMissing('A\nB', 'b')).toBe('A\nB');
    expect(appendLineIfMissing('', 'C')).toBe('C');
    expect(removeOwnerLine('A (2020)\nB, 2021\nC', 'b')).toBe('A (2020)\nC');
    expect(removeOwnerLine('B (2020)', 'B')).toBeNull();
  });
});

describe('syncProvenanceAcrossChain', () => {
  function chainTables(): Record<string, Row[]> {
    return {
      artworks: [
        { id: 'coa', source_artwork_id: null, certificate_type: 'authenticity', account_id: 'artist', owned_by: 'Flight Gallery', former_owners: null, provenance_history: [] },
        { id: 'cos', source_artwork_id: 'coa', certificate_type: 'show', account_id: 'gallery', owned_by: 'Flight Gallery', former_owners: null, provenance_history: [] },
        { id: 'coo', source_artwork_id: 'cos', certificate_type: 'ownership', account_id: 'buyer', owned_by: 'Flight Gallery', former_owners: null, provenance_history: [] },
        { id: 'unrelated', source_artwork_id: null, certificate_type: 'authenticity', account_id: 'x', owned_by: 'Someone', former_owners: null, provenance_history: [] },
      ],
      provenance_events: [],
      accounts: [],
    };
  }

  it('writes every other certificate in the chain and tags the change', async () => {
    const tables = chainTables();
    const res = await syncProvenanceAcrossChain(fakeDb(tables), {
      originArtworkId: 'coa',
      fields: { exhibition_history: 'Flight, 2026' },
      method: 'edit',
      actorAccountId: 'artist',
      actorName: 'The Artist',
    });
    expect(res.syncedIds.sort()).toEqual(['coo', 'cos']);
    const [, cos, coo, unrelated] = tables.artworks!;
    expect(cos!.exhibition_history).toBe('Flight, 2026');
    expect(coo!.exhibition_history).toBe('Flight, 2026');
    expect(unrelated!.exhibition_history).toBeUndefined();
    const entry = (coo!.provenance_history as Array<{ via: { certificate_type: string; method: string } }>)[0]!;
    expect(entry.via).toMatchObject({ certificate_type: 'authenticity', method: 'edit', artwork_id: 'coa' });
    expect(tables.provenance_events!.filter((e) => e.event_type === 'provenance_synced')).toHaveLength(2);
  });

  it('transfer sets the new owner on all certificates including the origin', async () => {
    const tables = chainTables();
    await transferOwnershipAcrossChain(fakeDb(tables), {
      originArtworkId: 'coo',
      newOwnerName: 'Jane Doe',
      method: 'ownership_accepted',
      actorAccountId: 'buyer',
      notify: false,
    });
    for (const id of ['coa', 'cos', 'coo']) {
      const row = tables.artworks!.find((r) => r.id === id)!;
      expect(row.owned_by).toBe('Jane Doe');
      expect(row.former_owners).toMatch(/^Flight Gallery \(until \d{4}-\d{2}-\d{2}\)$/);
    }
    expect(tables.artworks!.find((r) => r.id === 'unrelated')!.owned_by).toBe('Someone');
  });
});

describe('describeChangedFields', () => {
  it('names the provenance fields a sync changed, without privacy flags', () => {
    expect(describeChangedFields(['owned_by', 'former_owners', 'owned_by_is_public'])).toBe('owner and former owners');
    expect(describeChangedFields(['exhibition_history'])).toBe('exhibition history');
    expect(describeChangedFields(['owned_by_is_public'])).toBe('provenance');
  });
});

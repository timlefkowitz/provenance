import { describe, expect, it, vi } from 'vitest';

vi.mock('~/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { loadChainCertificates } from './load-chain-certificates';

type Row = Record<string, unknown> & { id: string };

function fakeDb(tables: Record<string, Row[]>) {
  const from = (table: string) => {
    const rows = tables[table] ?? [];
    const filters: Array<(r: Row) => boolean> = [];
    const q = {
      select: () => q,
      in: (col: string, vals: unknown[]) => (filters.push((r) => vals.includes(r[col])), q),
      then: (resolve: (v: unknown) => void) =>
        resolve({ data: rows.filter((r) => filters.every((f) => f(r))), error: null }),
    };
    return q;
  };
  return { from } as never;
}

const db = fakeDb({
  artworks: [
    { id: 'coo', certificate_type: 'ownership', certificate_number: 3, status: 'verified', created_at: '2026-03-01', account_id: 'collector', gallery_profile_id: null },
    { id: 'cos', certificate_type: 'show', certificate_number: 2, status: 'verified', created_at: '2026-02-01', account_id: 'owner', gallery_profile_id: 'gallery' },
    { id: 'coa', certificate_type: 'authenticity', certificate_number: 1, status: 'verified', created_at: '2026-01-01', account_id: 'artist', gallery_profile_id: null },
    { id: 'void', certificate_type: 'ownership', certificate_number: 4, status: 'voided', created_at: '2026-04-01', account_id: 'collector', gallery_profile_id: null },
    { id: 'draft', certificate_type: 'show', certificate_number: 5, status: 'draft', created_at: '2026-05-01', account_id: 'owner', gallery_profile_id: null },
  ],
  user_profiles: [{ id: 'gallery', name: 'Flight Gallery', managed_for_name: null }],
  accounts: [
    { id: 'artist', name: 'Ann Artist' },
    { id: 'collector', name: 'Jane Doe' },
    { id: 'owner', name: 'Tim' },
  ],
});
const ALL = ['coo', 'cos', 'coa', 'void', 'draft'];

describe('loadChainCertificates', () => {
  it('lists verified certificates CoA → CoS → CoO with issuers, flagging the current one', async () => {
    const certs = await loadChainCertificates(db, ALL, 'cos');
    expect(certs.map((c) => [c.id, c.issuerName, c.isCurrent])).toEqual([
      ['coa', 'Ann Artist', false],
      ['cos', 'Flight Gallery', true],
      ['coo', 'Jane Doe', false],
    ]);
    expect(certs[0]!.certificateNumber).toBe('1');
  });

  it('keeps the certificate being viewed even when it is not verified', async () => {
    const certs = await loadChainCertificates(db, ALL, 'draft');
    expect(certs.map((c) => c.id)).toEqual(['coa', 'cos', 'draft', 'coo']);
  });

  it('returns nothing for an empty chain', async () => {
    expect(await loadChainCertificates(db, [], 'coa')).toEqual([]);
  });
});

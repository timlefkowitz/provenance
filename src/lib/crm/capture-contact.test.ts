import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { error: { code?: string; message: string } | null };

const state = vi.hoisted(() => ({
  existing: null as Row | null,
  insertResults: [] as Result[],
  inserts: [] as Row[],
  updates: [] as Row[],
  updateResults: [] as Result[],
}));

vi.mock('@kit/supabase/server-client', () => ({
  getSupabaseServerClient: () => ({
    from: () => {
      // Every lookup filter returns the same chain; the lookup resolves to `existing`.
      const chain: Record<string, unknown> = {};
      for (const m of ['eq', 'ilike', 'is', 'limit']) chain[m] = () => chain;
      chain.maybeSingle = async () => ({ data: state.existing, error: null });
      return {
        select: () => chain,
        insert: async (row: Row) => {
          state.inserts.push(row);
          return state.insertResults.shift() ?? { error: null };
        },
        update: (patch: Row) => {
          state.updates.push(patch);
          const result = state.updateResults.shift() ?? { error: null };
          return { eq: () => ({ eq: async () => result }) };
        },
      };
    },
  }),
}));

vi.mock('./owner', () => ({ resolveArtistUserId: async () => 'artist-1' }));

import { captureCrmContacts } from './capture-contact';

const FK_ERROR: Result = { error: { code: '23503', message: 'fk violation' } };

beforeEach(() => {
  state.existing = null;
  state.insertResults = [];
  state.inserts = [];
  state.updates = [];
  state.updateResults = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('captureCrmContacts artwork link', () => {
  it('stores the artwork on a new contact', async () => {
    await captureCrmContacts('u1', [{ email: 'Buyer@Example.com', source: 'sale', artworkId: 'art-1' }]);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({ contact_email: 'buyer@example.com', source: 'sale', artwork_id: 'art-1' });
  });

  it('saves the contact without the link when the artwork id is rejected', async () => {
    state.insertResults = [FK_ERROR];
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'gone' }]);
    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0].artwork_id).toBe('gone');
    expect(state.inserts[1]).not.toHaveProperty('artwork_id');
    expect(state.inserts[1]).toMatchObject({ contact_email: 'a@b.co' });
  });

  it('adds a link to an existing contact that has none', async () => {
    state.existing = { id: 'lead-1', contact_name: 'A', contact_email: 'a@b.co', contact_phone: null, notes: null, source: 'sale', artwork_id: null };
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-2' }]);
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ artwork_id: 'art-2' });
  });

  it('never overwrites an existing artwork link', async () => {
    state.existing = { id: 'lead-1', contact_name: 'A', contact_email: 'a@b.co', contact_phone: null, notes: null, source: 'sale', artwork_id: 'art-1' };
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-2' }]);
    expect(state.updates).toHaveLength(0);
  });

  it('still applies other updates when the artwork id is rejected on update', async () => {
    state.existing = { id: 'lead-1', contact_name: null, contact_email: 'a@b.co', contact_phone: null, notes: null, source: 'sale', artwork_id: null };
    state.updateResults = [FK_ERROR];
    await captureCrmContacts('u1', [{ email: 'a@b.co', name: 'Ada', source: 'sale', artworkId: 'gone' }]);
    expect(state.updates).toHaveLength(2);
    expect(state.updates[0]).toMatchObject({ contact_name: 'Ada', artwork_id: 'gone' });
    expect(state.updates[1]).toMatchObject({ contact_name: 'Ada' });
    expect(state.updates[1]).not.toHaveProperty('artwork_id');
  });

  it('works unchanged for callers that pass no artwork', async () => {
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'invoice' }]);
    expect(state.inserts[0]).toMatchObject({ contact_email: 'a@b.co', artwork_id: null });
  });
});

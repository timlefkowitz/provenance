import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = Record<string, unknown>;
type Result = { error: { code?: string; message: string } | null };

const state = vi.hoisted(() => ({
  sessionClientCalls: 0,
  existing: null as Row | null,
  insertResults: [] as Result[],
  inserts: [] as Row[],
  updates: [] as Row[],
  updateResults: [] as Result[],
  newLeadId: 'lead-new',
  linkResults: [] as Result[],
  links: [] as Row[][],
}));

const makeClient = vi.hoisted(() => () => ({
  from: (table: string) => {
    if (table === 'artist_lead_artworks') {
      return {
        upsert: async (rows: Row[]) => {
          state.links.push(rows);
          return state.linkResults.shift() ?? { error: null };
        },
      };
    }
    // artist_leads: every lookup filter returns the same chain; the lookup resolves to `existing`.
    const chain: Record<string, unknown> = {};
    for (const m of ['eq', 'ilike', 'is', 'limit']) chain[m] = () => chain;
    chain.maybeSingle = async () => ({ data: state.existing, error: null });
    return {
      select: () => chain,
      insert: (row: Row) => {
        state.inserts.push(row);
        const result = state.insertResults.shift() ?? { error: null };
        return {
          select: () => ({
            maybeSingle: async () => ({ data: result.error ? null : { id: state.newLeadId }, error: result.error }),
          }),
        };
      },
      update: (patch: Row) => {
        state.updates.push(patch);
        const result = state.updateResults.shift() ?? { error: null };
        return { eq: () => ({ eq: async () => result }) };
      },
    };
  },
}));

vi.mock('@kit/supabase/server-client', () => ({
  getSupabaseServerClient: () => {
    state.sessionClientCalls++;
    return makeClient();
  },
}));

vi.mock('./owner', () => ({ resolveArtistUserId: async () => 'artist-1' }));

import { captureCrmContacts } from './capture-contact';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

const FK_ERROR: Result = { error: { code: '23503', message: 'fk violation' } };
const existingLead = (over: Row = {}): Row => ({
  id: 'lead-1', contact_name: 'A', contact_email: 'a@b.co', contact_phone: null, notes: null, source: 'sale', artwork_id: null, ...over,
});

beforeEach(() => {
  state.sessionClientCalls = 0;
  state.existing = null;
  state.insertResults = [];
  state.inserts = [];
  state.updates = [];
  state.updateResults = [];
  state.linkResults = [];
  state.links = [];
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('captureCrmContacts artwork link (first artwork on the lead)', () => {
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
    state.existing = existingLead();
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-2' }]);
    expect(state.inserts).toHaveLength(0);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({ artwork_id: 'art-2' });
  });

  it('never overwrites an existing artwork link', async () => {
    state.existing = existingLead({ artwork_id: 'art-1' });
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-2' }]);
    expect(state.updates).toHaveLength(0);
  });

  it('still applies other updates when the artwork id is rejected on update', async () => {
    state.existing = existingLead({ contact_name: null });
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
    expect(state.links).toHaveLength(0);
  });
});

describe('captureCrmContacts injected client', () => {
  it('uses an injected client (sessionless callers) and never opens the session client', async () => {
    const admin = makeClient() as unknown as UntypedSupabaseClient;
    await captureCrmContacts('owner-1', [{ email: 'a@b.co', source: 'site_inquiry', artworkId: 'art-1' }], { client: admin });
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]).toMatchObject({ artist_user_id: 'artist-1', artwork_id: 'art-1' });
    expect(state.sessionClientCalls).toBe(0);
  });

  it('defaults to the session client when none is injected', async () => {
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale' }]);
    expect(state.sessionClientCalls).toBe(1);
  });
});

describe('captureCrmContacts many artworks per contact', () => {
  it('links every artwork of a new contact, first one also on the lead, ids de-duplicated', async () => {
    await captureCrmContacts('u1', [
      { email: 'a@b.co', source: 'certificate', artworkIds: ['art-1', 'art-2', 'art-1', ' art-3 '] },
    ]);
    expect(state.inserts[0]).toMatchObject({ artwork_id: 'art-1' });
    expect(state.links).toHaveLength(1);
    expect(state.links[0]).toEqual([
      { lead_id: 'lead-new', artwork_id: 'art-1', source: 'certificate' },
      { lead_id: 'lead-new', artwork_id: 'art-2', source: 'certificate' },
      { lead_id: 'lead-new', artwork_id: 'art-3', source: 'certificate' },
    ]);
  });

  it('merges artworkId with artworkIds', async () => {
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-1', artworkIds: ['art-2'] }]);
    expect(state.links[0].map((r) => r.artwork_id)).toEqual(['art-1', 'art-2']);
  });

  it('adds a second artwork for a repeat buyer without touching the first', async () => {
    state.existing = existingLead({ artwork_id: 'art-1' });
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-2' }]);
    expect(state.updates).toHaveLength(0);
    expect(state.links).toEqual([[{ lead_id: 'lead-1', artwork_id: 'art-2', source: 'sale' }]]);
  });

  it('links one by one when a stale artwork id rejects the batch', async () => {
    state.linkResults = [FK_ERROR, { error: null }, FK_ERROR, { error: null }];
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkIds: ['ok-1', 'gone', 'ok-2'] }]);
    expect(state.links).toHaveLength(4); // 1 batch + 3 individual attempts
    expect(state.links.slice(1).map((r) => r[0].artwork_id)).toEqual(['ok-1', 'gone', 'ok-2']);
  });

  it('keeps the contact when the link table is unavailable', async () => {
    state.linkResults = [{ error: { code: '42P01', message: 'relation does not exist' } }];
    await captureCrmContacts('u1', [{ email: 'a@b.co', source: 'sale', artworkId: 'art-1' }]);
    expect(state.inserts).toHaveLength(1);
    expect(state.links).toHaveLength(1);
  });
});

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';
import {
  digestUnsubscribeUrls,
  getDigestOptOuts,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from './email-preferences';

const USER = '3f2b8c1e-5d4a-4b7e-9c10-2a6f8d3e1b45';
const OTHER = '9a1c7d2e-0b3f-4e58-8d6a-7c4b1e2f3a90';
const ORIGINAL = { u: process.env.UNSUBSCRIBE_SECRET, c: process.env.CRON_SECRET };

beforeEach(() => {
  delete process.env.UNSUBSCRIBE_SECRET;
  process.env.CRON_SECRET = 'test-secret';
});
afterEach(() => {
  if (ORIGINAL.u === undefined) delete process.env.UNSUBSCRIBE_SECRET; else process.env.UNSUBSCRIBE_SECRET = ORIGINAL.u;
  if (ORIGINAL.c === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = ORIGINAL.c;
});

describe('unsubscribe tokens', () => {
  it('round-trips a user id', () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(USER))).toBe(USER);
  });

  it('rejects a token with a different user id swapped in', () => {
    const sig = signUnsubscribeToken(USER).split('.')[1];
    expect(verifyUnsubscribeToken(`${OTHER}.${sig}`)).toBeNull();
  });

  it('rejects tampered, malformed and empty tokens', () => {
    const good = signUnsubscribeToken(USER);
    expect(verifyUnsubscribeToken(good.slice(0, -2) + 'xx')).toBeNull();
    expect(verifyUnsubscribeToken('garbage')).toBeNull();
    expect(verifyUnsubscribeToken(`not-a-uuid.${good.split('.')[1]}`)).toBeNull();
    expect(verifyUnsubscribeToken('')).toBeNull();
    expect(verifyUnsubscribeToken(null)).toBeNull();
  });

  it('does not verify against a different secret', () => {
    const token = signUnsubscribeToken(USER);
    process.env.CRON_SECRET = 'rotated';
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it('prefers UNSUBSCRIBE_SECRET over CRON_SECRET', () => {
    process.env.UNSUBSCRIBE_SECRET = 'dedicated';
    const token = signUnsubscribeToken(USER);
    delete process.env.UNSUBSCRIBE_SECRET;
    expect(verifyUnsubscribeToken(token)).toBeNull();
  });

  it('builds page and one-click URLs carrying the same verifiable token', () => {
    const { page, oneClick } = digestUnsubscribeUrls('https://provenance.guru/', USER);
    expect(page.startsWith('https://provenance.guru/unsubscribe/digest?token=')).toBe(true);
    expect(oneClick.startsWith('https://provenance.guru/api/unsubscribe/digest?token=')).toBe(true);
    const token = decodeURIComponent(new URL(oneClick).searchParams.get('token')!);
    expect(verifyUnsubscribeToken(token)).toBe(USER);
  });
});

function clientReturning(result: { data?: unknown; error?: { code?: string; message: string } | null }) {
  return {
    from: () => ({ select: () => ({ eq: () => ({ in: async () => ({ data: null, error: null, ...result }) }) }) }),
  } as unknown as UntypedSupabaseClient;
}

describe('getDigestOptOuts', () => {
  it('returns the opted-out ids', async () => {
    const res = await getDigestOptOuts(clientReturning({ data: [{ user_id: USER }] }), [USER, OTHER]);
    expect(res).toEqual({ ready: true, optedOut: new Set([USER]) });
  });

  it('is ready with nobody opted out when there are no recipients (no query)', async () => {
    const res = await getDigestOptOuts(clientReturning({ error: { message: 'should not be called' } }), []);
    expect(res).toEqual({ ready: true, optedOut: new Set() });
  });

  it('fails closed with a migration hint when the table is missing', async () => {
    for (const code of ['42P01', 'PGRST205']) {
      const res = await getDigestOptOuts(clientReturning({ error: { code, message: 'missing' } }), [USER]);
      expect(res.ready).toBe(false);
      expect(!res.ready && res.reason).toContain('20260921000000_email_preferences.sql');
    }
  });

  it('fails closed on any other read error', async () => {
    const res = await getDigestOptOuts(clientReturning({ error: { code: '57014', message: 'timeout' } }), [USER]);
    expect(res.ready).toBe(false);
    expect(!res.ready && res.reason).toContain('timeout');
  });
});

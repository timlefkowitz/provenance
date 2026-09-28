import { describe, expect, it } from 'vitest';
import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { cancelLocalTrial, upsertAppleSubscription } from './upsert-apple-subscription';

type Err = { message: string; code?: string } | null;

/** Minimal chainable stand-in for the supabase-js calls the helper makes. */
function fakeAdmin(opts: { existing: boolean; insertError?: Err }) {
  const calls: string[] = [];
  const admin = {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            calls.push('select');
            return { data: opts.existing ? { id: 'row-1' } : null, error: null };
          },
        }),
      }),
      insert: async () => {
        calls.push('insert');
        return { error: opts.insertError ?? null };
      },
      update: () => ({
        eq: async () => {
          calls.push('update');
          return { error: null };
        },
      }),
    }),
  } as unknown as UntypedSupabaseClient;
  return { admin, calls };
}

const row = { apple_original_transaction_id: 'tx-1', role: 'artist' };

describe('upsertAppleSubscription', () => {
  it('inserts when no row exists', async () => {
    const { admin, calls } = fakeAdmin({ existing: false });
    expect((await upsertAppleSubscription(admin, row)).error).toBeNull();
    expect(calls).toEqual(['select', 'insert']);
  });

  it('updates when the row already exists', async () => {
    const { admin, calls } = fakeAdmin({ existing: true });
    expect((await upsertAppleSubscription(admin, row)).error).toBeNull();
    expect(calls).toEqual(['select', 'update']);
  });

  it('falls back to update when a concurrent insert wins the race', async () => {
    const { admin, calls } = fakeAdmin({ existing: false, insertError: { message: 'dup', code: '23505' } });
    expect((await upsertAppleSubscription(admin, row)).error).toBeNull();
    expect(calls).toEqual(['select', 'insert', 'update']);
  });

  it('returns other insert errors', async () => {
    const { admin } = fakeAdmin({ existing: false, insertError: { message: 'boom', code: '42501' } });
    expect((await upsertAppleSubscription(admin, row)).error?.code).toBe('42501');
  });
});

describe('cancelLocalTrial', () => {
  it("cancels only the user's app-provisioned trialing rows", async () => {
    const filters: unknown[][] = [];
    let patch: Record<string, unknown> | undefined;
    const chain = {
      eq: (...args: unknown[]) => (filters.push(['eq', ...args]), chain),
      like: async (...args: unknown[]) => (filters.push(['like', ...args]), { error: null }),
    };
    const admin = {
      from: () => ({
        update: (p: Record<string, unknown>) => ((patch = p), chain),
      }),
    } as unknown as UntypedSupabaseClient;

    expect((await cancelLocalTrial(admin, 'user-1')).error).toBeNull();
    expect(patch?.status).toBe('canceled');
    expect(filters).toEqual([
      ['eq', 'user_id', 'user-1'],
      ['eq', 'status', 'trialing'],
      ['like', 'stripe_subscription_id', 'trial_%'],
    ]);
  });
});

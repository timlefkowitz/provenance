'use client';

import { useEffect, useSyncExternalStore } from 'react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';

import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';

import { type CartLine, MAX_CART_ITEMS, mergeCartLines } from './cart-types';

/**
 * The buyer's cart. Guests keep it in this browser; signed-in buyers keep it
 * in cart_items, and a guest cart is moved there when they sign in.
 */

const STORAGE_KEY = 'provenance-cart-v1';

type State = { lines: CartLine[]; userId: string | null; ready: boolean };
let state: State = { lines: [], userId: null, ready: false };
const listeners = new Set<() => void>();
const SERVER_STATE: State = { lines: [], userId: null, ready: false };

function set(next: Partial<State>) {
  state = { ...state, ...next };
  for (const l of listeners) l();
}

function readGuest(): CartLine[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as CartLine[]) : [];
    return Array.isArray(parsed) ? mergeCartLines(parsed, []) : [];
  } catch {
    return [];
  }
}

function writeGuest(lines: CartLine[]) {
  try {
    if (lines.length === 0) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private mode / blocked storage: the cart just lives for this page view.
  }
}

type Client = UntypedSupabaseClient;
let loadingFor: string | null | undefined;

async function load(client: Client, userId: string | null) {
  if (loadingFor === userId && state.ready && state.userId === userId) return;
  loadingFor = userId;
  if (!userId) {
    set({ lines: readGuest(), userId: null, ready: true });
    return;
  }
  // Move a guest cart into the account, then read the account's cart.
  const guest = readGuest();
  if (guest.length > 0) {
    const { error } = await client
      .from('cart_items')
      .upsert(
        guest.map((l) => ({ account_id: userId, artwork_id: l.artworkId, exhibition_id: l.exhibitionId })),
        { onConflict: 'account_id,artwork_id', ignoreDuplicates: true },
      );
    if (!error) writeGuest([]);
    else console.error('[Cart] failed to move guest cart into account', error);
  }
  const { data, error } = await client
    .from('cart_items')
    .select('artwork_id, exhibition_id')
    .eq('account_id', userId)
    .order('added_at', { ascending: true });
  if (error) console.error('[Cart] failed to load cart', error);
  const rows = (data ?? []) as Array<{ artwork_id: string; exhibition_id: string | null }>;
  set({
    lines: mergeCartLines(
      rows.map((r) => ({ artworkId: r.artwork_id, exhibitionId: r.exhibition_id })),
      [],
    ),
    userId,
    ready: true,
  });
}

let started = false;

/** Follow sign-in / sign-out once for the whole page and (re)load the cart. */
function ensureStarted(client: Client) {
  if (started) return;
  started = true;
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
      // Supabase warns against awaiting other calls inside this callback.
      setTimeout(() => void load(client, session?.user?.id ?? null), 0);
    }
  });
}

export function useCart() {
  const client = asUntyped(useSupabase());

  useEffect(() => {
    ensureStarted(client);
  }, [client]);

  const snapshot = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
    () => SERVER_STATE,
  );

  const userId = snapshot.userId;

  async function add(line: CartLine): Promise<{ ok: boolean; error?: string }> {
    if (snapshot.lines.some((l) => l.artworkId === line.artworkId)) return { ok: true };
    if (snapshot.lines.length >= MAX_CART_ITEMS) return { ok: false, error: 'Your cart is full.' };
    const next = mergeCartLines(snapshot.lines, [line]);
    set({ lines: next });
    if (!userId) {
      writeGuest(next);
      return { ok: true };
    }
    const { error } = await client
      .from('cart_items')
      .upsert(
        { account_id: userId, artwork_id: line.artworkId, exhibition_id: line.exhibitionId },
        { onConflict: 'account_id,artwork_id', ignoreDuplicates: true },
      );
    if (error) {
      console.error('[Cart] add failed', error);
      set({ lines: snapshot.lines });
      return { ok: false, error: 'Could not add to your cart.' };
    }
    return { ok: true };
  }

  async function remove(artworkIds: string | string[]): Promise<void> {
    const ids = new Set(Array.isArray(artworkIds) ? artworkIds : [artworkIds]);
    const next = state.lines.filter((l) => !ids.has(l.artworkId));
    set({ lines: next });
    if (!userId) {
      writeGuest(next);
      return;
    }
    const { error } = await client
      .from('cart_items')
      .delete()
      .eq('account_id', userId)
      .in('artwork_id', [...ids]);
    if (error) console.error('[Cart] remove failed', error);
  }

  /** Re-read the cart (e.g. after a purchase emptied it server-side). */
  async function refresh(): Promise<void> {
    loadingFor = undefined;
    set({ ready: false });
    await load(client, userId);
  }

  return {
    lines: snapshot.lines,
    count: snapshot.lines.length,
    ready: snapshot.ready,
    has: (artworkId: string) => snapshot.lines.some((l) => l.artworkId === artworkId),
    add,
    remove,
    refresh,
  };
}

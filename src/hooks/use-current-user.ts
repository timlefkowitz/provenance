'use client';

import type { JwtPayload } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';
import { useSupabase } from '@kit/supabase/hooks/use-supabase';

/**
 * Current user hook that does not depend on React Query.
 * Use in layout/shell components to avoid "No QueryClient set" when running
 * locally (monorepo can resolve a different @tanstack/react-query instance
 * for @kit/supabase than the app's QueryClientProvider). Production/Vercel
 * often works because the build deduplicates to a single instance.
 *
 * When `initialData` is passed (not `undefined`), `data` follows that prop so
 * parents can be the single source of truth. When omitted, claims are fetched.
 *
 * Returns a shape compatible with the kit's useUser: { data, isPending, error }.
 */
export function useCurrentUser(initialData?: JwtPayload | null) {
  const client = useSupabase();
  const [fetchedData, setFetchedData] = useState<JwtPayload | undefined | null>(
    undefined,
  );
  const [fetchPending, setFetchPending] = useState(initialData === undefined);
  const [error, setError] = useState<Error | null>(null);

  const fetchClaims = useCallback(async () => {
    const response = await client.auth.getClaims();
    if (response.error) {
      setFetchedData(undefined);
      setError(response.error);
      return;
    }
    if (response.data?.claims) {
      setFetchedData(response.data.claims);
      setError(null);
    } else {
      setFetchedData(undefined);
      setError(new Error('Unexpected result format'));
    }
  }, [client]);

  const data =
    initialData !== undefined ? (initialData ?? undefined) : fetchedData;

  const isPending =
    initialData !== undefined ? false : fetchPending;

  useEffect(() => {
    if (initialData !== undefined) {
      return;
    }
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setError(null);
      setFetchPending(true);
      fetchClaims()
        .then(() => {
          if (!cancelled) setFetchPending(false);
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
            setFetchPending(false);
          }
        });
    });
    return () => {
      cancelled = true;
    };
  }, [initialData, fetchClaims]);

  useEffect(() => {
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(() => {
      fetchClaims();
    });
    return () => subscription.unsubscribe();
  }, [client, fetchClaims]);

  return { data, isPending, error, refetch: fetchClaims };
}

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
 * Returns a shape compatible with the kit's useUser: { data, isPending, error }.
 */
export function useCurrentUser(initialData?: JwtPayload | null) {
  const client = useSupabase();
  const [data, setData] = useState<JwtPayload | undefined | null>(
    () => initialData ?? undefined
  );
  const [isPending, setIsPending] = useState(!initialData);
  const [error, setError] = useState<Error | null>(null);

  const fetchClaims = useCallback(async () => {
    console.log('[Auth] useCurrentUser fetch started');
    console.log('[Auth] Calling Supabase auth.getClaims');
    const claimsResponse = await client.auth.getClaims();

    if (claimsResponse.data?.claims) {
      console.log('[Auth] useCurrentUser resolved from claims');
      setData(claimsResponse.data.claims);
      setError(null);
      return;
    }

    if (claimsResponse.error) {
      console.error(
        '[Auth] auth.getClaims failed, falling back to auth.getUser',
        claimsResponse.error,
      );
    }

    console.log('[Auth] Calling Supabase auth.getUser fallback');
    const userResponse = await client.auth.getUser();

    if (userResponse.error) {
      console.error('[Auth] auth.getUser fallback failed', userResponse.error);
      setData(undefined);
      setError(userResponse.error);
      return;
    }

    if (!userResponse.data.user) {
      console.log('[Auth] No authenticated user found');
      setData(undefined);
      setError(null);
      return;
    }

    const jwtLikeUser = {
      ...userResponse.data.user,
      sub: userResponse.data.user.id,
    } as unknown as JwtPayload;

    console.log('[Auth] useCurrentUser resolved from getUser fallback');
    setData(jwtLikeUser);
    setError(null);
  }, [client]);

  useEffect(() => {
    if (initialData !== undefined) {
      setIsPending(false);
      return;
    }
    let cancelled = false;
    setError(null);
    setIsPending(true);
    fetchClaims()
      .then(() => {
        if (!cancelled) setIsPending(false);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsPending(false);
        }
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

import { useQuery } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';
import { useFactorsMutationKey } from './use-user-factors-mutation-key';

const MFA_FACTORS_TIMEOUT_MS = 10_000;

/**
 * @name useFetchAuthFactors
 * @description Use Supabase to fetch the MFA factors for a user in a React component
 * @param userId
 */
export function useFetchAuthFactors(userId: string) {
  const client = useSupabase();
  const queryKey = useFactorsMutationKey(userId);

  const queryFn = async () => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('MFA factors request timed out')), MFA_FACTORS_TIMEOUT_MS);
    });
    const factorsPromise = (async () => {
      const { data, error } = await client.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    })();
    return Promise.race([factorsPromise, timeoutPromise]);
  };

  return useQuery({
    queryKey,
    queryFn,
    staleTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

import type { SignInWithOAuthCredentials } from '@supabase/supabase-js';

import { useMutation } from '@tanstack/react-query';

import { getNativeOAuthHandler } from '../native-oauth';
import { useSupabase } from './use-supabase';

/**
 * @name useSignInWithProvider
 * @description Use Supabase to sign in a user with a provider in a React component
 */
export function useSignInWithProvider() {
  const client = useSupabase();
  const mutationKey = ['auth', 'sign-in-with-provider'];

  const mutationFn = async (credentials: SignInWithOAuthCredentials) => {
    const nativeHandler = getNativeOAuthHandler();

    if (nativeHandler && (await nativeHandler(client, credentials))) {
      return { provider: credentials.provider, url: null };
    }

    const response = await client.auth.signInWithOAuth(credentials);

    if (response.error) {
      throw response.error.message;
    }

    return response.data;
  };

  return useMutation({
    mutationFn,
    mutationKey,
  });
}

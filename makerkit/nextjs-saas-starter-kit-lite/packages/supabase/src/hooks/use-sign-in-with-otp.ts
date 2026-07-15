import type { SignInWithPasswordlessCredentials } from '@supabase/supabase-js';

import { useMutation } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';

/**
 * @name useSignInWithOtp
 * @description Use Supabase to sign in a user with an OTP in a React component
 */
export function useSignInWithOtp() {
  const client = useSupabase();
  const mutationKey = ['auth', 'sign-in-with-otp'];

  const mutationFn = async (credentials: SignInWithPasswordlessCredentials) => {
    const result = await client.auth.signInWithOtp(credentials);

    // Temporary diagnostic: logs the raw Supabase response so a "magic link
    // does nothing" report can be traced to an actual API error (e.g. rate
    // limit, captcha rejection, disabled provider) vs. a client-side no-op.
    console.log('[Auth] signInWithOtp result', {
      hasError: Boolean(result.error),
      errorMessage: result.error?.message,
      errorStatus: (result.error as { status?: number } | null)?.status,
    });

    if (result.error) {
      if (shouldIgnoreError(result.error.message)) {
        console.warn(
          `Ignoring error during development: ${result.error.message}`,
        );

        return {} as never;
      }

      throw result.error.message;
    }

    return result.data;
  };

  return useMutation({
    mutationFn,
    mutationKey,
  });
}

function shouldIgnoreError(error: string) {
  return isSmsProviderNotSetupError(error);
}

function isSmsProviderNotSetupError(error: string) {
  return error.includes(`sms Provider could not be found`);
}

import { useMutation } from '@tanstack/react-query';

import { useSupabase } from './use-supabase';

interface RequestPasswordResetMutationParams {
  email: string;
  redirectTo: string;
  captchaToken?: string;
}

/**
 * @name useRequestResetPassword
 * @description Requests a password reset for a user. This function will
 * trigger a password reset email to be sent to the user's email address.
 * After the user clicks the link in the email, they will be redirected to
 * /password-reset where their password can be updated.
 */
export function useRequestResetPassword() {
  const client = useSupabase();
  const mutationKey = ['auth', 'reset-password'];

  const mutationFn = async (params: RequestPasswordResetMutationParams) => {
    console.log('[Auth/PasswordReset] resetPasswordForEmail started', { redirectTo: params.redirectTo });

    const { error, data } = await client.auth.resetPasswordForEmail(
      params.email,
      {
        redirectTo: params.redirectTo,
        captchaToken: params.captchaToken,
      },
    );

    if (error) {
      // Anti-enumeration (ASVS V2.5.6): Supabase already returns success for
      // unknown emails at the API level, so an error here indicates a real
      // server-side problem (rate limit, misconfiguration) rather than a user
      // not found. Log it server-side but re-throw so the UI can inform the
      // user that something went wrong without revealing email existence.
      console.error('[Auth/PasswordReset] resetPasswordForEmail error', {
        message: error.message,
        status: (error as { status?: number }).status,
      });
      throw error;
    }

    console.log('[Auth/PasswordReset] resetPasswordForEmail success — email dispatched');
    return data;
  };

  return useMutation({
    mutationFn,
    mutationKey,
  });
}

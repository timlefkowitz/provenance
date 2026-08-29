'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useSignUpWithUsernamePassword } from '../_hooks/use-sign-up-with-username-password';
import { AuthErrorAlert } from '../../../../makerkit/nextjs-saas-starter-kit-lite/packages/features/auth/src/components/auth-error-alert';
import { UsernamePasswordSignUpForm } from './username-password-sign-up-form';

interface UsernamePasswordSignUpContainerProps {
  displayTermsCheckbox?: boolean;
  appHomePath: string;
  onSignUp?: (userId?: string) => unknown;
}

export function UsernamePasswordSignUpContainer({
  appHomePath,
  onSignUp,
  displayTermsCheckbox,
}: UsernamePasswordSignUpContainerProps) {
  const router = useRouter();
  const signUpMutation = useSignUpWithUsernamePassword();
  const [redirecting, setRedirecting] = useState(false);

  const loading = signUpMutation.isPending || redirecting;

  const onSignupRequested = useCallback(
    async (credentials: { username: string; password: string; repeatPassword: string }) => {
      if (loading) {
        return;
      }

      try {
        const data = await signUpMutation.mutateAsync({
          username: credentials.username,
          password: credentials.password,
        });

        if (onSignUp) {
          onSignUp(data.userId);
        }

        // The API route already established the session cookie, so we can
        // go straight to the app — there's no email to confirm.
        setRedirecting(true);
        router.refresh();
        router.push(appHomePath);
      } catch (error) {
        console.error('[UsernamePasswordSignUp] Sign up failed', error);
      }
    },
    [appHomePath, loading, onSignUp, router, signUpMutation],
  );

  return (
    <>
      <AuthErrorAlert error={signUpMutation.error} />

      <UsernamePasswordSignUpForm
        onSubmit={onSignupRequested}
        loading={loading}
        displayTermsCheckbox={displayTermsCheckbox}
      />
    </>
  );
}

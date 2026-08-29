'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { useSignInWithUsernamePassword } from '../_hooks/use-sign-in-with-username-password';
import { AuthErrorAlert } from '../../../../makerkit/nextjs-saas-starter-kit-lite/packages/features/auth/src/components/auth-error-alert';
import { UsernamePasswordSignInForm } from './username-password-sign-in-form';

interface UsernamePasswordSignInContainerProps {
  homePath: string;
}

export function UsernamePasswordSignInContainer({ homePath }: UsernamePasswordSignInContainerProps) {
  const router = useRouter();
  const signInMutation = useSignInWithUsernamePassword();
  const [redirecting, setRedirecting] = useState(false);

  const loading = signInMutation.isPending || redirecting;

  const onSignInRequested = useCallback(
    async (credentials: { username: string; password: string }) => {
      if (loading) {
        return;
      }

      try {
        await signInMutation.mutateAsync(credentials);

        setRedirecting(true);
        router.refresh();
        router.push(homePath);
      } catch (error) {
        console.error('[UsernamePasswordSignIn] Sign in failed', error);
      }
    },
    [homePath, loading, router, signInMutation],
  );

  return (
    <>
      <AuthErrorAlert error={signInMutation.error} />

      <UsernamePasswordSignInForm onSubmit={onSignInRequested} loading={loading} />
    </>
  );
}

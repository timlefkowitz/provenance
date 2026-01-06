'use client';

import Image from 'next/image';

import { Button } from '@kit/ui/button';
import { useSignInWithProvider } from '@kit/supabase/hooks/use-sign-in-with-provider';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { If } from '@kit/ui/if';

import pathsConfig from '~/config/paths.config';

export function GoogleSignInButton() {
  const signInWithProviderMutation = useSignInWithProvider();
  const loading = signInWithProviderMutation.isPending;

  const handleGoogleSignIn = () => {
    const origin = window.location.origin;
    const redirectPath = pathsConfig.auth.callback;
    const redirectTo = `${origin}${redirectPath}`;

    const credentials = {
      provider: 'google' as const,
      options: {
        shouldCreateUser: false,
        redirectTo,
      },
    };

    signInWithProviderMutation.mutateAsync(credentials).catch((error) => {
      console.error('Sign in error:', error);
    });
  };

  return (
    <>
      <If condition={loading}>
        <LoadingOverlay />
      </If>
      <Button
        className="flex w-full space-x-2 text-center"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <Image
          src="/images/oauth/google.webp"
          alt="Google logo"
          width={18}
          height={18}
          decoding="async"
          loading="lazy"
        />
        <span>Sign in with Google</span>
      </Button>
    </>
  );
}


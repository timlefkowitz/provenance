'use client';

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
        className="w-full font-serif"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={loading}
      >
        <span>Sign in with Google</span>
      </Button>
    </>
  );
}


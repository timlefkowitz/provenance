'use client';

import { useCallback } from 'react';

import type { Provider } from '@supabase/supabase-js';

import { useSignInWithProvider } from '@kit/supabase/hooks/use-sign-in-with-provider';
import { If } from '@kit/ui/if';
import { LoadingOverlay } from '@kit/ui/loading-overlay';
import { Trans } from '@kit/ui/trans';

import { AuthErrorAlert } from './auth-error-alert';
import { AuthProviderButton } from './auth-provider-button';

/**
 * @name OAUTH_SCOPES
 * @description
 * The OAuth scopes are used to specify the permissions that the application is requesting from the user.
 *
 * Please add your OAuth providers here and the scopes you want to use.
 *
 * @see https://supabase.com/docs/guides/auth/social-login
 */
const OAUTH_SCOPES: Partial<Record<Provider, string>> = {
  azure: 'email',
  // add your OAuth providers here
};

/**
 * @name APEX_TO_WWW_HOST
 * @description
 * `provenance.guru` (apex) 307s to `www.provenance.guru` at the Vercel domain
 * level. Supabase's PKCE `code_verifier` cookie is host-only (no `domain`
 * attribute — see `getHardenedCookieOptions`), so if a user ever lands on
 * this page via the bare apex host, the cookie set here would not be visible
 * once Supabase's OAuth callback resolves back to the canonical `www` host,
 * breaking `exchangeCodeForSession` with a generic "Authentication Error".
 * Force the canonical host before starting the OAuth flow so the cookie and
 * the callback always agree on the same host.
 */
const APEX_TO_WWW_HOST: Record<string, string> = {
  'provenance.guru': 'www.provenance.guru',
};

export function OauthProviders(props: {
  shouldCreateUser: boolean;
  enabledProviders: Provider[];

  paths: {
    callback: string;
    returnPath: string;
  };
}) {
  const signInWithProviderMutation = useSignInWithProvider();

  // we make the UI "busy" until the next page is fully loaded
  const loading = signInWithProviderMutation.isPending;

  const onSignInWithProvider = useCallback(
    async (signInRequest: () => Promise<unknown>) => {
      const credential = await signInRequest();

      if (!credential) {
        return Promise.reject(new Error('Failed to sign in with provider'));
      }
    },
    [],
  );

  const enabledProviders = props.enabledProviders;

  if (!enabledProviders?.length) {
    return null;
  }

  return (
    <>
      <If condition={loading}>
        <LoadingOverlay />
      </If>

      <div className={'flex w-full flex-1 flex-col space-y-3'}>
        <div className={'flex-col space-y-2'}>
          {enabledProviders.map((provider) => {
            return (
              <AuthProviderButton
                key={provider}
                providerId={provider}
                onClick={() => {
                  const canonicalHost = APEX_TO_WWW_HOST[window.location.hostname];

                  if (canonicalHost) {
                    // Currently on the apex host — redirect there first so the
                    // code_verifier cookie signInWithOAuth is about to set
                    // lands on the same host Supabase will redirect back to.
                    // The user re-clicks the provider button once on `www`.
                    console.warn(
                      '[Auth] OAuth started from apex host, redirecting to canonical host before retrying',
                      { from: window.location.hostname, to: canonicalHost },
                    );
                    window.location.replace(
                      `https://${canonicalHost}${window.location.pathname}${window.location.search}`,
                    );
                    return;
                  }

                  const origin = window.location.origin;
                  const queryParams = new URLSearchParams();

                  if (props.paths.returnPath) {
                    queryParams.set('next', props.paths.returnPath);
                  }

                  const redirectPath = [
                    props.paths.callback,
                    queryParams.toString(),
                  ].join('?');

                  const redirectTo = [origin, redirectPath].join('');
                  const scopesOpts = OAUTH_SCOPES[provider] ?? {};

                  const credentials = {
                    provider,
                    options: {
                      shouldCreateUser: props.shouldCreateUser,
                      redirectTo,
                      ...scopesOpts,
                    },
                  };

                  return onSignInWithProvider(() =>
                    signInWithProviderMutation.mutateAsync(credentials),
                  );
                }}
              >
                <Trans
                  i18nKey={'auth:signInWithProvider'}
                  values={{
                    provider: getProviderName(provider),
                  }}
                  defaults={'Sign in with {{provider}}'}
                />
              </AuthProviderButton>
            );
          })}
        </div>

        <AuthErrorAlert error={signInWithProviderMutation.error} />
      </div>
    </>
  );
}

function getProviderName(providerId: string) {
  const capitalize = (value: string) =>
    value.slice(0, 1).toUpperCase() + value.slice(1);

  if (providerId.endsWith('.com')) {
    return capitalize(providerId.split('.com')[0]!);
  }

  return capitalize(providerId);
}

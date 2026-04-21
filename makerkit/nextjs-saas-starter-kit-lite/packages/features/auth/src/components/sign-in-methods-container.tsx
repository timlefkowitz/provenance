'use client';

import { useRouter, useSearchParams } from 'next/navigation';

import type { Provider } from '@supabase/supabase-js';

import { isBrowser } from '@kit/shared/utils';
import { If } from '@kit/ui/if';
import { Separator } from '@kit/ui/separator';

import { MagicLinkAuthContainer } from './magic-link-auth-container';
import { OauthProviders } from './oauth-providers';
import { PasswordSignInContainer } from './password-sign-in-container';
import { Trans } from '@kit/ui/trans';

export function SignInMethodsContainer(props: {
  paths: {
    callback: string;
    home: string;
  };

  providers: {
    password: boolean;
    magicLink: boolean;
    oAuth: Provider[];
  };
}) {
  const router = useRouter();
  const nextPath = useSearchParams().get('next') ?? props.paths.home;

  const redirectUrl = isBrowser()
    ? new URL(props.paths.callback, window?.location.origin).toString()
    : '';

  const onSignIn = () => {
    router.replace(nextPath);
  };

  return (
    <>
      <If condition={props.providers.password}>
        <PasswordSignInContainer onSignIn={onSignIn} />
      </If>

      <If condition={props.providers.password && props.providers.magicLink}>
        <div className={'relative my-2'}>
          <Separator />
          <span className={'absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs text-muted-foreground'}>
            or
          </span>
        </div>
      </If>

      <If condition={props.providers.magicLink}>
        <div className={'flex flex-col space-y-2'}>
          <p className={'text-sm font-medium text-muted-foreground'}>
            <Trans i18nKey={'auth:signInWithMagicLink'} defaults={'Sign in with a magic link'} />
          </p>
          <MagicLinkAuthContainer
            redirectUrl={redirectUrl}
            shouldCreateUser={false}
          />
        </div>
      </If>

      <If condition={props.providers.oAuth.length}>
        <Separator />

        <OauthProviders
          enabledProviders={props.providers.oAuth}
          shouldCreateUser={false}
          paths={{
            callback: props.paths.callback,
            returnPath: props.paths.home,
          }}
        />
      </If>
    </>
  );
}

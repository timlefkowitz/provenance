import Link from 'next/link';

import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Separator } from '@kit/ui/separator';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { UsernamePasswordSignInContainer } from '../_components/username-password-sign-in-container';
import { CollapsibleSignUpSection } from '../_components/collapsible-sign-up-section';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signIn'),
  };
};

const paths = {
  callback: pathsConfig.auth.callback,
  home: pathsConfig.app.home,
};

function SignInPage() {
  console.log('[Auth/SignIn] rendering sign-in page', {
    providers: {
      password: authConfig.providers.password,
      magicLink: authConfig.providers.magicLink,
      oAuth: authConfig.providers.oAuth,
    },
  });

  return (
    <div className={'flex flex-col gap-y-6'}>
      <div className={'flex flex-col gap-y-1 text-center'}>
        <Heading level={4} className={'tracking-tight text-[#111111]'}>
          Welcome back
        </Heading>

        <p className={'text-sm'} style={{ color: '#4A2F25', opacity: 0.7 }}>
          Sign in to your Provenance account
        </p>
      </div>

      <SignInMethodsContainer paths={paths} providers={authConfig.providers} />

      {authConfig.providers.password && (
        <>
          <Separator />
          <CollapsibleSignUpSection label="Sign in with username">
            <UsernamePasswordSignInContainer homePath={paths.home} />
          </CollapsibleSignUpSection>
        </>
      )}

      <div className={'flex justify-center pt-1'}>
        <span className="text-sm" style={{ color: '#111111', opacity: 0.5 }}>
          New to Provenance?{' '}
          <Button asChild variant={'link'} size={'sm'} className="h-auto p-0 text-sm font-medium" style={{ color: '#4A2F25' }}>
            <Link href={pathsConfig.auth.signUp}>
              Create an account
            </Link>
          </Button>
        </span>
      </div>
    </div>
  );
}

export default withI18n(SignInPage);

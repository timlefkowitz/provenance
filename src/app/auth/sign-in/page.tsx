import Link from 'next/link';

import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

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
    <div className={'flex flex-col gap-y-5'}>
      <div className={'flex flex-col gap-y-1.5 text-center'}>
        <Heading level={4} className={'tracking-tight'}>
          <Trans i18nKey={'auth:signInHeading'} />
        </Heading>

        <p className={'text-sm text-muted-foreground'}>
          Welcome back. Pick how you&apos;d like to sign in.
        </p>
      </div>

      <SignInMethodsContainer paths={paths} providers={authConfig.providers} />

      <div className={'flex justify-center'}>
        <Button asChild variant={'link'} size={'sm'}>
          <Link href={pathsConfig.auth.signUp}>
            <Trans
              i18nKey={'auth:doNotHaveAccountYet'}
              defaults="Don't have an account? Sign up"
            />
          </Link>
        </Button>
      </div>
    </div>
  );
}

export default withI18n(SignInPage);

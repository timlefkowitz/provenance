import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { Button } from '@kit/ui/button';
import { Heading } from '@kit/ui/heading';
import { Trans } from '@kit/ui/trans';
import { Separator } from '@kit/ui/separator';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { CustomEmailPasswordSignUpContainer } from '../_components/custom-password-sign-up-container';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: i18n.t('auth:signUp'),
  };
};

const paths = {
  callback: pathsConfig.auth.callback,
  confirm: pathsConfig.auth.confirm,
  appHome: pathsConfig.app.home,
};

function SignUpPage() {
  const redirectUrl = typeof window !== 'undefined' 
    ? new URL(paths.confirm || paths.callback, window.location.origin).href
    : '';

  return (
    <>
      <Heading level={5} className={'tracking-tight'}>
        <Trans i18nKey={'auth:signUpHeading'} />
      </Heading>

      {authConfig.providers.password && (
        <CustomEmailPasswordSignUpContainer
          emailRedirectTo={redirectUrl}
          displayTermsCheckbox={authConfig.displayTermsCheckbox}
        />
      )}

      {authConfig.providers.oAuth.length > 0 && (
        <>
          {authConfig.providers.password && <Separator />}
          <SignUpMethodsContainer
            providers={{
              password: false, // We're using custom form above
              magicLink: authConfig.providers.magicLink,
              oAuth: authConfig.providers.oAuth,
            }}
            displayTermsCheckbox={authConfig.displayTermsCheckbox}
            paths={paths}
          />
        </>
      )}

      <div className={'flex justify-center'}>
        <Button asChild variant={'link'} size={'sm'}>
          <Link href={pathsConfig.auth.signIn}>
            <Trans i18nKey={'auth:alreadyHaveAnAccount'} />
          </Link>
        </Button>
      </div>
    </>
  );
}

export default withI18n(SignUpPage);

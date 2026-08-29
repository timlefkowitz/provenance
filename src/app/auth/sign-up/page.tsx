import Link from 'next/link';

import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { Button } from '@kit/ui/button';
import { Trans } from '@kit/ui/trans';
import { Separator } from '@kit/ui/separator';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { CustomEmailPasswordSignUpContainer } from '../_components/custom-password-sign-up-container';
import { UsernamePasswordSignUpContainer } from '../_components/username-password-sign-up-container';
import { CollapsibleSignUpSection } from '../_components/collapsible-sign-up-section';

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
  return (
    <div className="flex flex-col gap-y-6">
      <div className="flex flex-col gap-y-1 text-center">
        <h2 className="text-xl font-semibold tracking-tight text-[#111111]">
          Create your account
        </h2>
        <p className="text-sm" style={{ color: '#4A2F25', opacity: 0.7 }}>
          Start documenting your artwork&apos;s story today
        </p>
      </div>

      {authConfig.providers.password && (
        <CollapsibleSignUpSection label="Sign up with email">
          <CustomEmailPasswordSignUpContainer
            emailRedirectPath={paths.confirm || paths.callback}
            displayTermsCheckbox={authConfig.displayTermsCheckbox}
          />
        </CollapsibleSignUpSection>
      )}

      {authConfig.providers.password && (
        <>
          <Separator />
          <CollapsibleSignUpSection label="Sign up with username">
            <UsernamePasswordSignUpContainer
              appHomePath={paths.appHome}
              displayTermsCheckbox={authConfig.displayTermsCheckbox}
            />
          </CollapsibleSignUpSection>
        </>
      )}

      {authConfig.providers.oAuth.length > 0 && (
        <>
          {authConfig.providers.password && <Separator />}
          <SignUpMethodsContainer
            providers={{
              password: false,
              magicLink: authConfig.providers.magicLink,
              oAuth: authConfig.providers.oAuth,
            }}
            displayTermsCheckbox={authConfig.displayTermsCheckbox}
            paths={paths}
          />
        </>
      )}

      <div className="flex justify-center pt-1">
        <span className="text-sm" style={{ color: '#111111', opacity: 0.5 }}>
          Already have an account?{' '}
          <Button
            asChild
            variant="link"
            size="sm"
            className="h-auto p-0 text-sm font-medium"
            style={{ color: '#4A2F25' }}
          >
            <Link href={pathsConfig.auth.signIn}>
              <Trans i18nKey={'auth:alreadyHaveAnAccount'} defaults="Sign in" />
            </Link>
          </Button>
        </span>
      </div>
    </div>
  );
}

export default withI18n(SignUpPage);

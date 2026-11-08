import { SignInMethodsContainer } from '@kit/auth/sign-in';
import { Separator } from '@kit/ui/separator';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { UsernamePasswordSignInContainer } from '../_components/username-password-sign-in-container';
import { CollapsibleSignUpSection } from '../_components/collapsible-sign-up-section';
import { PasskeySignIn } from '../_components/passkey-sign-in';
import { AuthSwitchLink } from '../_components/auth-switch-link';

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
      <div className={'flex flex-col gap-y-2'}>
        <span className="label-editorial text-gilt">§ Sign in</span>
        <h1 className="font-fraunces italic text-[2rem] font-normal leading-none tracking-tight text-editorial-ink">
          Welcome back<span className="text-vermillion">.</span>
        </h1>
        <p className="text-sm text-editorial-ink/60">
          Sign in to your Provenance account
        </p>
      </div>

      <PasskeySignIn homePath={paths.home} />

      <SignInMethodsContainer paths={paths} providers={authConfig.providers} />

      {authConfig.providers.password && (
        <>
          <Separator />
          <CollapsibleSignUpSection label="Sign in with username">
            <UsernamePasswordSignInContainer homePath={paths.home} />
          </CollapsibleSignUpSection>
        </>
      )}

      <div className={'flex items-baseline justify-center gap-2 border-t border-editorial-border/15 pt-5'}>
        <span className="text-sm text-editorial-ink/50">New to Provenance?</span>
        <AuthSwitchLink href={pathsConfig.auth.signUp}>
          <span className="label-editorial text-[11px] text-editorial-ink underline decoration-vermillion decoration-[1.5px] underline-offset-4 transition-colors hover:text-vermillion">
            Create an account
          </span>
        </AuthSwitchLink>
      </div>
    </div>
  );
}

export default withI18n(SignInPage);

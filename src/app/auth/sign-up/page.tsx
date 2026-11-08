import { SignUpMethodsContainer } from '@kit/auth/sign-up';
import { Separator } from '@kit/ui/separator';

import authConfig from '~/config/auth.config';
import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { CustomEmailPasswordSignUpContainer } from '../_components/custom-password-sign-up-container';
import { UsernamePasswordSignUpContainer } from '../_components/username-password-sign-up-container';
import { CollapsibleSignUpSection } from '../_components/collapsible-sign-up-section';
import { AuthSwitchLink } from '../_components/auth-switch-link';

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
      <div className="flex flex-col gap-y-2">
        <span className="label-editorial text-gilt">§ Sign up</span>
        <h1 className="font-fraunces italic text-[2rem] font-normal leading-none tracking-tight text-editorial-ink">
          Create your account<span className="text-vermillion">.</span>
        </h1>
        <p className="text-sm text-editorial-ink/60">
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

      <div className="flex items-baseline justify-center gap-2 border-t border-editorial-border/15 pt-5">
        <span className="text-sm text-editorial-ink/50">Already have an account?</span>
        <AuthSwitchLink href={pathsConfig.auth.signIn}>
          <span className="label-editorial text-[11px] text-editorial-ink underline decoration-vermillion decoration-[1.5px] underline-offset-4 transition-colors hover:text-vermillion">
            Sign in
          </span>
        </AuthSwitchLink>
      </div>
    </div>
  );
}

export default withI18n(SignUpPage);

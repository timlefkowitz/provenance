'use client';

import { useCallback, useRef, useState } from 'react';

import { CheckCircledIcon } from '@radix-ui/react-icons';

import { useSignUpWithEmailPasswordAndUsername } from '../_hooks/use-sign-up-with-email-password-username';
import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { If } from '@kit/ui/if';
import { Trans } from '@kit/ui/trans';

import { AuthErrorAlert } from '../../../../makerkit/nextjs-saas-starter-kit-lite/packages/features/auth/src/components/auth-error-alert';
import { CustomPasswordSignUpForm } from './custom-password-sign-up-form';

interface CustomEmailPasswordSignUpContainerProps {
  displayTermsCheckbox?: boolean;
  defaultValues?: {
    email: string;
    username?: string;
  };

  onSignUp?: (userId?: string) => unknown;
  /**
   * App-relative path for the confirmation link (e.g. `/auth/confirm`).
   * The full URL is built client-side so it always reflects the actual origin
   * (avoids the server-render window=undefined bug that produced an empty string).
   */
  emailRedirectPath: string;
}

export function CustomEmailPasswordSignUpContainer({
  defaultValues,
  onSignUp,
  emailRedirectPath,
  displayTermsCheckbox,
}: CustomEmailPasswordSignUpContainerProps) {
  const signUpMutation = useSignUpWithEmailPasswordAndUsername();
  const redirecting = useRef(false);
  const [showVerifyEmailAlert, setShowVerifyEmailAlert] = useState(false);

  const loading = signUpMutation.isPending || redirecting.current;

  const onSignupRequested = useCallback(
    async (credentials: { username: string; email: string; password: string; repeatPassword: string }) => {
      if (loading) {
        return;
      }

      // Build the full confirm URL here in the browser so window.location.origin
      // is always available (the sign-up page is a Server Component and the old
      // window-check there always produced an empty string).
      const emailRedirectTo = new URL(emailRedirectPath, window.location.origin).href;

      try {
        const data = await signUpMutation.mutateAsync({
          username: credentials.username,
          email: credentials.email,
          password: credentials.password,
          emailRedirectTo,
        });

        setShowVerifyEmailAlert(true);

        if (onSignUp) {
          onSignUp(data.user?.id);
        }
      } catch (error) {
        console.error('[CustomPasswordSignUp] Sign up failed', error);
      }
    },
    [
      emailRedirectPath,
      loading,
      onSignUp,
      signUpMutation,
    ],
  );

  return (
    <>
      <If condition={showVerifyEmailAlert}>
        <SuccessAlert />
      </If>

      <If condition={!showVerifyEmailAlert}>
        <AuthErrorAlert error={signUpMutation.error} />

        <CustomPasswordSignUpForm
          onSubmit={onSignupRequested}
          loading={loading}
          defaultValues={defaultValues}
          displayTermsCheckbox={displayTermsCheckbox}
        />
      </If>
    </>
  );
}

function SuccessAlert() {
  return (
    <Alert variant={'success'}>
      <CheckCircledIcon className={'w-4'} />

      <AlertTitle>
        <Trans i18nKey={'auth:emailConfirmationAlertHeading'} />
      </AlertTitle>

      <AlertDescription data-test={'email-confirmation-alert'}>
        <Trans i18nKey={'auth:emailConfirmationAlertBody'} />
      </AlertDescription>
    </Alert>
  );
}


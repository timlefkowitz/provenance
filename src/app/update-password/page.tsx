import { redirect } from 'next/navigation';

import { UpdatePasswordForm } from '@kit/auth/password-reset';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { AppLogo } from '~/components/app-logo';
import { asUntyped } from '~/lib/supabase-untyped';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return { title: i18n.t('auth:updatePassword') };
};

async function UpdatePasswordPage() {
  console.log('[Auth/PasswordReset] update-password page loaded');

  // After /auth/confirm verifies the recovery token, Supabase sets a session
  // cookie. Gate this page so someone can't visit it cold without a session.
  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    console.warn('[Auth/PasswordReset] no session on /update-password — redirecting to sign-in');
    redirect('/auth/sign-in');
  }

  console.log('[Auth/PasswordReset] rendering update-password form', { userId: user.id });

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-6 py-12"
      style={{ backgroundColor: '#F5F1E8' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center gap-y-3">
          <svg
            viewBox="0 0 64 64"
            aria-hidden="true"
            className="h-10 w-10"
          >
            <rect width="64" height="64" rx="8" fill="#4A2F25" />
            <path
              fill="#F5F1E8"
              d="M24 14h10c7.2 0 12 4.4 12 10.8 0 6.5-4.8 11.1-12 11.1h-5.2V50H24V14Zm9.4 18.1c4 0 6.6-2.4 6.6-6.1 0-3.6-2.6-5.9-6.6-5.9h-4.6v12z"
            />
          </svg>
          <AppLogo />
        </div>

        {/* Form card */}
        <div
          className="w-full rounded-2xl px-8 py-10 shadow-sm"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <UpdatePasswordForm redirectTo="/artworks" />
        </div>
      </div>
    </div>
  );
}

export default withI18n(UpdatePasswordPage);

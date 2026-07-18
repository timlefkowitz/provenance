'use client';

import { useEffect, useState } from 'react';
import { ShieldAlert, ShieldCheck, KeyRound, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { MultiFactorAuthFactorsList } from '@kit/accounts/mfa';
import { useRequestResetPassword } from '@kit/supabase/hooks/use-request-reset-password';
import pathsConfig from '~/config/paths.config';

type Props = {
  userId: string;
  email: string;
  /**
   * True when requireAdmin() redirected here with ?require_mfa=1 — the
   * admin's MFA enrollment grace period expired and admin access is blocked
   * until a factor is enrolled (CASA 3.3).
   */
  mfaEnrollmentRequired?: boolean;
};

function ChangePasswordCard({ email }: { email: string }) {
  const resetPasswordMutation = useRequestResetPassword();
  const [sent, setSent] = useState(false);

  async function handleReset() {
    const redirectPath = `${pathsConfig.auth.callback}?next=${pathsConfig.auth.passwordUpdate}`;
    const redirectTo = new URL(redirectPath, window.location.origin).href;

    try {
      await resetPasswordMutation.mutateAsync({ email, redirectTo });
      setSent(true);
    } catch {
      // error is surfaced below via resetPasswordMutation.error
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-wine" />
          <CardTitle className="text-base font-display">Password</CardTitle>
        </div>
        <CardDescription className="font-serif text-sm">
          We&apos;ll email you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {sent ? (
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
            <span>
              Check <strong>{email}</strong> for a link to reset your password.
            </span>
          </div>
        ) : (
          <>
            {resetPasswordMutation.error && (
              <div
                role="alert"
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              >
                Something went wrong sending the reset email. Please try again.
              </div>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={resetPasswordMutation.isPending}
              onClick={handleReset}
              className="font-serif border-wine/30 text-wine hover:bg-wine/10"
            >
              {resetPasswordMutation.isPending ? 'Sending…' : 'Reset Password'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SecuritySection({ userId, email, mfaEnrollmentRequired }: Props) {
  // The redirect from requireAdmin() lands on /settings?require_mfa=1#security,
  // but the hash can be lost through the server redirect — make sure the user
  // actually sees this section.
  useEffect(() => {
    if (mfaEnrollmentRequired) {
      document.getElementById('security')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [mfaEnrollmentRequired]);

  return (
    <section id="security" className="scroll-mt-28 space-y-6">
      {mfaEnrollmentRequired && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-500" aria-hidden />
          <span>
            <strong>Admin access blocked:</strong> your grace period to enable
            two-factor authentication has expired. Enroll an authenticator app
            below to regain access to the admin dashboard.
          </span>
        </div>
      )}

      <div>
        <h2 className="text-2xl font-display font-bold text-wine">
          Security
        </h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Manage two-factor authentication and account security.
        </p>
      </div>

      <ChangePasswordCard email={email} />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-wine" />
            <CardTitle className="text-base font-display">Two-Factor Authentication</CardTitle>
          </div>
          <CardDescription className="font-serif text-sm">
            Add a second factor to protect your account. Supported methods: authenticator app (TOTP).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiFactorAuthFactorsList userId={userId} />
        </CardContent>
      </Card>
    </section>
  );
}

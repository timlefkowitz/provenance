'use client';

import { useEffect } from 'react';
import { ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { MultiFactorAuthFactorsList } from '@kit/accounts/mfa';

type Props = {
  userId: string;
  /**
   * True when requireAdmin() redirected here with ?require_mfa=1 — the
   * admin's MFA enrollment grace period expired and admin access is blocked
   * until a factor is enrolled (CASA 3.3).
   */
  mfaEnrollmentRequired?: boolean;
};

export function SecuritySection({ userId, mfaEnrollmentRequired }: Props) {
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

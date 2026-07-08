'use client';

import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { MultiFactorAuthFactorsList } from '@kit/accounts/mfa';

type Props = {
  userId: string;
};

export function SecuritySection({ userId }: Props) {
  return (
    <section id="security" className="scroll-mt-28 space-y-6">
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

'use client';

import { useRouter } from 'next/navigation';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { LogOut } from 'lucide-react';

export function AccountActionsSection() {
  const signOut = useSignOut();
  const router = useRouter();

  async function handleSignOut() {
    await signOut.mutateAsync();
    router.push('/');
  }

  return (
    <section id="account-actions" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">
          Account Actions
        </h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Sign out or manage your account.
        </p>
      </div>

      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <CardTitle className="font-display text-wine">Sign Out</CardTitle>
          <CardDescription className="font-serif">
            Sign out of your Provenance account on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            onClick={handleSignOut}
            variant="outline"
            className="font-serif border-wine/30 text-wine hover:bg-wine/10"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </section>
  );
}

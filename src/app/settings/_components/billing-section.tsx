'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { getRoleLabel, type UserRole } from '~/lib/user-roles';
import { CreditCard, ExternalLink, Loader2 } from 'lucide-react';

type SubscriptionData = {
  id: string;
  role: string;
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
} | null;

type Props = {
  subscription: SubscriptionData;
};

function formatDate(iso: string | null | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function BillingSection({ subscription }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isActive = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';

  async function handleOpenPortal() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not open billing portal');
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
      setError('Invalid response from server');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="billing" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">
          Subscription & Billing
        </h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Manage your plan and payment details.
        </p>
      </div>

      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-wine/60" />
            <div>
              <CardTitle className="font-display text-wine">Your Plan</CardTitle>
              <CardDescription className="font-serif">
                {isActive
                  ? 'You have an active subscription.'
                  : isTrialing
                    ? 'You are on a free trial.'
                    : 'You do not have an active subscription.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isActive && subscription && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200">
                  Active
                </Badge>
                <span className="font-serif text-sm text-ink/80">
                  {getRoleLabel(subscription.role as UserRole)} plan
                </span>
              </div>
              {subscription.current_period_end && (
                <p className="text-sm text-ink/60 font-serif">
                  Current period ends {formatDate(subscription.current_period_end)}.
                </p>
              )}
              <Button
                onClick={handleOpenPortal}
                disabled={loading}
                variant="outline"
                className="font-serif border-wine/30"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Manage Billing & Payment
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </Button>
            </div>
          )}

          {isTrialing && subscription && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-wine/10 text-wine border-wine/20">
                  Trial
                </Badge>
                <span className="font-serif text-sm text-ink/80">
                  14-day free trial
                </span>
              </div>
              {(subscription.trial_end || subscription.current_period_end) && (
                <p className="text-sm text-ink/60 font-serif">
                  Trial ends{' '}
                  {formatDate(subscription.trial_end ?? subscription.current_period_end)}.
                </p>
              )}
              <Button
                asChild
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                <Link href="/subscription">Upgrade Now</Link>
              </Button>
            </div>
          )}

          {!isActive && !isTrialing && (
            <div className="space-y-3">
              <p className="font-serif text-sm text-ink/70">
                Subscribe to access the Toolbox: Grants, Open Calls,
                Opportunities & Relationships, and Operations (loans and
                invoices). Certificates remain free for everyone.
              </p>
              <Button
                asChild
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                <Link href="/subscription">View Plans & Subscribe</Link>
              </Button>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 font-serif">{error}</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

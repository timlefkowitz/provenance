'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { gtmService } from '~/lib/gtm';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import {
  SUBSCRIPTION_PRICES,
  type SubscriptionRole,
  type SubscriptionInterval,
} from '~/lib/stripe-config';
import { getRoleLabel, type UserRole } from '~/lib/user-roles';
import { Loader2 } from 'lucide-react';

type SubscriptionRow = {
  id: string;
  role: string;
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
} | null;

type Props = {
  subscription: SubscriptionRow;
  defaultRole: SubscriptionRole | null;
  success?: boolean;
  canceled?: boolean;
  upgrade?: boolean;
};

const ROLES: SubscriptionRole[] = ['artist', 'collector', 'gallery'];

const ROLE_FEATURES: Record<SubscriptionRole, string[]> = {
  artist: [
    'Toolbox (Grants, CRM, Operations)',
    'Grant list',
    'Open call list',
    'Residency list',
    'Creator website (yourname.provenance.app)',
    '+ more',
  ],
  collector: [
    'Access to the Toolbox (incl. Operations)',
    'Collection management',
    'Appraiser tools',
    'Automatically get information on your artworks & artist',
    'Creator website (yourname.provenance.app)',
    '+ more',
  ],
  gallery: [
    'Collection management',
    'Exhibition toolset',
    'Artist publication collection',
    'Gallery grants',
    'Creator website (yourname.provenance.app)',
    'and more',
  ],
};

export function SubscriptionContent({
  subscription,
  defaultRole,
  success,
  canceled,
  upgrade,
}: Props) {
  const [interval, setInterval] = useState<SubscriptionInterval>('month');
  const [selectedRole, setSelectedRole] = useState<SubscriptionRole>(
    defaultRole || 'artist'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fire a GTM purchase event exactly once when Stripe redirects back with ?success=1
  useEffect(() => {
    if (!success) return;
    console.log('[GTM] Stripe checkout success — firing purchase event', { role: selectedRole, interval });
    gtmService.trackPurchase({ role: selectedRole, interval });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const isActiveSubscription = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';

  function formatLongDate(iso: string | null | undefined) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  // During Stripe trialing, current_period_end can reflect billing-cycle boundaries; prefer trial_end.
  const trialEndsOn =
    isTrialing && subscription
      ? formatLongDate(subscription.trial_end ?? subscription.current_period_end)
      : null;
  const activePeriodEnds =
    isActiveSubscription && subscription
      ? formatLongDate(subscription.current_period_end)
      : null;

  async function handleCheckout() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole, interval }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Checkout failed');
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

  async function handlePortal() {
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
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="text-center">
        <h1 className="font-display text-3xl font-bold text-wine mb-2">
          Subscription & Billing
        </h1>
        <p className="text-ink/70 font-serif">
          Manage your subscription and billing. Pay monthly or save with a yearly plan.
        </p>
        <p className="text-ink/60 font-serif text-sm mt-2">
          We are currently in beta; this subscription helps support future features.
        </p>
      </div>

      {success && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/30">
          <CardContent className="pt-6">
            <p className="font-serif text-green-800 dark:text-green-200">
              Thank you for subscribing. Your subscription is now active. A confirmation email will be sent to you.
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link href="/portal">Proceed to Portal</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {canceled && (
        <Card className="border-ink/20 bg-parchment/40">
          <CardContent className="pt-6">
            <p className="font-serif text-ink/80">
              Checkout was canceled. You can choose a plan below when you&apos;re ready.
            </p>
          </CardContent>
        </Card>
      )}

      {upgrade && !isActiveSubscription && !isTrialing && (
        <Card className="border-wine/30 bg-wine/5">
          <CardContent className="pt-6">
            <p className="font-serif text-wine">
              Subscribe to access the Toolbox: Grants, Open Calls, CRM, and Operations (loan agreements and invoices). Certificates remain free for everyone.
            </p>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30">
          <CardContent className="pt-6">
            <p className="font-serif text-red-800 dark:text-red-200">{error}</p>
          </CardContent>
        </Card>
      )}

      {isActiveSubscription && subscription && (
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">
              Your Plan
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-serif text-ink/80">
              You have an active <strong>{getRoleLabel(subscription.role as UserRole)}</strong> subscription.
              {activePeriodEnds && (
                <span className="block mt-1 text-sm">
                  Current period ends {activePeriodEnds}.
                </span>
              )}
            </p>
            <Button
              onClick={handlePortal}
              disabled={loading}
              className="font-serif"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Manage Billing & Payment
            </Button>
          </CardContent>
        </Card>
      )}

      {isTrialing && subscription && (
        <Card className="border-wine/20 bg-wine/5">
          <CardHeader>
            <CardTitle className="font-display text-xl text-wine">
              You&apos;re on a trial
            </CardTitle>
            <p className="text-sm text-ink/60 font-serif mt-1">
              Access to the Toolbox is enabled for your 14-day trial.
            </p>
          </CardHeader>
          <CardContent>
            {trialEndsOn && (
              <p className="font-serif text-ink/80">
                Your trial ends {trialEndsOn}.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!isActiveSubscription && (
        <>
          <Card className="border-wine/20 bg-parchment/60">
            <CardHeader>
              <CardTitle className="font-display text-xl text-wine">
                Choose your plan
              </CardTitle>
              <p className="text-sm text-ink/60 font-serif">
                {isTrialing
                  ? 'Pick Artist, Collector, or Gallery and monthly or yearly billing, then continue to payment.'
                  : 'Professional Artist $10/mo or $99/yr. Collectors and Galleries get the same ~2 months free when you pay yearly.'}
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex gap-4 border-b border-ink/20 pb-4">
                <button
                  type="button"
                  onClick={() => setInterval('month')}
                  className={`font-serif px-4 py-2 rounded ${interval === 'month' ? 'bg-wine text-white' : 'bg-ink/10 text-ink'}`}
                >
                  Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setInterval('year')}
                  className={`font-serif px-4 py-2 rounded ${interval === 'year' ? 'bg-wine text-white' : 'bg-ink/10 text-ink'}`}
                >
                  Yearly (save ~2 months)
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                {ROLES.map((role) => {
                  const prices = SUBSCRIPTION_PRICES[role];
                  const amount =
                    interval === 'year' ? prices.yearly : prices.monthly;
                  const label =
                    interval === 'year'
                      ? prices.yearlyLabel
                      : `$${amount}/month`;
                  const isSelected = selectedRole === role;
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setSelectedRole(role)}
                      className={`text-left p-4 rounded-lg border-2 transition-colors font-serif ${
                        isSelected
                          ? 'border-wine bg-wine/10'
                          : 'border-ink/20 hover:border-wine/50'
                      }`}
                    >
                      <div className="font-display font-bold text-wine">
                        {getRoleLabel(role)}
                      </div>
                      <div className="text-lg font-semibold text-ink mt-1">
                        {label}
                      </div>
                      {interval === 'year' && (
                        <div className="text-xs text-ink/60 mt-1">
                          Billed annually
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-lg border border-ink/15 bg-parchment/40 p-4">
                <p className="font-display font-semibold text-wine text-sm mb-2">
                  {getRoleLabel(selectedRole)} includes:
                </p>
                <ul className="font-serif text-sm text-ink/80 space-y-1 list-disc list-inside">
                  {ROLE_FEATURES[selectedRole].map((feature, i) => (
                    <li key={i}>{feature}</li>
                  ))}
                </ul>
                <p className="font-serif text-sm text-ink/60 mt-3">
                  Lots of exciting features on the roadmap.
                </p>
              </div>

              <Button
                onClick={handleCheckout}
                disabled={loading}
                className={`w-full font-serif ${isTrialing ? 'bg-wine text-parchment hover:bg-wine/90' : ''}`}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : null}
                {isTrialing ? 'Upgrade to continue' : 'Proceed to Checkout'}
              </Button>
              <p className="text-xs text-ink/50">
                {isTrialing
                  ? "You can upgrade anytime during your trial. You'll complete payment on Stripe."
                  : "You'll be redirected to Stripe to complete payment. Card and Apple Pay accepted."}
              </p>
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-center">
        <Link href="/portal" className="font-serif text-wine hover:underline">
          ← Back to Portal
        </Link>
      </p>
    </div>
  );
}

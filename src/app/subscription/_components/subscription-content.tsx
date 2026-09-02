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
import { SiteLegalFooter } from '~/components/legal/site-legal-footer';
import { Loader2, TrendingDown, Apple } from 'lucide-react';
import { isNativePlatform } from '~/lib/capacitor/is-native';
import {
  APPLE_PRODUCT_TO_PLAN,
  RC_OFFERING_IDENTIFIER,
} from '~/lib/capacitor/revenuecat-config';
import { resolveOriginalTransactionId } from '~/lib/capacitor/revenuecat-transaction-id';
import { waitForRevenueCatReady } from '~/lib/capacitor/revenuecat-status';
import { syncAppleEntitlement } from '../_actions/sync-apple-entitlement';

type SubscriptionRow = {
  id: string;
  role: string;
  status: string;
  current_period_end: string | null;
  trial_end: string | null;
  provider?: string | null;
} | null;

type Props = {
  subscription: SubscriptionRow;
  defaultRole: SubscriptionRole | null;
  success?: boolean;
  canceled?: boolean;
  upgrade?: boolean;
  defaultInterval?: 'year' | null;
};

const ROLES: SubscriptionRole[] = ['artist', 'collector', 'gallery'];

const ROLE_FEATURES: Record<SubscriptionRole, string[]> = {
  artist: [
    'Toolbox (Grants, CRM, Operations)',
    'Grant list',
    'Open call list',
    'Residency list',
    'Host your own website free at yourname.provenance.guru',
    'White-label website — no Provenance branding (paid)',
    'Custom domain — connect yourname.com (paid)',
    'Sell your work directly from your site',
    '+ more',
  ],
  collector: [
    'Access to the Toolbox (incl. Operations)',
    'Collection management',
    'Appraiser tools',
    'Automatically get information on your artworks & artist',
    'Host a website free at yourname.provenance.guru',
    'White-label website — no Provenance branding (paid)',
    'Custom domain — connect yourname.com (paid)',
    'Sell works directly from your site',
    '+ more',
  ],
  gallery: [
    'Collection management',
    'Exhibition toolset',
    'Artist publication collection',
    'Gallery grants',
    'Host a gallery website free at yourname.provenance.guru',
    'White-label website — no Provenance branding (paid)',
    'Custom domain — connect yourname.com (paid)',
    'Sell works directly from your site',
    'and more',
  ],
};

export function SubscriptionContent({
  subscription,
  defaultRole,
  success,
  canceled,
  upgrade,
  defaultInterval,
}: Props) {
  const [interval, setInterval] = useState<SubscriptionInterval>(defaultInterval ?? 'month');
  const [selectedRole, setSelectedRole] = useState<SubscriptionRole>(
    defaultRole || 'artist'
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [native, setNative] = useState(false);

  // Detect native platform client-side (safe for SSR)
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);

  // Fire a GTM purchase event exactly once when Stripe redirects back with ?success=1
  useEffect(() => {
    if (!success) return;
    console.log('[GTM] Stripe checkout success — firing purchase event', { role: selectedRole, interval });
    gtmService.trackPurchase({ role: selectedRole, interval });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [success]);

  const isActiveSubscription = subscription?.status === 'active';
  const isTrialing = subscription?.status === 'trialing';
  const isAppleSubscription = subscription?.provider === 'apple_iap';

  function formatLongDate(iso: string | null | undefined) {
    if (!iso) return null;
    return new Date(iso).toLocaleDateString(undefined, {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }

  const trialEndsOn =
    isTrialing && subscription
      ? formatLongDate(subscription.trial_end ?? subscription.current_period_end)
      : null;
  const activePeriodEnds =
    isActiveSubscription && subscription
      ? formatLongDate(subscription.current_period_end)
      : null;

  // ── Web checkout (Stripe) ──────────────────────────────────────────────────

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

  // ── Native Apple IAP (RevenueCat) ─────────────────────────────────────────

  async function handleNativePurchase() {
    setError(null);
    setLoading(true);
    console.log('[IAP] Starting native purchase', { role: selectedRole, interval });
    try {
      const ready = await waitForRevenueCatReady();
      if (!ready) {
        setError('Subscriptions are temporarily unavailable. Please try again in a moment.');
        console.error('[IAP] RevenueCat not configured — aborting purchase');
        return;
      }

      const { Purchases } = await import('@revenuecat/purchases-capacitor');

      const offeringsResult = await Purchases.getOfferings();
      const offering =
        offeringsResult.current ??
        offeringsResult.all[RC_OFFERING_IDENTIFIER] ??
        null;

      if (!offering) {
        setError('No subscription plans available. Please try again.');
        return;
      }

      // Find the package whose product ID matches our selected role + interval.
      const targetProductId = Object.entries(APPLE_PRODUCT_TO_PLAN).find(
        ([, plan]) => plan.role === selectedRole && plan.interval === interval,
      )?.[0];

      const pkg = offering.availablePackages.find(
        (p) => p.product.productIdentifier === targetProductId,
      );

      if (!pkg) {
        setError('Selected plan not available in the App Store. Please try again.');
        console.error('[IAP] Package not found for', { selectedRole, interval, targetProductId });
        return;
      }

      const purchaseResult = await Purchases.purchasePackage({ aPackage: pkg });
      const customerInfo = purchaseResult.customerInfo;

      // Eagerly sync to our DB without waiting for the webhook.
      const expMs =
        customerInfo.allExpirationDatesByProduct?.[targetProductId!] ?? null;
      const expDate = expMs ? new Date(expMs).getTime() : null;

      const originalTransactionId = resolveOriginalTransactionId(
        customerInfo,
        targetProductId!,
        purchaseResult.transaction,
      );

      const syncResult = await syncAppleEntitlement(
        originalTransactionId ?? '',
        targetProductId!,
        expDate,
      );
      if (!syncResult.success) {
        console.error('[IAP] Eager sync failed (webhook will catch it)', syncResult.error);
      }

      console.log('[IAP] Purchase completed', { role: selectedRole, interval });
      // Reload the page so the server re-reads the new subscription row.
      window.location.reload();
    } catch (err: unknown) {
      // RevenueCat throws a specific error when the user cancels
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === 'PURCHASE_CANCELLED') {
        setError(null);
        console.log('[IAP] Purchase cancelled by user');
        return;
      }
      console.error('[IAP] Purchase failed', err);
      setError(err instanceof Error ? err.message : 'Purchase failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleRestorePurchases() {
    setError(null);
    setLoading(true);
    console.log('[IAP] Restoring purchases');
    try {
      const ready = await waitForRevenueCatReady();
      if (!ready) {
        setError('Subscriptions are temporarily unavailable. Please try again in a moment.');
        console.error('[IAP] RevenueCat not configured — aborting restore');
        return;
      }

      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.restorePurchases();

      // Sync any active subscription found after restore.
      const activeProductIds = Object.keys(customerInfo.allExpirationDatesByProduct ?? {});
      let synced = false;

      for (const productId of activeProductIds) {
        const plan = APPLE_PRODUCT_TO_PLAN[productId];
        if (!plan) continue;

        const expMs = customerInfo.allExpirationDatesByProduct?.[productId] ?? null;
        const expDate = expMs ? new Date(expMs).getTime() : null;

        const originalTransactionId = resolveOriginalTransactionId(customerInfo, productId);
        if (!originalTransactionId) {
          console.warn('[IAP] Restore: no store transaction ID for product', { productId });
          continue;
        }

        const result = await syncAppleEntitlement(originalTransactionId, productId, expDate);
        if (result.success) {
          synced = true;
          break;
        }
      }

      if (synced) {
        console.log('[IAP] Restore succeeded, reloading');
        window.location.reload();
      } else {
        setError('No active subscriptions found to restore.');
      }
    } catch (err) {
      console.error('[IAP] Restore failed', err);
      setError(err instanceof Error ? err.message : 'Restore failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

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
            {isAppleSubscription ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg border border-ink/15 bg-ink/5 px-4 py-3 text-sm font-serif text-ink/70">
                  <Apple className="h-4 w-4 flex-shrink-0" aria-hidden />
                  <span>Subscribed via Apple. Manage your subscription in <strong>Settings → Apple ID → Subscriptions</strong> on your device.</span>
                </div>
              </div>
            ) : (
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
            )}
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

              {interval === 'month' && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm font-serif text-amber-900">
                  <TrendingDown className="h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden />
                  <span>
                    <strong>Save ~2 months</strong> by switching to annual billing.{' '}
                    <button
                      type="button"
                      className="underline hover:no-underline"
                      onClick={() => setInterval('year')}
                    >
                      Switch to yearly
                    </button>
                  </span>
                </div>
              )}

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

              {/* Native (Apple IAP) checkout path */}
              {native ? (
                <div className="space-y-3">
                  <Button
                    onClick={handleNativePurchase}
                    disabled={loading}
                    className={`w-full font-serif bg-wine text-parchment hover:bg-wine/90`}
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Apple className="h-4 w-4 mr-2" aria-hidden />
                    )}
                    {isTrialing ? 'Upgrade with Apple' : 'Subscribe with Apple'}
                  </Button>
                  <p className="text-xs text-ink/50 text-center">
                    Payment will be charged to your Apple ID at confirmation.
                  </p>
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleRestorePurchases}
                      disabled={loading}
                      className="font-serif text-xs text-wine underline hover:no-underline"
                    >
                      Restore previous purchases
                    </button>
                  </div>
                </div>
              ) : (
                /* Web (Stripe) checkout path */
                <div className="space-y-2">
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
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      <p className="text-center">
        <Link href="/portal" className="font-serif text-wine hover:underline">
          ← Back to Portal
        </Link>
      </p>

      <SiteLegalFooter variant="subscription" className="mt-8 border-t-0" />
    </div>
  );
}

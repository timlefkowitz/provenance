'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { ShoppingBag, ExternalLink, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { UpgradePrompt } from '~/components/upgrade-prompt';

type ConnectStatus = {
  connected: boolean;
  charges_enabled?: boolean;
  details_submitted?: boolean;
  payouts_enabled?: boolean;
} | null;

type Props = {
  hasPaidPlan: boolean;
  initialStatus: ConnectStatus;
};

export function StripeConnectCard({ hasPaidPlan, initialStatus }: Props) {
  const [status, setStatus] = useState<ConnectStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStartOnboarding() {
    setError(null);
    setLoading(true);
    try {
      // Create account if needed
      const createRes = await fetch('/api/stripe/connect/create-account', { method: 'POST' });
      const createData = await createRes.json().catch(() => ({}));
      if (!createRes.ok) {
        setError(createData.error || 'Could not create Stripe account');
        return;
      }

      // Get onboarding link
      const linkRes = await fetch('/api/stripe/connect/account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'account_onboarding' }),
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) {
        setError(linkData.error || 'Could not generate onboarding link');
        return;
      }
      if (linkData.url) {
        window.location.href = linkData.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleRefreshStatus() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/status');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not retrieve status');
        return;
      }
      setStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  async function handleContinueOnboarding() {
    setError(null);
    setLoading(true);
    try {
      const linkRes = await fetch('/api/stripe/connect/account-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'account_onboarding' }),
      });
      const linkData = await linkRes.json().catch(() => ({}));
      if (!linkRes.ok) {
        setError(linkData.error || 'Could not generate onboarding link');
        return;
      }
      if (linkData.url) {
        window.location.href = linkData.url;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (!hasPaidPlan) {
    return (
      <section id="selling" className="scroll-mt-28 space-y-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-wine">
            Sell Your Work
          </h2>
          <p className="text-ink/60 font-serif text-sm mt-1">
            Accept payments directly on your creator site via Stripe.
          </p>
        </div>
        <UpgradePrompt
          featureName="Sell Your Work"
          description="List artworks for sale on your creator site. Buyers pay directly through Stripe — funds go straight to your account."
          source="settings_sell_your_work"
        />
      </section>
    );
  }

  const isFullyEnabled = status?.connected && status.charges_enabled;

  return (
    <section id="selling" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">
          Sell Your Work
        </h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Accept payments directly on your creator site. Stripe Connect ensures funds go straight to your bank.
        </p>
      </div>

      <Card className="border-wine/20 bg-parchment/60">
        <CardHeader>
          <div className="flex items-center gap-3">
            <ShoppingBag className="h-5 w-5 text-wine/60" />
            <div>
              <CardTitle className="font-display text-wine">Stripe Connect</CardTitle>
              <CardDescription className="font-serif">
                {isFullyEnabled
                  ? 'Your account is connected and ready to accept payments.'
                  : status?.connected
                  ? 'Your account is connected but onboarding is incomplete.'
                  : 'Connect a Stripe account to start selling.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isFullyEnabled && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Payments enabled
              </Badge>
            </div>
          )}

          {status?.connected && !status.charges_enabled && (
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <Badge className="bg-amber-100 text-amber-800 border-amber-200">
                Onboarding incomplete
              </Badge>
            </div>
          )}

          {status?.payouts_enabled && (
            <p className="text-sm text-ink/70 font-serif">
              Payouts to your bank are enabled.
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {!status?.connected && (
              <Button
                onClick={handleStartOnboarding}
                disabled={loading}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Connect Stripe Account
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </Button>
            )}

            {status?.connected && !status.charges_enabled && (
              <Button
                onClick={handleContinueOnboarding}
                disabled={loading}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Complete Onboarding
                <ExternalLink className="h-3.5 w-3.5 ml-2" />
              </Button>
            )}

            {status?.connected && (
              <Button
                onClick={handleRefreshStatus}
                disabled={loading}
                variant="outline"
                className="font-serif border-wine/30"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Refresh Status
              </Button>
            )}
          </div>

          {isFullyEnabled && (
            <p className="text-xs text-ink/50 font-serif">
              To list an artwork for sale, go to{' '}
              <Link href="/artworks" className="underline">
                your artworks
              </Link>{' '}
              and edit the Sales settings on each work.
            </p>
          )}

          {error && (
            <p className="text-sm text-red-600 font-serif">{error}</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

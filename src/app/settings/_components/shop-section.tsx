'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@kit/ui/card';
import { Button } from '@kit/ui/button';
import { Badge } from '@kit/ui/badge';
import { AlertCircle, CheckCircle, Loader2, Store } from 'lucide-react';
import { loadConnectAndInitialize } from '@stripe/connect-js';
import { ConnectAccountOnboarding, ConnectComponentsProvider } from '@stripe/react-connect-js';

export type ShopEarning = {
  id: string;
  artwork_title: string | null;
  gross_cents: number;
  platform_fee_cents: number;
  stripe_fee_cents: number;
  net_cents: number;
  currency: string;
  status: 'pending' | 'held' | 'transferred' | 'reversed';
  release_at: string;
  created_at: string;
};

type Props = {
  shopOpen: boolean;
  payoutsEnabled: boolean;
  earnings: ShopEarning[];
  feePercent: number;
  holdDays: number;
  site: { url: string | null; published: boolean } | null;
};

function money(cents: number, currency = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(
    cents / 100,
  );
}

const STATUS_LABEL: Record<ShopEarning['status'], string> = {
  pending: 'Pending',
  held: 'On hold',
  transferred: 'Paid out',
  reversed: 'Refunded',
};

export function ShopSection({ shopOpen: initialOpen, payoutsEnabled: initialPayouts, earnings, feePercent, holdDays, site }: Props) {
  const router = useRouter();
  const [shopOpen, setShopOpen] = useState(initialOpen);
  const [payoutsEnabled, setPayoutsEnabled] = useState(initialPayouts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectInstance, setConnectInstance] = useState<ReturnType<typeof loadConnectAndInitialize> | null>(
    null,
  );

  const waitingCents = earnings
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.net_cents, 0);
  const heldCents = earnings.filter((e) => e.status === 'held').reduce((s, e) => s + e.net_cents, 0);
  const paidCents = earnings.filter((e) => e.status === 'transferred').reduce((s, e) => s + e.net_cents, 0);

  async function openShop() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/create-account', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not open your shop');
        return;
      }
      setShopOpen(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  function startPayoutDetails() {
    setError(null);
    const pk = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    if (!pk) {
      setError('Payments are not configured.');
      return;
    }
    setConnectInstance(
      loadConnectAndInitialize({
        publishableKey: pk,
        fetchClientSecret: async () => {
          const res = await fetch('/api/stripe/connect/account-session', { method: 'POST' });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data.client_secret) throw new Error(data.error || 'Could not load payout form');
          return data.client_secret as string;
        },
        appearance: { variables: { colorPrimary: '#6b1f2a', fontFamily: 'Georgia, serif' } },
      }),
    );
  }

  async function finishPayoutDetails() {
    setConnectInstance(null);
    setLoading(true);
    try {
      const res = await fetch('/api/stripe/connect/status');
      const data = await res.json().catch(() => ({}));
      if (res.ok) setPayoutsEnabled(!!data.payouts_enabled);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section id="shop" className="scroll-mt-28 space-y-6">
      <div>
        <h2 className="text-2xl font-display font-bold text-wine">Shop</h2>
        <p className="text-ink/60 font-serif text-sm mt-1">
          Sell your work on Provenance. Buyers pay us by card, and we send you the money. You don&apos;t need
          a plan or a payment account.
        </p>
      </div>

      {!shopOpen ? (
        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Store className="h-5 w-5 text-wine/60" />
              <div>
                <CardTitle className="font-display text-wine">Open your shop</CardTitle>
                <CardDescription className="font-serif">
                  Put a price on any work and a Buy button appears on your site. We keep {feePercent}% plus
                  card processing (about 2.9% + 30¢), and the rest is yours.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Button
              onClick={openShop}
              disabled={loading}
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Open shop
            </Button>
            {error && <p className="text-sm text-red-600 font-serif mt-3">{error}</p>}
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="border-wine/20 bg-parchment/60">
            <CardHeader>
              <div className="flex items-center gap-3">
                <Store className="h-5 w-5 text-wine/60" />
                <div>
                  <CardTitle className="font-display text-wine">Your shop is open</CardTitle>
                  <CardDescription className="font-serif">
                    Put a price on a work from its edit page to list it. Buyers check out on your site.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 font-serif text-sm">
              {site?.published && site.url ? (
                <p>
                  Your site:{' '}
                  <a href={site.url} target="_blank" rel="noreferrer" className="underline text-wine">
                    {site.url.replace(/^https?:\/\//, '')}
                  </a>{' '}
                  · <Link href="/profile/site" className="underline">Edit site</Link>
                </p>
              ) : (
                <p>
                  Buyers buy from your site.{' '}
                  <Link href="/profile/site" className="underline text-wine">
                    Publish your site
                  </Link>{' '}
                  and choose the Shopfront template to show prices up front.
                </p>
              )}
              <p className="text-ink/60">
                We keep {feePercent}% plus card processing (about 2.9% + 30¢). Money is sent {holdDays} days
                after a sale, which leaves time to resolve problems with an order.
              </p>
            </CardContent>
          </Card>

          <Card className="border-wine/20 bg-parchment/60">
            <CardHeader>
              <CardTitle className="font-display text-wine">Payouts</CardTitle>
              <CardDescription className="font-serif">
                {payoutsEnabled
                  ? 'Your bank details are set. Payouts go to your bank automatically.'
                  : 'Add your name, date of birth and bank account so we can send you money. US law requires these details. You only need them once you’ve made a sale.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!payoutsEnabled && waitingCents > 0 && !connectInstance && (
                <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-serif text-amber-900">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  {money(waitingCents)} is waiting for you. Add payout details to receive it.
                </div>
              )}

              {payoutsEnabled && !connectInstance && (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <Badge className="bg-green-100 text-green-800 border-green-200">Payouts on</Badge>
                </div>
              )}

              {connectInstance ? (
                <ConnectComponentsProvider connectInstance={connectInstance}>
                  <ConnectAccountOnboarding onExit={finishPayoutDetails} />
                </ConnectComponentsProvider>
              ) : (
                <Button
                  onClick={startPayoutDetails}
                  disabled={loading}
                  variant={payoutsEnabled ? 'outline' : 'default'}
                  className={
                    payoutsEnabled
                      ? 'font-serif border-wine/30'
                      : 'bg-wine text-parchment hover:bg-wine/90 font-serif'
                  }
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {payoutsEnabled ? 'Update payout details' : 'Add payout details'}
                </Button>
              )}
              {error && <p className="text-sm text-red-600 font-serif">{error}</p>}
            </CardContent>
          </Card>

          <Card className="border-wine/20 bg-parchment/60">
            <CardHeader>
              <CardTitle className="font-display text-wine">Earnings</CardTitle>
              <CardDescription className="font-serif">
                {money(waitingCents)} pending · {money(paidCents)} paid out
                {heldCents > 0 ? ` · ${money(heldCents)} on hold` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {earnings.length === 0 ? (
                <p className="text-sm text-ink/60 font-serif">No sales yet.</p>
              ) : (
                <ul className="divide-y divide-wine/10 font-serif text-sm">
                  {earnings.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-ink">{e.artwork_title ?? 'Artwork'}</p>
                        <p className="text-xs text-ink/50">
                          {new Date(e.created_at).toLocaleDateString()} · sold for {money(e.gross_cents, e.currency)}{' '}
                          − {money(e.platform_fee_cents + e.stripe_fee_cents, e.currency)} fees
                          {e.status === 'pending'
                            ? ` · pays out from ${new Date(e.release_at).toLocaleDateString()}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-ink">{money(e.net_cents, e.currency)}</span>
                        <Badge variant="outline" className="border-wine/20 text-xs">
                          {STATUS_LABEL[e.status]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </section>
  );
}

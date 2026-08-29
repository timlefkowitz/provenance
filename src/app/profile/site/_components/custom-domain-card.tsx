'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Globe,
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Trash2,
  ChevronDown,
  Search,
  ShoppingCart,
} from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';
import {
  attachCustomDomainAction,
  pollCustomDomainVerification,
} from '../_actions/attach-custom-domain';
import { removeCustomDomainAction } from '../_actions/remove-custom-domain';
import { searchDomainAvailabilityAction } from '../_actions/search-domain-availability';
import { openExternalCheckout } from '~/lib/capacitor/open-external-checkout';

type DomainSearchResult = {
  tld: string;
  domain: string;
  available: boolean;
  definitive: boolean;
  priceUsdCents: number | null;
  renewalPriceUsdCents: number | null;
  periodYears: number | null;
};

function formatUsdFromCents(cents: number | null): string {
  if (cents == null) return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

type Props = {
  profileId: string;
  hasActiveSubscription: boolean;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
  onDomainChange?: (domain: string | null, verifiedAt: string | null) => void;
};

export function CustomDomainCard({
  profileId,
  hasActiveSubscription,
  customDomain: initialDomain,
  customDomainVerifiedAt: initialVerifiedAt,
  onDomainChange,
}: Props) {
  const searchParams = useSearchParams();

  const [domainInput, setDomainInput] = useState('');
  const [customDomain, setCustomDomain] = useState(initialDomain);
  const [verifiedAt, setVerifiedAt] = useState(initialVerifiedAt);
  const [attaching, startAttach] = useTransition();
  const [checking, startCheck] = useTransition();
  const [removing, startRemove] = useTransition();

  const [buySectionOpen, setBuySectionOpen] = useState(false);
  const [searchLabel, setSearchLabel] = useState('');
  const [searchResults, setSearchResults] = useState<DomainSearchResult[]>([]);
  const [searching, startSearch] = useTransition();
  const [buyingDomain, setBuyingDomain] = useState<string | null>(null);

  const isVerified = Boolean(verifiedAt);
  const isPending = Boolean(customDomain && !verifiedAt);

  useEffect(() => {
    if (searchParams?.get('domain_purchased') === '1') {
      toast.success('Domain purchased! It may take a few minutes to become live.');
    }
    if (searchParams?.get('domain_canceled') === '1') {
      toast.info('Domain purchase canceled.');
    }
  }, [searchParams]);

  function handleAttach() {
    if (!domainInput.trim()) {
      toast.error('Enter a domain name first.');
      return;
    }

    startAttach(async () => {
      console.log('[CustomDomainCard] attach start', { profileId, domain: domainInput });
      const result = await attachCustomDomainAction(profileId, domainInput);
      if (!result.success) {
        console.error('[CustomDomainCard] attach failed', result.error);
        toast.error(result.error);
        return;
      }

      const attachedDomain = domainInput
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '');
      const verifiedNow = result.verified ? new Date().toISOString() : null;
      setCustomDomain(attachedDomain);
      setVerifiedAt(verifiedNow);
      setDomainInput('');
      onDomainChange?.(attachedDomain, verifiedNow);
      console.log('[CustomDomainCard] attach success', { verified: result.verified });
      toast.success(
        result.verified
          ? 'Domain connected and verified!'
          : 'Domain added — configure DNS below, then check status.',
      );
    });
  }

  function handleCheckStatus() {
    startCheck(async () => {
      console.log('[CustomDomainCard] poll verification', { profileId });
      const result = await pollCustomDomainVerification(profileId);
      if (result.verified) {
        const now = new Date().toISOString();
        setVerifiedAt(now);
        onDomainChange?.(customDomain, now);
        toast.success('Domain verified! Your site is live on your custom domain.');
        return;
      }
      if ('pending' in result && result.pending) {
        toast.info('Still waiting on DNS — this can take up to 48 hours.');
        return;
      }
      toast.error('error' in result ? result.error : 'Verification failed.');
    });
  }

  function handleRemove() {
    startRemove(async () => {
      console.log('[CustomDomainCard] remove start', { profileId });
      const result = await removeCustomDomainAction(profileId);
      if (!result.success) {
        console.error('[CustomDomainCard] remove failed', result.error);
        toast.error(result.error);
        return;
      }
      setCustomDomain(null);
      setVerifiedAt(null);
      onDomainChange?.(null, null);
      toast.success('Custom domain removed.');
    });
  }

  function handleSearchDomains() {
    if (!searchLabel.trim()) {
      toast.error('Enter a name to search.');
      return;
    }

    startSearch(async () => {
      console.log('[CustomDomainCard] search start', { label: searchLabel });
      const result = await searchDomainAvailabilityAction(searchLabel);
      if (!result.success) {
        console.error('[CustomDomainCard] search failed', result.error);
        toast.error(result.error);
        return;
      }
      setSearchResults(result.results);
      console.log('[CustomDomainCard] search success', {
        count: result.results.length,
        available: result.results.filter((r) => r.available).length,
      });
    });
  }

  async function handleBuyDomain(result: DomainSearchResult) {
    if (!result.available || result.priceUsdCents == null) return;

    setBuyingDomain(result.domain);
    try {
      console.log('[CustomDomainCard] buy start', {
        profileId,
        domain: result.domain,
        priceUsdCents: result.priceUsdCents,
      });

      const res = await fetch('/api/stripe/create-domain-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profileId,
          domain: result.domain,
          priceUsdCents: result.priceUsdCents,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error('[CustomDomainCard] buy failed', data.error);
        toast.error(data.error || 'Could not start checkout');
        return;
      }

      if (data.url) {
        await openExternalCheckout(data.url);
      } else {
        toast.error('Invalid checkout response');
      }
    } catch (err) {
      console.error('[CustomDomainCard] buy error', err);
      toast.error('Something went wrong starting checkout.');
    } finally {
      setBuyingDomain(null);
    }
  }

  if (!hasActiveSubscription) {
    return (
      <section className="rounded-xl border border-wine/15 bg-gradient-to-br from-wine/5 via-parchment/40 to-amber-50/30 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-wine/10 p-2 shrink-0">
            <Lock className="h-4 w-4 text-wine" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-semibold text-ink font-serif mb-1">
              Custom domain
            </h2>
            <p className="text-xs text-ink/55 font-serif leading-relaxed mb-4">
              Connect your own domain (e.g.{' '}
              <span className="font-medium text-ink">yourname.com</span>) or buy one
              directly — and remove Provenance branding from your site.
            </p>
            <Button
              asChild
              size="sm"
              className="bg-wine text-parchment hover:bg-wine/90 font-serif"
            >
              <Link href="/subscription">Upgrade to unlock</Link>
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-wine/15 bg-white/60 p-5">
      <div className="flex items-center gap-2 mb-1">
        <Globe className="h-4 w-4 text-wine" />
        <h2 className="text-sm font-semibold text-ink font-serif">Custom domain</h2>
      </div>
      <p className="text-xs text-ink/50 font-serif mb-4">
        Connect a domain you already own, or search and buy one here. Your site will be
        white-label with no Provenance navbar or footer.
      </p>

      {customDomain ? (
        <div className="space-y-4">
          <div
            className={cn(
              'flex items-center gap-2 rounded-lg border px-3.5 py-2.5',
              isVerified
                ? 'border-green-200 bg-green-50/60'
                : 'border-amber-200 bg-amber-50/60',
            )}
          >
            {isVerified ? (
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink font-serif truncate">
                {customDomain}
              </p>
              <p className="text-[11px] text-ink/55 font-serif">
                {isVerified ? 'Connected and verified' : 'Waiting for DNS verification'}
              </p>
            </div>
          </div>

          {isPending && (
            <div className="rounded-lg border border-wine/10 bg-parchment/30 p-4 space-y-3">
              <p className="text-xs font-semibold text-ink font-serif">DNS setup</p>
              <p className="text-[11px] text-ink/60 font-serif leading-relaxed">
                Add a <strong>CNAME</strong> record at your domain registrar:
              </p>
              <div className="rounded-md bg-white border border-wine/10 px-3 py-2 font-mono text-xs text-ink/80">
                <div className="flex justify-between gap-4">
                  <span className="text-ink/50">Host</span>
                  <span>@ or www</span>
                </div>
                <div className="flex justify-between gap-4 mt-1">
                  <span className="text-ink/50">Points to</span>
                  <span>cname.vercel-dns.com</span>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleCheckStatus}
                disabled={checking}
                className="font-serif"
              >
                {checking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    Checking…
                  </>
                ) : (
                  'Check verification status'
                )}
              </Button>
            </div>
          )}

          {isVerified && (
            <a
              href={`https://${customDomain}`}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-xs text-wine underline underline-offset-2 font-serif hover:text-wine/70"
            >
              Visit {customDomain} →
            </a>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleRemove}
            disabled={removing}
            className="font-serif text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            {removing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            )}
            Remove domain
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-3">
            <p className="text-[11px] uppercase tracking-widest text-ink/45 font-serif font-semibold">
              Connect existing domain
            </p>
            <div className="flex gap-2">
              <Input
                value={domainInput}
                onChange={(e) => setDomainInput(e.target.value)}
                placeholder="yourname.com"
                className="font-serif flex-1"
                disabled={attaching}
              />
              <Button
                type="button"
                onClick={handleAttach}
                disabled={attaching || !domainInput.trim()}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0"
              >
                {attaching ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Connect'
                )}
              </Button>
            </div>
          </div>

          <div className="border-t border-wine/10 pt-4">
            <button
              type="button"
              onClick={() => setBuySectionOpen((o) => !o)}
              className="flex w-full items-center justify-between gap-2 text-left"
            >
              <span className="text-[11px] uppercase tracking-widest text-ink/45 font-serif font-semibold">
                Don&apos;t have a domain yet?
              </span>
              <ChevronDown
                className={cn(
                  'h-4 w-4 text-ink/40 transition-transform',
                  buySectionOpen && 'rotate-180',
                )}
              />
            </button>

            {buySectionOpen && (
              <div className="mt-3 space-y-3">
                <p className="text-xs text-ink/55 font-serif">
                  Search for an available name and buy it through Provenance. DNS is
                  configured automatically.
                </p>
                <div className="flex gap-2">
                  <Input
                    value={searchLabel}
                    onChange={(e) => setSearchLabel(e.target.value)}
                    placeholder="janesmith"
                    className="font-serif flex-1"
                    disabled={searching}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSearchDomains();
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSearchDomains}
                    disabled={searching || !searchLabel.trim()}
                    className="font-serif shrink-0"
                  >
                    {searching ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Search className="h-3.5 w-3.5 mr-1.5" />
                        Search
                      </>
                    )}
                  </Button>
                </div>

                {searching && (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-10 rounded-lg bg-wine/5 animate-pulse"
                      />
                    ))}
                  </div>
                )}

                {!searching && searchResults.length > 0 && (
                  <div className="rounded-lg border border-wine/10 overflow-hidden divide-y divide-wine/10">
                    {searchResults.map((result) => (
                      <div
                        key={result.domain}
                        className={cn(
                          'flex items-center justify-between gap-3 px-3 py-2.5',
                          !result.available && 'opacity-50 bg-ink/2',
                        )}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink font-serif truncate">
                            {result.domain}
                          </p>
                          <p className="text-[10px] text-ink/50 font-serif">
                            {result.available
                              ? `${formatUsdFromCents(result.priceUsdCents)}/yr`
                              : 'Unavailable'}
                          </p>
                        </div>
                        {result.available && result.priceUsdCents != null ? (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleBuyDomain(result)}
                            disabled={buyingDomain === result.domain}
                            className="bg-wine text-parchment hover:bg-wine/90 font-serif shrink-0"
                          >
                            {buyingDomain === result.domain ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <>
                                <ShoppingCart className="h-3.5 w-3.5 mr-1" />
                                Buy
                              </>
                            )}
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

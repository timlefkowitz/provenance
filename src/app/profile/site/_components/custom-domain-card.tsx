'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Globe, Lock, Loader2, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import { toast } from '@kit/ui/sonner';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { cn } from '@kit/ui/utils';
import {
  attachCustomDomainAction,
  pollCustomDomainVerification,
} from '../_actions/attach-custom-domain';
import { removeCustomDomainAction } from '../_actions/remove-custom-domain';

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
  const [domainInput, setDomainInput] = useState('');
  const [customDomain, setCustomDomain] = useState(initialDomain);
  const [verifiedAt, setVerifiedAt] = useState(initialVerifiedAt);
  const [attaching, startAttach] = useTransition();
  const [checking, startCheck] = useTransition();
  const [removing, startRemove] = useTransition();

  const isVerified = Boolean(verifiedAt);
  const isPending = Boolean(customDomain && !verifiedAt);

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
              <span className="font-medium text-ink">yourname.com</span>) and remove
              Provenance branding from your site.
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
        Point your own domain to your Provenance site. Your site will be white-label
        with no Provenance navbar or footer.
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
              <p className="text-[10px] text-ink/45 font-serif">
                For apex domains (no www), your registrar may require an A record —
                check Vercel&apos;s domain settings after connecting.
              </p>
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
        <div className="space-y-3">
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
          <p className="text-[10px] text-ink/45 font-serif">
            You&apos;ll need access to your domain&apos;s DNS settings at your registrar.
          </p>
        </div>
      )}
    </section>
  );
}

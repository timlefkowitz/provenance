'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { Button } from '@kit/ui/button';

export interface UpgradePromptProps {
  /** Short feature name shown in the heading, e.g. "Grants" */
  featureName: string;
  /** One-sentence description of what they unlock */
  description?: string;
  /** Optional href override for the CTA — defaults to /subscription */
  ctaHref?: string;
  /** Optional CTA label — defaults to "Upgrade to unlock" */
  ctaLabel?: string;
  /** Context for which prompt converted (retained for potential future analytics) */
  source: string;
}

/**
 * Drop-in upgrade prompt for subscription-gated feature pages.
 */
export function UpgradePrompt({
  featureName,
  description,
  ctaHref = '/subscription',
  ctaLabel = 'Upgrade to unlock',
}: UpgradePromptProps) {
  return (
    <div className="rounded-xl border border-wine/20 bg-wine/5 px-6 py-8 text-center max-w-xl">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-wine/10">
        <Zap className="h-6 w-6 text-wine" aria-hidden />
      </div>

      <h2 className="font-display text-xl font-semibold text-wine">
        {featureName} is a paid feature
      </h2>

      {description && (
        <p className="mt-2 font-serif text-sm text-ink/70">{description}</p>
      )}

      <p className="mt-3 font-serif text-sm text-ink/70">
        Certificates are free forever. Upgrade to unlock{' '}
        <strong>Grants, CRM, Open Calls, Operations, and your own artist website</strong>{' '}
        — starting at $10/month, or save ~2 months with an annual plan.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="gap-2">
          <Link href={ctaHref}>{ctaLabel}</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/subscription?interval=year">See annual pricing</Link>
        </Button>
      </div>

      <p className="mt-4 font-serif text-xs text-ink/50">
        Cancel anytime · No hidden fees
      </p>
    </div>
  );
}

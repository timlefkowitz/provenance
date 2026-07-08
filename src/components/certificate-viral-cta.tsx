'use client';

import Link from 'next/link';
import { Shield, ArrowRight } from 'lucide-react';
import { Button } from '@kit/ui/button';

interface CertificateViralCtaProps {
  artworkTitle?: string | null;
  artistName?: string | null;
}

/**
 * Acquisition surface displayed at the bottom of every public certificate page
 * for visitors who are not signed in. Encourages them to create their own
 * certificate on Provenance (artist growth loop) or claim this one (collector loop).
 */
export function CertificateViralCta({}: CertificateViralCtaProps) {
  return (
    <div className="mt-12 rounded-xl border border-wine/20 bg-gradient-to-br from-wine/5 to-stone-50 px-6 py-8 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-wine/10">
        <Shield className="h-6 w-6 text-wine" aria-hidden />
      </div>

      <h2 className="font-display text-xl font-semibold text-wine">
        Verified on Provenance
      </h2>

      <p className="mt-2 font-serif text-sm text-ink/70">
        Provenance is the trusted platform for artists, galleries, and collectors to
        authenticate, track, and share art. Certificates are free — forever.
      </p>

      <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="gap-2">
          <Link href="/auth/sign-up">
            Create your free certificate
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>

        <Button asChild variant="outline">
          <Link href="/lp/artist">Learn more</Link>
        </Button>
      </div>

      <p className="mt-4 font-serif text-xs text-ink/50">
        No credit card required. Free certificates, always.
      </p>
    </div>
  );
}

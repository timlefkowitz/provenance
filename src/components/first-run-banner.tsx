'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { Sparkles } from 'lucide-react';

function FirstRunBannerInner() {
  const searchParams = useSearchParams();
  const isFirstRun = searchParams.get('first_run') === '1';

  if (!isFirstRun) return null;

  return (
    <div className="mb-6 rounded-lg border border-wine/30 bg-wine/5 px-5 py-4">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-wine" aria-hidden />
        <div>
          <p className="font-display text-sm font-semibold text-wine">
            Welcome — let&apos;s create your first certificate
          </p>
          <p className="mt-1 font-serif text-sm text-ink/70">
            Upload a photo of your work below and Provenance will generate a
            verified Certificate of Authenticity in seconds — free, forever.
            You can share it, embed it, and print it.
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Displays a welcoming first-run prompt when the user arrives from onboarding
 * (i.e. the URL contains ?first_run=1). Safe to drop anywhere on the add-artwork
 * page — renders nothing for returning users.
 */
export function FirstRunBanner() {
  return (
    <Suspense fallback={null}>
      <FirstRunBannerInner />
    </Suspense>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * Client wrapper for TrialBanner — handles per-session dismissal via
 * localStorage. The dismissKey is namespaced to the subscription row so that
 * if a new trial is ever issued, the user sees a fresh banner.
 */
export function TrialBannerClient({
  dismissKey,
  children,
}: {
  dismissKey: string;
  children: React.ReactNode;
}) {
  const [hidden, setHidden] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(dismissKey) === '1') {
      setHidden(true);
    }
  }, [dismissKey]);

  if (!mounted || hidden) return null;

  return (
    <div className="relative">
      {children}
      <button
        type="button"
        aria-label="Dismiss trial banner"
        className="absolute right-1 top-1/2 -translate-y-1/2 p-1 text-ink/50 hover:text-ink"
        onClick={() => {
          try {
            window.localStorage.setItem(dismissKey, '1');
          } catch {
            // ignore storage failures (private mode, etc.)
          }
          setHidden(true);
        }}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

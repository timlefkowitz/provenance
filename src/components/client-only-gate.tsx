'use client';

import { useState, useEffect } from 'react';

/**
 * Renders children only after the component has mounted on the client.
 * Server and first client paint render the same minimal shell, so we avoid
 * hydration mismatches (e.g. from browser extensions) and the subsequent
 * "more hooks than previous render" (#310) cascade.
 */
export function ClientOnlyGate({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div
        className="min-h-screen w-full bg-parchment"
        aria-hidden
        suppressHydrationWarning
      />
    );
  }

  return <>{children}</>;
}

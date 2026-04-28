'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Hides children on /admin/* so the dark dashboard shell is not overlaid with
 * parchment marketing UI (trial banner, streaks, etc.). Matches Navigation’s
 * /admin hide so client-side route transitions stay consistent.
 */
export function ShowUnlessAdmin({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) {
    return null;
  }
  return <>{children}</>;
}

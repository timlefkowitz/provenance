'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAppMode } from '~/lib/app-mode';
import { isInternalUrl, toRouterPath } from '~/lib/app-links';

/**
 * Keeps in-app navigation inside the app shell.
 *
 * In the Capacitor wrapper a `target="_blank"` link or `window.open()` call is
 * handed to the system browser, ejecting the user into Safari (address bar and
 * all). This intercepts those for our own URLs and navigates in place instead.
 * Off-domain destinations are left alone so Stripe checkout and social share
 * dialogs still open in the system browser where they belong.
 *
 * No-op in a regular browser, where new tabs work fine and are expected.
 */
export function AppLinkInterceptor() {
  const router = useRouter();

  useEffect(() => {
    if (!isAppMode()) return;

    function navigateInApp(href: string) {
      const path = toRouterPath(href);
      if (path) {
        router.push(path);
      } else {
        // Different Provenance host (e.g. an artist subdomain) — needs a real load.
        window.location.assign(href);
      }
    }

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented) return;
      // Leave modifier-clicks to the browser.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.('a');
      if (!anchor) return;

      // Only new-window links get ejected to Safari; normal links already
      // navigate inside the webview.
      if (anchor.target !== '_blank') return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      if (!isInternalUrl(href)) return;

      event.preventDefault();
      console.log('[AppLinks] keeping internal link in app shell', href);
      navigateInApp(href);
    }

    document.addEventListener('click', onClick, true);

    // window.open() with an internal URL would also escape to Safari. Only
    // non-empty internal URLs are intercepted, so the print/QR flows that call
    // window.open('') to write a document keep their original behavior.
    const originalOpen = window.open;
    window.open = function patchedOpen(
      url?: string | URL,
      windowTarget?: string,
      features?: string,
    ): Window | null {
      const href = typeof url === 'string' ? url : url?.toString();

      if (href && isInternalUrl(href)) {
        console.log('[AppLinks] redirecting window.open into app shell', href);
        navigateInApp(href);
        return null;
      }

      return originalOpen.call(window, url as string, windowTarget as string, features);
    } as typeof window.open;

    return () => {
      document.removeEventListener('click', onClick, true);
      window.open = originalOpen;
    };
  }, [router]);

  return null;
}

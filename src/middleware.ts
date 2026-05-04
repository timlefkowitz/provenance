import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddlewareClient } from '@kit/supabase/middleware-client';
import { RESERVED_SITE_HANDLES } from '~/lib/gallery-public-slug';

export const config = {
  matcher: [
    /*
     * Skip static assets, API, and SEO files so crawlers (e.g. Google Search Console)
     * never depend on middleware + Supabase for /sitemap.xml or /robots.txt.
     */
    '/((?!_next/static|_next/image|images|locales|assets|api/|sitemap\\.xml|robots\\.txt|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)',
  ],
};

// Strip www. so flight.provenance.guru is detected correctly even when
// NEXT_PUBLIC_SITE_URL is set to https://www.provenance.guru
const MAIN_HOSTNAME = (() => {
  const raw = process.env.NEXT_PUBLIC_SITE_URL;
  if (!raw) return 'provenance.guru';
  const h = new URL(raw).hostname;
  return h.startsWith('www.') ? h.slice(4) : h;
})();

/**
 * Detect a creator-site subdomain request.
 * Returns the subdomain handle (e.g. "jane-doe") or null if this is a main-app request.
 *
 * Handles:
 *  - <handle>.provenance.app          (production)
 *  - <handle>.localhost:3000           (local dev, set NEXT_PUBLIC_SITE_URL=http://localhost:3000)
 */
function getSiteHandle(request: NextRequest): string | null {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0]; // strip port

  // Extract subdomain from the main hostname
  if (!hostname.endsWith(`.${MAIN_HOSTNAME}`) && !hostname.endsWith('.localhost')) {
    // Could be a custom domain (v1.5) — handled by the site layout via x-site-handle
    // For now, pass through; custom domain lookup happens at the page level.
    return null;
  }

  const subdomain = hostname.endsWith('.localhost')
    ? hostname.replace('.localhost', '')
    : hostname.replace(`.${MAIN_HOSTNAME}`, '');

  if (!subdomain || RESERVED_SITE_HANDLES.has(subdomain.toLowerCase())) {
    return null;
  }

  // Basic format check: a-z, 0-9, hyphens only (mirrors validateSiteHandle)
  if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(subdomain) && subdomain.length > 1) {
    return null;
  }

  return subdomain.toLowerCase();
}

export async function middleware(request: NextRequest) {
  const siteHandle = getSiteHandle(request);

  // ── Creator-site subdomain rewrite ────────────────────────────────────────
  // Rewrite <handle>.provenance.app/path → /_sites/<handle>/path on the same
  // deployment, so the chromeless site layout takes over without a redirect.
  if (siteHandle) {
    const url = request.nextUrl.clone();
    const originalPath = url.pathname;
    url.pathname = `/_sites/${siteHandle}${originalPath === '/' ? '' : originalPath}`;

    const rewriteResponse = NextResponse.rewrite(url);
    rewriteResponse.headers.set('x-site-handle', siteHandle);
    // Pass original host through so canonical URLs can be built server-side
    rewriteResponse.headers.set('x-forwarded-host', request.headers.get('host') || '');
    return rewriteResponse;
  }

  // ── Main-app request ───────────────────────────────────────────────────────
  const response = NextResponse.next();

  // Prefer HTTPS in production (Vercel already redirects HTTP→HTTPS; this adds HSTS)
  if (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }

  // Baseline security headers applied to all non-static, non-API routes
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    // geolocation=(self) allows our own pages to prompt for GPS (QR scan tracking).
    // All other high-risk features remain blocked.
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  );
  // The site preview route is intentionally embedded same-origin in the editor iframe.
  // Relax X-Frame-Options and frame-ancestors for that route only.
  const pathname = request.nextUrl.pathname;
  const isPreviewRoute = pathname.startsWith('/profile/site/preview');

  response.headers.set('X-Frame-Options', isPreviewRoute ? 'SAMEORIGIN' : 'DENY');

  // Content-Security-Policy: restrict script/style/resources. Next.js and Supabase require specific allowances.
  const cspDirectives = [
    "default-src 'self'",
    // Next.js / React hydration + Google Tag Manager container and ads scripts
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.googletagmanager.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    // Supabase, Vercel analytics, Google Analytics / Ads measurement endpoints
    "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.bigdatacloud.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://stats.g.doubleclick.net",
    // Google Ads remarketing iframes (Floodlight / DoubleClick)
    "frame-src 'self' https://bid.g.doubleclick.net https://td.doubleclick.net",
    // Preview route: allow same-origin embedding. All other routes deny framing entirely.
    isPreviewRoute ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];
  response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

  try {
    const supabase = createMiddlewareClient(request, response);
    await supabase.auth.getUser();
  } catch (error) {
    // If Supabase connection fails (e.g., invalid env vars), log but don't crash
    // This allows the app to still function even if Supabase is misconfigured
    console.error('Middleware Supabase error:', error);
  }

  // Pass pathname to layout via headers for conditional checks
  response.headers.set('x-pathname', request.nextUrl.pathname);

  return response;
}

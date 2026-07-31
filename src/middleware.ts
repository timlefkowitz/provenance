import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddlewareClient } from '@kit/supabase/middleware-client';
import { getPlanetFromHost } from '@provenance/core/types';
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

/** Short-lived cache for custom-domain → handle lookups in middleware */
const customDomainCache = new Map<string, { handle: string | null; expiresAt: number }>();
const CUSTOM_DOMAIN_CACHE_TTL_MS = 60_000;

/**
 * Resolve a published site handle from a custom domain hostname.
 * Uses Supabase REST with the anon key — published sites are publicly readable via RLS.
 */
async function lookupHandleByCustomDomain(hostname: string): Promise<string | null> {
  const normalized = hostname.toLowerCase().replace(/^www\./, '');

  const cached = customDomainCache.get(normalized);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.handle;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    console.error('[Sites] middleware custom domain lookup: missing Supabase env');
    return null;
  }

  try {
    const url = new URL(`${supabaseUrl}/rest/v1/profile_sites`);
    url.searchParams.set('custom_domain', `eq.${normalized}`);
    url.searchParams.set('published_at', 'not.is.null');
    url.searchParams.set('select', 'handle');
    url.searchParams.set('limit', '1');

    const res = await fetch(url.toString(), {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });

    if (!res.ok) {
      console.error('[Sites] middleware custom domain lookup failed', res.status);
      return null;
    }

    const rows = (await res.json()) as { handle?: string }[];
    const handle = rows[0]?.handle?.toLowerCase() ?? null;
    customDomainCache.set(normalized, {
      handle,
      expiresAt: Date.now() + CUSTOM_DOMAIN_CACHE_TTL_MS,
    });
    return handle;
  } catch (err) {
    console.error('[Sites] middleware custom domain lookup error', err);
    return null;
  }
}

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

/**
 * When a planet subdomain (e.g. collc.provenance.guru) hits the main deployment,
 * rewrite to the matching app routes instead of the artworks homepage or a creator site.
 */
function getPlanetRewritePath(hostname: string, pathname: string): string | null {
  const planet = getPlanetFromHost(hostname);
  if (planet !== 'collectibles') {
    return null;
  }

  if (
    pathname.startsWith('/auth') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next')
  ) {
    return null;
  }

  if (pathname === '/') {
    return '/collectibles';
  }
  if (pathname.startsWith('/collectibles')) {
    return pathname;
  }
  return `/collectibles${pathname}`;
}

/**
 * Build the Content-Security-Policy header value for a given request context.
 *
 * Nonce-based script-src:
 * - The nonce is generated per-request and forwarded to Server Components via
 *   the x-nonce request header so the root layout can pass it to GoogleTagManager.
 * - 'strict-dynamic' lets nonce-trusted scripts dynamically inject further scripts
 *   (e.g. GTM loading gtm.js), making host allowlists progressive hardening.
 * - 'unsafe-eval' is intentionally omitted — no app code uses eval().
 *   Set NEXT_PUBLIC_CSP_ALLOW_EVAL=1 as a temporary escape hatch if a GTM tag
 *   relies on eval() while that container is being audited.
 *
 * Style-src 'unsafe-inline' is kept:
 * - React's inline style={} attributes cannot be nonce'd and are pervasive.
 * - Inline styles cannot execute script; this is an accepted, low-risk exception.
 */
function buildCsp(nonce: string, isPreview: boolean): string {
  const allowEval = process.env.NEXT_PUBLIC_CSP_ALLOW_EVAL === '1';
  const evalClause = allowEval ? " 'unsafe-eval'" : '';

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${evalClause} https://*.googletagmanager.com https://www.googletagmanager.com https://googleads.g.doubleclick.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://auth.provenance.guru https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.bigdatacloud.net https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://stats.g.doubleclick.net https://ad.doubleclick.net https://www.google.com https://googleads.g.doubleclick.net",
    "frame-src 'self' https://bid.g.doubleclick.net https://td.doubleclick.net",
    isPreview ? "frame-ancestors 'self'" : "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join('; ');
}

/** Apply the full baseline security headers to any response. */
function applySecurityHeaders(
  response: NextResponse,
  opts: { isProduction: boolean; isHttps: boolean; isPreview: boolean; nonce: string },
): void {
  const { isProduction, isHttps, isPreview, nonce } = opts;

  if (isProduction && isHttps) {
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(self), payment=(), usb=()',
  );
  response.headers.set('X-Frame-Options', isPreview ? 'SAMEORIGIN' : 'DENY');
  response.headers.set('Content-Security-Policy', buildCsp(nonce, isPreview));
}

export async function middleware(request: NextRequest) {
  const host = request.headers.get('host') || '';
  const hostname = host.split(':')[0];
  const pathname = request.nextUrl.pathname;
  const isProduction = process.env.NODE_ENV === 'production';
  const isHttps = request.nextUrl.protocol === 'https:';
  const isPreview = pathname.startsWith('/profile/site/preview');

  // Generate a cryptographically random per-request nonce for the CSP.
  // Buffer.from(uuid).toString('base64') is safe in Node/Edge; uuid contains only
  // hex and hyphens so base64-encoding it produces a URL-safe alphanumeric string.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // Forward the nonce to Server Components so they can pass it to GoogleTagManager.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  let siteHandle = getSiteHandle(request);

  // ── Custom domain rewrite ─────────────────────────────────────────────────
  if (!siteHandle && hostname && hostname !== MAIN_HOSTNAME && hostname !== `www.${MAIN_HOSTNAME}`) {
    siteHandle = await lookupHandleByCustomDomain(hostname);
    if (siteHandle) {
      console.log('[Sites] middleware custom domain resolved', { hostname, siteHandle });
    }
  }

  // ── Creator-site subdomain rewrite ────────────────────────────────────────
  // Rewrite <handle>.provenance.app/path → /_sites/<handle>/path on the same
  // deployment, so the chromeless site layout takes over without a redirect.
  // Now also applies full security headers including nonce-based CSP.
  if (siteHandle) {
    const url = request.nextUrl.clone();
    const originalPath = url.pathname;
    url.pathname = `/_sites/${siteHandle}${originalPath === '/' ? '' : originalPath}`;

    const rewriteResponse = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    rewriteResponse.headers.set('x-site-handle', siteHandle);
    // Pass original host through so canonical URLs can be built server-side
    rewriteResponse.headers.set('x-forwarded-host', request.headers.get('host') || '');
    applySecurityHeaders(rewriteResponse, { isProduction, isHttps, isPreview, nonce });
    return rewriteResponse;
  }

  // ── Planet subdomain on main deployment (e.g. collc.provenance.guru) ─────
  const planetPath = getPlanetRewritePath(hostname, pathname);
  if (planetPath) {
    const url = request.nextUrl.clone();
    url.pathname = planetPath;
    const response = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
    response.headers.set('x-pathname', planetPath);
    response.headers.set('x-forwarded-host', request.headers.get('host') || '');

    applySecurityHeaders(response, { isProduction, isHttps, isPreview, nonce });

    try {
      const supabase = createMiddlewareClient(request, response);
      await supabase.auth.getUser();
    } catch (error) {
      console.error('[Collectibles] middleware Supabase error:', error);
    }

    return response;
  }

  // ── Main-app request ───────────────────────────────────────────────────────
  const response = NextResponse.next({ request: { headers: requestHeaders } });

  applySecurityHeaders(response, { isProduction, isHttps, isPreview, nonce });

  try {
    const supabase = createMiddlewareClient(request, response);
    await supabase.auth.getUser();
  } catch (error) {
    // If Supabase connection fails (e.g., invalid env vars), log but don't crash
    console.error('Middleware Supabase error:', error);
  }

  // Pass pathname to layout via headers for conditional checks
  response.headers.set('x-pathname', pathname);

  return response;
}

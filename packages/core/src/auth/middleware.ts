import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPlanetFromHost, type Planet } from '../types/planet';

export interface PlanetMiddlewareOptions {
  /** If set, forces this planet regardless of hostname. Useful in dev. */
  forcePlanet?: Planet;
  /** Supabase middleware client factory (injected by the consuming app). */
  createMiddlewareClient?: (req: NextRequest, res: NextResponse) => { auth: { getUser: () => Promise<unknown> } };
}

/**
 * Build the Content-Security-Policy header value for a given request.
 *
 * Nonce-based script-src:
 * - A cryptographically random nonce is generated per request and forwarded
 *   to Next.js via the Content-Security-Policy *request* header (and x-nonce),
 *   so the framework nonces its own inline bootstrap scripts.
 * - 'strict-dynamic' lets nonce-trusted scripts inject further scripts.
 * - 'unsafe-inline' and 'unsafe-eval' are intentionally omitted from script-src.
 *
 * Style-src 'unsafe-inline' is kept: React inline style={} attributes cannot
 * be nonce'd and cannot execute script — an accepted, low-risk exception.
 */
function buildCsp(nonce: string): string {
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.bigdatacloud.net",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ];

  return directives.join('; ');
}

/**
 * Shared middleware logic for all planet apps.
 * Sets security headers (nonce-based CSP), resolves the active planet,
 * and refreshes the Supabase session.
 */
export function createPlanetMiddleware(options: PlanetMiddlewareOptions = {}) {
  return async function middleware(request: NextRequest) {
    const planet = options.forcePlanet ?? getPlanetFromHost(request.headers.get('host') ?? '');

    // Per-request CSP nonce. uuid contains only hex and hyphens, so its
    // base64 encoding is a safe nonce token in Node and Edge runtimes.
    const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
    const csp = buildCsp(nonce);

    // Forward the CSP + nonce on the *request* so Next.js applies the nonce
    // to its own inline scripts (per Next.js CSP guidance).
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);

    const response = NextResponse.next({ request: { headers: requestHeaders } });

    if (process.env.NODE_ENV === 'production' && request.nextUrl.protocol === 'https:') {
      response.headers.set(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Permissions-Policy',
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    );
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('Content-Security-Policy', csp);

    if (options.createMiddlewareClient) {
      try {
        const supabase = options.createMiddlewareClient(request, response);
        await supabase.auth.getUser();
      } catch (error) {
        console.error('[Core] Middleware Supabase error:', error);
      }
    }

    response.headers.set('x-pathname', request.nextUrl.pathname);
    response.headers.set('x-planet', planet);

    return response;
  };
}

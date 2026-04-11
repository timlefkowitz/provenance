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
 * Shared middleware logic for all planet apps.
 * Sets security headers, resolves the active planet, and refreshes the Supabase session.
 */
export function createPlanetMiddleware(options: PlanetMiddlewareOptions = {}) {
  return async function middleware(request: NextRequest) {
    const response = NextResponse.next();
    const planet = options.forcePlanet ?? getPlanetFromHost(request.headers.get('host') ?? '');

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

    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.bigdatacloud.net",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ];
    response.headers.set('Content-Security-Policy', cspDirectives.join('; '));

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

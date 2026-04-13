import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddlewareClient } from '@kit/supabase/middleware-client';

export const config = {
  matcher: [
    /*
     * Skip static assets, API, and SEO files so crawlers (e.g. Google Search Console)
     * never depend on middleware + Supabase for /sitemap.xml or /robots.txt.
     */
    '/((?!_next/static|_next/image|images|locales|assets|api/|sitemap\\.xml|robots\\.txt|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2)$).*)',
  ],
};

export async function middleware(request: NextRequest) {
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
    // Explicitly disable high‑risk browser features we do not rely on
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  response.headers.set('X-Frame-Options', 'DENY');

  // Content-Security-Policy: restrict script/style/resources. Next.js and Supabase require specific allowances.
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js / React hydration
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' data: https://*.supabase.co wss://*.supabase.co https://vitals.vercel-insights.com https://va.vercel-scripts.com https://api.bigdatacloud.net",
    "frame-ancestors 'none'",
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

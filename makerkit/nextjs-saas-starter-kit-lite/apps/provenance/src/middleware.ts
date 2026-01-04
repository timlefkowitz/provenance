import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createMiddlewareClient } from '@kit/supabase/middleware-client';

export const config = {
  matcher: ['/((?!_next/static|_next/image|images|locales|assets|api/*).*)'],
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();
  
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

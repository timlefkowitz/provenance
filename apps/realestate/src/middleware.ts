import type { NextRequest } from 'next/server';
import { createPlanetMiddleware } from '@provenance/core/auth/middleware';
import { createMiddlewareClient } from '@kit/supabase/middleware-client';

export const config = {
  matcher: ['/((?!_next/static|_next/image|images|locales|assets|api/*).*)'],
};

const handler = createPlanetMiddleware({
  forcePlanet: 'realestate',
  createMiddlewareClient: (req: NextRequest, res) =>
    createMiddlewareClient(req, res),
});

export async function middleware(request: NextRequest) {
  return handler(request);
}

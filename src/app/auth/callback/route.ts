import { asUntyped } from '~/lib/supabase-untyped';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { provisionNewUser } from '~/lib/auth/provision-new-user';


export async function GET(request: NextRequest) {
  // Diagnostic logging (temporary): confirms whether magic-link/OAuth clicks
  // are reaching this route at all, and whether a `code` param is present
  // (PKCE flow) — helps distinguish "email link never arrives" (this never
  // logs) from "link arrives but exchange fails" (logs, then errors below).
  console.log('[Auth/Callback] request received', {
    host: request.headers.get('host'),
    hasCode: request.nextUrl.searchParams.has('code'),
    hasError: request.nextUrl.searchParams.has('error'),
    next: request.nextUrl.searchParams.get('next'),
  });

  const supabaseClient = getSupabaseServerClient();
  const service = createAuthCallbackService(supabaseClient);

  const { nextPath } = await service.exchangeCodeForSession(request, {
    // Default post-sign-in destination — moved from `/portal` to `/artworks`
    // so users land directly in their collection.
    redirectPath: '/artworks',
  });

  // Provision trial + welcome email; detect new users for the GTM ?new_user=1 signal.
  const { data: { user } } = await asUntyped(supabaseClient).auth.getUser().catch(() => ({ data: { user: null } }));
  const { isNewUser } = user
    ? await provisionNewUser(user.id)
    : { isNewUser: false };

  // Always use the request origin to ensure we redirect to the correct domain
  // Extract just the pathname if nextPath contains a full URL (e.g., from Supabase redirect)
  const origin = request.nextUrl.origin;
  let pathToRedirect = nextPath;
  
  // If nextPath is a full URL, extract just the pathname
  try {
    const url = new URL(nextPath);
    pathToRedirect = url.pathname + url.search;
  } catch {
    // nextPath is already just a path, use it as-is
    pathToRedirect = nextPath;
  }

  // Guard against open redirects (CASA 5.1.2 / CWE-601): the `next` param on this
  // route comes straight from the query string via @kit/supabase's auth callback
  // service. The block above strips the host from full absolute URLs
  // (e.g. `https://evil.com/x` -> `/x`), but protocol-relative URLs like
  // `//evil.com/x` fail the `new URL(nextPath)` parse (no base), fall into the
  // catch, and are used as-is. `new URL('//evil.com/x', origin)` then resolves
  // to `https://evil.com/x` because a leading `//` is a network-path reference
  // that takes over the host from `origin`. Reject anything that isn't a
  // same-origin, single-leading-slash path before building the redirect.
  if (!pathToRedirect.startsWith('/') || pathToRedirect.startsWith('//') || pathToRedirect.startsWith('/\\')) {
    console.warn('[Auth] Rejected unsafe post-login redirect target', { nextPath });
    pathToRedirect = '/artworks';
  }

  const redirectUrl = new URL(pathToRedirect, origin);

  if (isNewUser) {
    redirectUrl.searchParams.set('new_user', '1');
    console.log('[GTM] New user detected — appending ?new_user=1 to redirect');
  }

  return NextResponse.redirect(redirectUrl);
}

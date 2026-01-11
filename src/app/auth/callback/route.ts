import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { createAuthCallbackService } from '@kit/supabase/auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { sendWelcomeEmail } from '~/lib/email';

import pathsConfig from '~/config/paths.config';

export async function GET(request: NextRequest) {
  const service = createAuthCallbackService(getSupabaseServerClient());
  const client = getSupabaseServerClient();

  const { nextPath } = await service.exchangeCodeForSession(request, {
    redirectPath: pathsConfig.app.home,
  });

  // Check if this is a new user and send welcome email
  try {
    const { data: { user } } = await client.auth.getUser();
    
    if (user) {
      // Check if account was created in the last 2 minutes (to catch new sign-ups)
      const { data: account } = await client
        .from('accounts')
        .select('email, name, created_at')
        .eq('id', user.id)
        .single();

      if (account?.email && account.created_at) {
        const createdAt = new Date(account.created_at);
        const now = new Date();
        const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

        // If account was created in the last 2 minutes, send welcome email
        if (minutesSinceCreation < 2) {
          const userName = account.name || account.email.split('@')[0] || 'there';
          
          // Send email asynchronously (don't block the redirect)
          sendWelcomeEmail(account.email, userName).catch((error) => {
            console.error('Failed to send welcome email:', error);
            // Don't fail the auth flow if email fails
          });
        }
      }
    }
  } catch (error) {
    // Don't fail the auth flow if email check/sending fails
    console.error('Error checking/sending welcome email:', error);
  }

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
  
  const redirectUrl = new URL(pathToRedirect, origin);

  return NextResponse.redirect(redirectUrl);
}

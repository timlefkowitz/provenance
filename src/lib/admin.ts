import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { User } from '@supabase/supabase-js';

/**
 * Check if a user is an admin
 * Uses public_data.admin field in accounts table (no database changes needed)
 */
export async function isAdmin(userId: string | null | undefined): Promise<boolean> {
  if (!userId) {
    return false;
  }

  try {
    const client = getSupabaseServerClient();
    const { data: account } = await client
      .from('accounts')
      .select('public_data')
      .eq('id', userId)
      .single();

    if (!account?.public_data) {
      return false;
    }

    const publicData = account.public_data as Record<string, any>;
    return publicData.admin === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Get the current user's admin status
 */
export async function getCurrentUserAdminStatus(): Promise<boolean> {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      return false;
    }

    return await isAdmin(user.id);
  } catch (error) {
    console.error('Error getting current user admin status:', error);
    return false;
  }
}

/**
 * Require an authenticated admin user for the current request.
 * Redirects to sign-in if not authenticated, or to home if not admin.
 * Use at the top of admin page server components.
 */
export async function requireAdmin(): Promise<{ user: User }> {
  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) {
    redirect('/');
  }

  return { user };
}

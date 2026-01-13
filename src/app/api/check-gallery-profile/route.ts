import { NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';

export async function GET() {
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasProfile: false });
    }

    // Check if user has a gallery profile
    const { data: profile } = await client
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', USER_ROLES.GALLERY)
      .eq('is_active', true)
      .single();

    return NextResponse.json({ hasProfile: !!profile });
  } catch (error) {
    console.error('Error checking gallery profile:', error);
    return NextResponse.json({ hasProfile: false });
  }
}


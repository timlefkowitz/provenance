import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    // Verify the user is authenticated and requesting their own exhibitions
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Users can only get their own exhibitions
    if (user.id !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const exhibitions = await getUserExhibitions(userId);

    return NextResponse.json(exhibitions);
  } catch (error) {
    console.error('Error fetching user exhibitions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch exhibitions' },
      { status: 500 }
    );
  }
}


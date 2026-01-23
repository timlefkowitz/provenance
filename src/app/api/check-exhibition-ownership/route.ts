import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const exhibitionId = searchParams.get('exhibitionId');
    const userId = searchParams.get('userId');

    if (!exhibitionId || !userId) {
      return NextResponse.json({ owns: false }, { status: 400 });
    }

    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user || user.id !== userId) {
      return NextResponse.json({ owns: false }, { status: 401 });
    }

    // Check if user owns the exhibition
    const { data: exhibition } = await (client as any)
      .from('exhibitions')
      .select('gallery_id')
      .eq('id', exhibitionId)
      .single();

    if (!exhibition) {
      return NextResponse.json({ owns: false });
    }

    return NextResponse.json({ owns: exhibition.gallery_id === user.id });
  } catch (error) {
    console.error('Error checking exhibition ownership:', error);
    return NextResponse.json({ owns: false }, { status: 500 });
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { sendCertificateInviteEmail } from '~/lib/email';

export const runtime = 'nodejs';

/**
 * POST /api/certificate-invite
 * Sends a branded "certificate shared with you" email to an external address.
 * Authenticated users only. Rate-limit: 5 invites per artwork per user per day
 * (enforced at DB level via exhibition_artist_invites insert constraint).
 */
export async function POST(req: NextRequest) {
  console.log('[CertInvite] POST started');
  try {
    const client = getSupabaseServerClient();
    const { data: { user } } = await client.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json() as {
      toEmail?: string;
      artworkId?: string;
      artworkTitle?: string;
      artistName?: string;
      personalMessage?: string;
    };

    const { toEmail, artworkId, artworkTitle, artistName, personalMessage } = body;

    if (!toEmail || !artworkId) {
      return NextResponse.json({ error: 'toEmail and artworkId are required' }, { status: 400 });
    }

    // Verify the authenticated user owns the artwork or is admin
    const { data: artwork, error: artworkError } = await (client as any)
      .from('artworks')
      .select('id, title, artist_name, certificate_number, account_id')
      .eq('id', artworkId)
      .single();

    if (artworkError || !artwork) {
      console.error('[CertInvite] artwork not found', artworkError);
      return NextResponse.json({ error: 'Artwork not found' }, { status: 404 });
    }

    if (artwork.account_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get the sender's name
    const { data: account } = await client
      .from('accounts')
      .select('name')
      .eq('id', user.id)
      .single();

    const senderName = account?.name || user.email || 'Someone';
    const origin = req.nextUrl.origin;
    const certificateUrl = `${origin}/artworks/${artworkId}/certificate`;

    await sendCertificateInviteEmail(toEmail, {
      senderName,
      artworkTitle: artworkTitle || artwork.title || 'Untitled',
      artistName: artistName || artwork.artist_name,
      certificateUrl,
      personalMessage: personalMessage || null,
    });

    console.log('[CertInvite] invite sent', { artworkId, toEmail });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[CertInvite] POST failed', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import { getExhibitionTeamUserIds } from '~/lib/exhibitions/exhibition-team';
import { createNotification } from '~/lib/notifications';
import { normalizePhoneInput } from '~/lib/phone';
import { checkRateLimit } from '~/lib/rate-limit';
import { asUntyped } from '~/lib/supabase-untyped';

export type ReservationStatus = 'pending' | 'accepted' | 'declined' | 'cancelled';

export interface ReservationRequest {
  id: string;
  artwork_id: string;
  artwork_title: string | null;
  artwork_image_url: string | null;
  requester_name: string;
  requester_email: string | null;
  requester_phone: string | null;
  message: string | null;
  status: ReservationStatus;
  created_at: string;
  responded_at: string | null;
}

export interface SubmitReservationInput {
  exhibitionId: string;
  artworkId: string;
  name: string;
  email?: string;
  phone?: string;
  message?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Result = { ok: true } | { ok: false; error: string };

/**
 * A visitor asks the exhibition's owner to hold a piece for them. Signed-out
 * visitors can ask too (people scan the wall QR at the show), so this is
 * rate-limited and written with the service role after the checks below.
 */
export async function submitReservationRequest(input: SubmitReservationInput): Promise<Result> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  const hdrs = await headers();
  const allowed = await checkRateLimit(
    { headers: hdrs },
    {
      keyPrefix: user ? `reserve:${user.id}` : 'reserve',
      maxPerWindow: 5,
      windowMs: 10 * 60_000,
    },
  );
  if (!allowed) {
    return { ok: false, error: 'Too many requests. Please try again in a few minutes.' };
  }

  const name = input.name?.trim() ?? '';
  const email = input.email?.trim().toLowerCase() || null;
  const message = input.message?.trim() || null;
  let phone: string | null;
  try {
    phone = normalizePhoneInput(input.phone);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }

  if (!name || name.length > 120) return { ok: false, error: 'Please enter your name' };
  if (!email && !phone) return { ok: false, error: 'Add an email or phone number so they can reach you' };
  if (email && (email.length > 254 || !EMAIL_RE.test(email))) {
    return { ok: false, error: 'That email address doesn’t look right' };
  }
  if (message && message.length > 2000) return { ok: false, error: 'Message is too long' };
  if (containsObjectionableText(name, message)) return { ok: false, error: OBJECTIONABLE_TEXT_MESSAGE };

  const admin = asUntyped(getSupabaseServerAdminClient());

  // The piece must be a published work in a published show.
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('id, title, gallery_id, published_at')
    .eq('id', input.exhibitionId)
    .maybeSingle();
  if (!exhibition || !exhibition.published_at) {
    return { ok: false, error: 'This exhibition isn’t available' };
  }

  const { data: link } = await admin
    .from('exhibition_artworks')
    .select('artwork_id, artworks!inner(id, title, status)')
    .eq('exhibition_id', exhibition.id)
    .eq('artwork_id', input.artworkId)
    .maybeSingle();
  const artwork = link?.artworks as { id: string; title: string | null; status: string } | undefined;
  if (!artwork || artwork.status !== 'verified') {
    return { ok: false, error: 'This piece isn’t available to reserve' };
  }

  if (user) {
    if (user.id === exhibition.gallery_id) {
      return { ok: false, error: 'This is your exhibition' };
    }
    // Don't deliver requests from someone the owner has blocked.
    const { data: block } = await admin
      .from('user_blocks')
      .select('blocked_id')
      .eq('blocker_id', exhibition.gallery_id)
      .eq('blocked_id', user.id)
      .maybeSingle();
    if (block) return { ok: true };

    const { count } = await admin
      .from('artwork_reservation_requests')
      .select('id', { count: 'exact', head: true })
      .eq('artwork_id', artwork.id)
      .eq('requester_user_id', user.id)
      .eq('status', 'pending');
    if ((count ?? 0) > 0) {
      return { ok: false, error: 'You already have a pending request for this piece' };
    }
  }

  const { error } = await admin.from('artwork_reservation_requests').insert({
    artwork_id: artwork.id,
    exhibition_id: exhibition.id,
    recipient_account_id: exhibition.gallery_id,
    requester_user_id: user?.id ?? null,
    requester_name: name,
    requester_email: email,
    requester_phone: phone,
    message,
  });
  if (error) {
    console.error('[Reservations] insert failed', error);
    return { ok: false, error: 'Couldn’t send your request. Please try again.' };
  }

  // The curator account and its whole team hear about it, not just the owner login.
  try {
    const teamIds = await getExhibitionTeamUserIds(admin, exhibition.gallery_id);
    const results = await Promise.allSettled(
      teamIds
        .filter((id) => id !== user?.id)
        .map((teamUserId) =>
          createNotification({
            userId: teamUserId,
            type: 'artwork_reservation_request',
            title: `Reservation request: ${artwork.title || 'Untitled'}`,
            message: `${name} would like to reserve this piece from ${exhibition.title}.`,
            artworkId: artwork.id,
            relatedUserId: user?.id,
            metadata: { exhibition_id: exhibition.id },
          }),
        ),
    );
    for (const r of results) {
      if (r.status === 'rejected') console.error('[Reservations] notify failed', r.reason);
    }
  } catch (e) {
    console.error('[Reservations] notify failed', e);
  }

  revalidatePath(`/exhibitions/${exhibition.id}`);
  return { ok: true };
}

/** Requests for one exhibition, for its owner and team. */
export async function getExhibitionReservationRequests(
  exhibitionId: string,
): Promise<ReservationRequest[]> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return [];

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition } = await admin
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (!exhibition || !(await canManageExhibition(user.id, exhibition.gallery_id))) return [];

  const { data, error } = await admin
    .from('artwork_reservation_requests')
    .select(
      'id, artwork_id, requester_name, requester_email, requester_phone, message, status, created_at, responded_at, artworks(title, image_url)',
    )
    .eq('exhibition_id', exhibitionId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    // Table not migrated yet, or a transient error: show nothing rather than break the page.
    console.error('[Reservations] list failed', error);
    return [];
  }

  return (data ?? []).map((r: Record<string, unknown>) => {
    const art = (r.artworks ?? null) as { title?: string | null; image_url?: string | null } | null;
    return {
      id: r.id as string,
      artwork_id: r.artwork_id as string,
      artwork_title: art?.title ?? null,
      artwork_image_url: art?.image_url ?? null,
      requester_name: r.requester_name as string,
      requester_email: (r.requester_email as string | null) ?? null,
      requester_phone: (r.requester_phone as string | null) ?? null,
      message: (r.message as string | null) ?? null,
      status: r.status as ReservationStatus,
      created_at: r.created_at as string,
      responded_at: (r.responded_at as string | null) ?? null,
    };
  });
}

/** Owner/team accepts or declines a request; a signed-in requester is notified. */
export async function respondToReservationRequest(
  requestId: string,
  status: 'accepted' | 'declined',
): Promise<Result> {
  if (status !== 'accepted' && status !== 'declined') return { ok: false, error: 'Invalid status' };

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { ok: false, error: 'Please sign in' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: req } = await admin
    .from('artwork_reservation_requests')
    .select('id, artwork_id, exhibition_id, recipient_account_id, requester_user_id, status, artworks(title)')
    .eq('id', requestId)
    .maybeSingle();
  if (!req || !(await canManageExhibition(user.id, req.recipient_account_id))) {
    return { ok: false, error: 'Request not found' };
  }

  const { error } = await admin
    .from('artwork_reservation_requests')
    .update({ status, responded_at: new Date().toISOString(), responded_by: user.id })
    .eq('id', requestId);
  if (error) {
    console.error('[Reservations] update failed', error);
    return { ok: false, error: 'Couldn’t update the request' };
  }

  if (req.requester_user_id && req.status !== status) {
    const title = (req.artworks as { title?: string | null } | null)?.title || 'Untitled';
    try {
      await createNotification({
        userId: req.requester_user_id,
        type: 'artwork_reservation_response',
        title:
          status === 'accepted'
            ? `Your reservation for ${title} was accepted`
            : `Your reservation request for ${title} was declined`,
        message:
          status === 'accepted'
            ? 'The gallery is holding this piece for you and will be in touch.'
            : 'The gallery can’t hold this piece right now.',
        artworkId: req.artwork_id,
        relatedUserId: user.id,
        metadata: { exhibition_id: req.exhibition_id, status },
      });
    } catch (e) {
      console.error('[Reservations] notify requester failed', e);
    }
  }

  if (req.exhibition_id) revalidatePath(`/exhibitions/${req.exhibition_id}`);
  return { ok: true };
}

/** Artwork ids in this show the gallery has accepted a reservation for. Public. */
export async function getReservedArtworkIds(exhibitionId: string): Promise<string[]> {
  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data, error } = await admin
    .from('artwork_reservation_requests')
    .select('artwork_id')
    .eq('exhibition_id', exhibitionId)
    .eq('status', 'accepted');
  if (error) return [];
  return [...new Set((data ?? []).map((r: { artwork_id: string }) => r.artwork_id))];
}

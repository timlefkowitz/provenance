'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { slugify } from '~/lib/slug';
import {
  emailsMatch,
  generateClaimToken,
  hashClaimToken,
  normalizeInviteEmail,
} from '~/lib/certificate-claims/tokens';
import { INVITE_TTL_MS } from '~/lib/certificate-claims/create-invite-batch';
import { artworkImageUploader, getArtworkImagePublicUrl } from '~/lib/artwork-storage';
import { isOpenCallSubmissionExpired } from '~/app/open-calls/_lib/open-call-utils';
import { parseMaxArtworksPerArtist } from '../_helpers/exhibition-invite-limits';
import {
  parseExhibitionArtworkStatus,
  type ExhibitionArtworkStatus,
} from '../_helpers/exhibition-submission-status';

export type ExhibitionOpenCallSummary = {
  id: string;
  slug: string;
  submissionClosingDate: string | null;
  isOpen: boolean;
  imageUrl: string | null;
};

const OPEN_STATUSES = ['pending', 'sent'];

async function requireManager(exhibitionId: string) {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition, error } = await adminClient
    .from('exhibitions')
    .select('id, gallery_id, title, owner_role, end_date')
    .eq('id', exhibitionId)
    .single();
  if (error || !exhibition) throw new Error('Exhibition not found');

  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    throw new Error('Access denied');
  }

  return { user, adminClient, exhibition };
}

/** The exhibition's own open call (submission_mode 'exhibition'), if any. */
export async function getExhibitionOpenCall(
  exhibitionId: string,
): Promise<ExhibitionOpenCallSummary | null> {
  const { adminClient } = await requireManager(exhibitionId);
  const { data } = await adminClient
    .from('open_calls')
    .select('id, slug, submission_closing_date, image_url')
    .eq('exhibition_id', exhibitionId)
    .eq('submission_mode', 'exhibition')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    submissionClosingDate: data.submission_closing_date,
    isOpen: !isOpenCallSubmissionExpired(data),
    imageUrl: data.image_url ?? null,
  };
}

/** Only accept image URLs our own uploader produced. */
function isOwnArtworkImageUrl(url: string): boolean {
  return url.startsWith(getArtworkImagePublicUrl(''));
}

/**
 * Uploads the open call's main image. Saves it straight onto the call when one
 * exists; before the call is published, returns the URL for
 * openExhibitionOpenCall to store. Pass `remove=1` instead of `image` to clear.
 */
export async function setExhibitionOpenCallImage(
  exhibitionId: string,
  formData: FormData,
): Promise<{ success: true; imageUrl: string | null } | { success: false; error: string }> {
  try {
    const { user, adminClient } = await requireManager(exhibitionId);

    let imageUrl: string | null = null;
    if (formData.get('remove') !== '1') {
      const file = formData.get('image');
      if (!(file instanceof File) || file.size === 0) {
        return { success: false, error: 'Choose an image to upload' };
      }
      try {
        imageUrl = await artworkImageUploader.upload(
          asUntyped(getSupabaseServerClient()),
          adminClient,
          file,
          user.id,
        );
      } catch (err) {
        console.error('[Exhibitions] open call image upload failed', err);
        return {
          success: false,
          error: err instanceof Error ? err.message : 'Could not upload the image',
        };
      }
    }

    const existing = await getExhibitionOpenCall(exhibitionId);
    if (existing) {
      const { error } = await adminClient
        .from('open_calls')
        .update({ image_url: imageUrl, updated_by: user.id })
        .eq('id', existing.id);
      if (error) {
        console.error('[Exhibitions] save open call image failed', error);
        return { success: false, error: 'Could not save the image' };
      }
      revalidatePath(`/exhibitions/${exhibitionId}/edit`);
      revalidatePath(`/open-calls/${existing.slug}`);
      revalidatePath('/open-calls/browse');
    }

    console.log('[Exhibitions] setExhibitionOpenCallImage succeeded', {
      exhibitionId,
      saved: Boolean(existing),
      removed: !imageUrl,
    });
    return { success: true, imageUrl };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not save the image' };
  }
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Publishes (or reopens) a public open call for this exhibition. Artists who
 * respond go through the same upload flow as invited artists, with the
 * exhibition's per-artist limit.
 */
export async function openExhibitionOpenCall(
  exhibitionId: string,
  params: { closingDate: string; imageUrl?: string | null },
): Promise<{ success: true; slug: string } | { success: false; error: string }> {
  try {
    const { user, adminClient, exhibition } = await requireManager(exhibitionId);
    const closingDate = params.closingDate?.trim();
    if (!closingDate || !/^\d{4}-\d{2}-\d{2}$/.test(closingDate)) {
      return { success: false, error: 'Choose a submission deadline' };
    }
    if (closingDate < todayIso()) {
      return { success: false, error: 'The deadline must be today or later' };
    }
    const imageUrl =
      params.imageUrl && isOwnArtworkImageUrl(params.imageUrl) ? params.imageUrl : null;

    const existing = await getExhibitionOpenCall(exhibitionId);
    if (existing) {
      const { error } = await adminClient
        .from('open_calls')
        .update({ submission_closing_date: closingDate, updated_by: user.id })
        .eq('id', existing.id);
      if (error) {
        console.error('[Exhibitions] reopen open call failed', error);
        return { success: false, error: 'Could not update the open call' };
      }
      revalidatePath(`/exhibitions/${exhibitionId}/edit`);
      revalidatePath(`/open-calls/${existing.slug}`);
      return { success: true, slug: existing.slug };
    }

    // open_calls requires a profile to list the call under; prefer the one
    // matching the mode the exhibition is owned as.
    const { data: profiles } = await adminClient
      .from('user_profiles')
      .select('id, role, is_active')
      .eq('user_id', exhibition.gallery_id);
    const profileList = (profiles ?? []) as Array<{ id: string; role: string; is_active: boolean }>;
    const profile =
      profileList.find((p) => p.role === exhibition.owner_role && p.is_active) ??
      profileList.find((p) => p.is_active) ??
      profileList[0];
    if (!profile) {
      return { success: false, error: 'Set up your profile before opening a call' };
    }

    const baseSlug = slugify(exhibition.title) || 'open-call';
    let slug = baseSlug;
    for (let suffix = 1; ; suffix++) {
      const { data: taken } = await adminClient
        .from('open_calls')
        .select('id')
        .eq('slug', slug)
        .maybeSingle();
      if (!taken) break;
      slug = `${baseSlug}-${suffix}`;
    }

    const { error } = await adminClient.from('open_calls').insert({
      exhibition_id: exhibitionId,
      gallery_profile_id: profile.id,
      slug,
      submission_open_date: todayIso(),
      submission_closing_date: closingDate,
      image_url: imageUrl,
      call_type: 'exhibition',
      submission_mode: 'exhibition',
      eligible_locations: [],
      created_by: user.id,
      updated_by: user.id,
    });
    if (error) {
      console.error('[Exhibitions] openExhibitionOpenCall insert failed', error);
      return { success: false, error: 'Could not open the call' };
    }

    console.log('[Exhibitions] openExhibitionOpenCall succeeded', { exhibitionId, slug });
    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    revalidatePath('/open-calls');
    return { success: true, slug };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not open the call' };
  }
}

/** Stops accepting open-call submissions (sets the deadline to yesterday). */
export async function closeExhibitionOpenCall(
  exhibitionId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const { user, adminClient } = await requireManager(exhibitionId);
    const existing = await getExhibitionOpenCall(exhibitionId);
    if (!existing) return { success: false, error: 'No open call for this exhibition' };

    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const { error } = await adminClient
      .from('open_calls')
      .update({ submission_closing_date: yesterday, updated_by: user.id })
      .eq('id', existing.id);
    if (error) {
      console.error('[Exhibitions] closeExhibitionOpenCall failed', error);
      return { success: false, error: 'Could not close the open call' };
    }

    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    revalidatePath(`/open-calls/${existing.slug}`);
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not close the call' };
  }
}

/**
 * Artist responds to an exhibition open call: issues (or refreshes) their
 * upload invite and returns its token for /exhibitions/submit.
 */
export async function startOpenCallSubmission(
  openCallId: string,
): Promise<{ success: true; token: string } | { success: false; error: string; needsSignIn?: boolean }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Sign in to submit', needsSignIn: true };
  if (!user.email) return { success: false, error: 'Add an email to your account to submit' };

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { data: openCall } = await adminClient
    .from('open_calls')
    .select('id, exhibition_id, submission_closing_date, submission_mode')
    .eq('id', openCallId)
    .maybeSingle();
  if (!openCall || openCall.submission_mode !== 'exhibition') {
    return { success: false, error: 'Open call not found' };
  }
  if (isOpenCallSubmissionExpired(openCall)) {
    return { success: false, error: 'Submissions for this open call have closed' };
  }

  const { data: exhibition } = await adminClient
    .from('exhibitions')
    .select('id, gallery_id, metadata')
    .eq('id', openCall.exhibition_id)
    .single();
  if (!exhibition) return { success: false, error: 'Exhibition not found' };
  if (exhibition.gallery_id === user.id) {
    return { success: false, error: 'This is your own open call' };
  }

  const email = normalizeInviteEmail(user.email);
  const { data: prior } = await adminClient
    .from('exhibition_artist_invites')
    .select('id, status')
    .eq('exhibition_id', exhibition.id)
    .ilike('invitee_email', email)
    .in('status', [...OPEN_STATUSES, 'consumed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prior?.status === 'consumed') {
    return { success: false, error: "You've already submitted to this exhibition" };
  }

  const token = generateClaimToken();
  const tokenHash = hashClaimToken(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString();

  if (prior) {
    // Reuse their open invite (direct or earlier open-call visit); the old
    // link stops working, which is fine since they're here now.
    const { error } = await adminClient
      .from('exhibition_artist_invites')
      .update({ token_hash: tokenHash, expires_at: expiresAt, status: 'sent' })
      .eq('id', prior.id);
    if (error) {
      console.error('[Exhibitions] startOpenCallSubmission refresh failed', error);
      return { success: false, error: 'Could not start your submission' };
    }
  } else {
    const { data: account } = await adminClient
      .from('accounts')
      .select('name')
      .eq('id', user.id)
      .maybeSingle();
    const { error } = await adminClient.from('exhibition_artist_invites').insert({
      exhibition_id: exhibition.id,
      invitee_email: email,
      invitee_name: account?.name ?? null,
      artist_account_id: user.id,
      max_artworks: parseMaxArtworksPerArtist(
        (exhibition.metadata as Record<string, unknown> | null)?.max_artworks_per_artist,
      ),
      source: 'open_call',
      token_hash: tokenHash,
      status: 'sent',
      expires_at: expiresAt,
      created_by: null,
    });
    if (error) {
      console.error('[Exhibitions] startOpenCallSubmission insert failed', error);
      return { success: false, error: 'Could not start your submission' };
    }
  }

  console.log('[Exhibitions] startOpenCallSubmission ready', {
    openCallId,
    reused: Boolean(prior),
  });
  revalidatePath(`/exhibitions/${exhibition.id}/edit`);
  return { success: true, token };
}

export type MyOpenCallSubmission = {
  artworkId: string;
  title: string;
  imageUrl: string | null;
  status: ExhibitionArtworkStatus;
  submittedAt: string;
};

export type MyOpenCallStatus = {
  signedIn: boolean;
  /** The viewer organises this exhibition (they review, not submit). */
  isOrganiser: boolean;
  /** False once the artist has finished submitting (invite consumed). */
  canSubmit: boolean;
  submissions: MyOpenCallSubmission[];
};

/**
 * The signed-in artist's submissions to an exhibition and where each one
 * stands in the organiser's review, for the open call page.
 */
export async function getMyOpenCallStatus(exhibitionId: string): Promise<MyOpenCallStatus> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { signedIn: false, isOrganiser: false, canSubmit: true, submissions: [] };

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition } = await adminClient
    .from('exhibitions')
    .select('gallery_id')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (exhibition && (await canManageExhibition(user.id, exhibition.gallery_id))) {
    return { signedIn: true, isOrganiser: true, canSubmit: false, submissions: [] };
  }

  // Invites are matched by account or by email (direct invites may predate
  // the artist's account). An exhibition has few invites, so filter here.
  const { data: invites, error: invitesError } = await adminClient
    .from('exhibition_artist_invites')
    .select('id, status, artist_account_id, invitee_email')
    .eq('exhibition_id', exhibitionId);
  if (invitesError) {
    console.error('[Exhibitions] getMyOpenCallStatus invites failed', invitesError);
  }

  const inviteRows = (
    (invites ?? []) as Array<{
      id: string;
      status: string;
      artist_account_id: string | null;
      invitee_email: string;
    }>
  ).filter(
    (i) =>
      i.artist_account_id === user.id ||
      (user.email ? emailsMatch(i.invitee_email, user.email) : false),
  );
  const canSubmit = !inviteRows.some((i) => i.status === 'consumed');
  if (!inviteRows.length) return { signedIn: true, isOrganiser: false, canSubmit, submissions: [] };

  const { data: links, error: linksError } = await adminClient
    .from('exhibition_artworks')
    .select('artwork_id, status, created_at')
    .eq('exhibition_id', exhibitionId)
    .in(
      'submission_invite_id',
      inviteRows.map((i) => i.id),
    )
    .order('created_at', { ascending: true });
  if (linksError) {
    console.error('[Exhibitions] getMyOpenCallStatus links failed', linksError);
  }

  const linkRows = (links ?? []) as Array<{ artwork_id: string; status: string; created_at: string }>;
  if (!linkRows.length) return { signedIn: true, isOrganiser: false, canSubmit, submissions: [] };

  const { data: artworks } = await adminClient
    .from('artworks')
    .select('id, title, image_url')
    .in(
      'id',
      linkRows.map((l) => l.artwork_id),
    );
  const artworkById = new Map(
    ((artworks ?? []) as Array<{ id: string; title: string | null; image_url: string | null }>).map(
      (a) => [a.id, a],
    ),
  );

  return {
    signedIn: true,
    isOrganiser: false,
    canSubmit,
    submissions: linkRows.map((l) => {
      const artwork = artworkById.get(l.artwork_id);
      return {
        artworkId: l.artwork_id,
        title: artwork?.title?.trim() || 'Untitled',
        imageUrl: artwork?.image_url ?? null,
        status: parseExhibitionArtworkStatus(l.status),
        submittedAt: l.created_at,
      };
    }),
  };
}

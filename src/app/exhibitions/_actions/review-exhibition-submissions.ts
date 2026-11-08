'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { notifyOwnersOfExhibition } from '~/lib/collectors/notify-owners-of-exhibition';
import {
  issueExhibitionCos,
  notifyArtistOfSelection,
} from '~/lib/certificate-claims/issue-exhibition-cos';
import { ownerReceivesCertificateOfShow } from '../_helpers/exhibition-owner-roles';
import {
  parseExhibitionArtworkStatus,
  planSubmissionReview,
  type ExhibitionArtworkStatus,
  type ReviewDecision,
} from '../_helpers/exhibition-submission-status';

export type ExhibitionSubmission = {
  artworkId: string;
  title: string;
  imageUrl: string | null;
  medium: string | null;
  creationDate: string | null;
  status: ExhibitionArtworkStatus;
  hasCos: boolean;
  submittedAt: string;
};

export type ExhibitionSubmissionGroup = {
  inviteId: string;
  artistName: string;
  artistEmail: string;
  source: string;
  maxArtworks: number | null;
  submissions: ExhibitionSubmission[];
};

type ExhibitionRow = { id: string; gallery_id: string; title: string; owner_role: string };

async function loadManagedExhibition(
  exhibitionId: string,
): Promise<{ userId: string; exhibition: ExhibitionRow } | { error: string }> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { error: 'Unauthorized' };

  const { data: exhibition, error } = await client
    .from('exhibitions')
    .select('id, gallery_id, title, owner_role')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (error || !exhibition) return { error: 'Exhibition not found' };

  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    return { error: 'Access denied' };
  }
  return { userId: user.id, exhibition: exhibition as ExhibitionRow };
}

/** Artist submissions for the organiser's review panel, grouped by invite. */
export async function getExhibitionSubmissions(
  exhibitionId: string,
): Promise<ExhibitionSubmissionGroup[]> {
  const managed = await loadManagedExhibition(exhibitionId);
  if ('error' in managed) return [];

  const adminClient = asUntyped(getSupabaseServerAdminClient());
  const { data: links, error } = await adminClient
    .from('exhibition_artworks')
    .select('artwork_id, status, cos_artwork_id, submission_invite_id, created_at')
    .eq('exhibition_id', exhibitionId)
    .not('submission_invite_id', 'is', null)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[Exhibitions] getExhibitionSubmissions failed', { exhibitionId, error });
    return [];
  }
  if (!links?.length) return [];

  type LinkRow = {
    artwork_id: string;
    status: string;
    cos_artwork_id: string | null;
    submission_invite_id: string;
    created_at: string;
  };
  const rows = links as LinkRow[];
  const inviteIds = [...new Set(rows.map((r) => r.submission_invite_id))];
  const artworkIds = rows.map((r) => r.artwork_id);

  const [{ data: invites }, { data: artworks }] = await Promise.all([
    adminClient
      .from('exhibition_artist_invites')
      .select('id, invitee_email, invitee_name, source, max_artworks')
      .in('id', inviteIds),
    adminClient
      .from('artworks')
      .select('id, title, image_url, medium, creation_date')
      .in('id', artworkIds),
  ]);

  const artworkById = new Map(
    (artworks ?? []).map((a: Record<string, unknown>) => [a.id as string, a]),
  );

  return inviteIds.map((inviteId) => {
    const invite = (invites ?? []).find((i: { id: string }) => i.id === inviteId) as
      | {
          invitee_email: string;
          invitee_name: string | null;
          source: string;
          max_artworks: number | null;
        }
      | undefined;
    return {
      inviteId,
      artistName: invite?.invitee_name?.trim() || invite?.invitee_email || 'Artist',
      artistEmail: invite?.invitee_email ?? '',
      source: invite?.source ?? 'invite',
      maxArtworks: invite?.max_artworks ?? null,
      submissions: rows
        .filter((r) => r.submission_invite_id === inviteId)
        .map((r) => {
          const artwork = artworkById.get(r.artwork_id);
          return {
            artworkId: r.artwork_id,
            title: (artwork?.title as string | undefined)?.trim() || 'Untitled',
            imageUrl: (artwork?.image_url as string | null | undefined) ?? null,
            medium: (artwork?.medium as string | null | undefined) ?? null,
            creationDate: (artwork?.creation_date as string | null | undefined) ?? null,
            status: parseExhibitionArtworkStatus(r.status),
            hasCos: Boolean(r.cos_artwork_id),
            submittedAt: r.created_at,
          };
        }),
    };
  });
}

/**
 * Selects or declines an artist's submission. Selecting shows the work on the
 * exhibition, issues the Certificate of Show (gallery/institution shows),
 * credits the artist and tells them. Declining hides it; the artist keeps
 * their Certificate of Authenticity.
 */
export async function reviewExhibitionSubmission(
  exhibitionId: string,
  artworkId: string,
  decision: ReviewDecision,
): Promise<{ success: true; status: ExhibitionArtworkStatus } | { success: false; error: string }> {
  console.log('[Exhibitions] reviewExhibitionSubmission started', {
    exhibitionId,
    artworkId,
    decision,
  });

  try {
    const managed = await loadManagedExhibition(exhibitionId);
    if ('error' in managed) return { success: false, error: managed.error };
    const { userId, exhibition } = managed;

    const adminClient = asUntyped(getSupabaseServerAdminClient());
    const { data: link, error: linkError } = await adminClient
      .from('exhibition_artworks')
      .select('id, status, cos_artwork_id, submission_invite_id')
      .eq('exhibition_id', exhibitionId)
      .eq('artwork_id', artworkId)
      .maybeSingle();

    if (linkError || !link || !link.submission_invite_id) {
      console.error('[Exhibitions] reviewExhibitionSubmission link not found', linkError);
      return { success: false, error: 'Submission not found' };
    }

    const plan = planSubmissionReview({
      current: link.status,
      decision,
      showIssuesCos: ownerReceivesCertificateOfShow(exhibition.owner_role),
      hasCos: Boolean(link.cos_artwork_id),
    });
    if (!plan.ok) return { success: false, error: plan.error };

    const { data: coa, error: coaError } = await adminClient
      .from('artworks')
      .select('*')
      .eq('id', artworkId)
      .maybeSingle();
    if (coaError || !coa) {
      console.error('[Exhibitions] reviewExhibitionSubmission artwork load failed', coaError);
      return { success: false, error: 'Artwork not found' };
    }
    const artistAccountId = (coa.account_id as string | null) ?? null;

    let cosArtworkId: string | null = link.cos_artwork_id ?? null;
    if (plan.issueCos) {
      try {
        ({ cosArtworkId } = await issueExhibitionCos(adminClient, {
          exhibition,
          coa,
          actorUserId: userId,
          createdByUserId: artistAccountId ?? userId,
          existingCosId: cosArtworkId,
        }));
      } catch (cosErr) {
        console.error('[Exhibitions] reviewExhibitionSubmission COS creation failed', cosErr);
        return { success: false, error: 'Could not issue the Certificate of Show; try again' };
      }
    }

    const { error: updateError } = await adminClient
      .from('exhibition_artworks')
      .update({
        status: plan.next,
        reviewed_at: new Date().toISOString(),
        reviewed_by: userId,
        cos_artwork_id: cosArtworkId,
      })
      .eq('id', link.id);

    if (updateError) {
      console.error('[Exhibitions] reviewExhibitionSubmission update failed', updateError);
      return { success: false, error: 'Could not save your decision' };
    }

    if (plan.next === 'selected') {
      await notifyOwnersOfExhibition({
        exhibitionId,
        artworkIds: [artworkId, ...(cosArtworkId ? [cosArtworkId] : [])],
        actorUserId: userId,
      });
    }

    if (plan.creditArtist && artistAccountId) {
      const { error: creditError } = await adminClient.from('exhibition_artists').insert({
        exhibition_id: exhibitionId,
        artist_account_id: artistAccountId,
      });
      if (creditError && creditError.code !== '23505') {
        console.error('[Exhibitions] reviewExhibitionSubmission artist credit failed', creditError);
      }
    }

    if (plan.notifyArtist) {
      await notifyArtistOfSelection(adminClient, { exhibition, coa, actorUserId: userId, cosArtworkId });
    }

    revalidatePath(`/exhibitions/${exhibitionId}`);
    revalidatePath(`/exhibitions/${exhibitionId}/edit`);
    if (artistAccountId) revalidatePath(`/artists/${artistAccountId}`);

    console.log('[Exhibitions] reviewExhibitionSubmission succeeded', {
      exhibitionId,
      artworkId,
      status: plan.next,
      issuedCos: plan.issueCos,
    });
    return { success: true, status: plan.next };
  } catch (err) {
    console.error('[Exhibitions] reviewExhibitionSubmission failed', err);
    return { success: false, error: err instanceof Error ? err.message : 'Review failed' };
  }
}

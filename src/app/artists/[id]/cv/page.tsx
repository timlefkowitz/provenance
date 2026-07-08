import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import {
  getUserProfileByRole,
  getUserProfileById,
} from '~/app/profiles/_actions/get-user-profiles';
import { getExhibitionsForArtistAccount } from '~/app/exhibitions/_actions/get-exhibitions';
import type { ArtistCvJson } from '~/lib/grants';
import { mergeCvExhibitions } from './_helpers/merge-exhibitions';
import { ArtistCvView } from '../_components/artist-cv-view';
import type { ExhibitionSummary } from '../_components/unclaimed-artist-public-view';

export const metadata = {
  title: 'Artist CV | Provenance',
};

export default async function ArtistCvPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ role?: string; profileId?: string }>;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;
  const requestedProfileId = resolvedSearchParams?.profileId ?? null;

  console.log('[ArtistCV] page started', { id, requestedProfileId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  // ── ATTEMPT 1: look up as a claimed account ──────────────────────────────
  const { data: account } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data, created_at')
    .eq('id', id)
    .maybeSingle<{ id: string; name: string; picture_url: string | null; public_data: any; created_at: string | null }>();

  if (!account) {
    // ── ATTEMPT 2: unclaimed registry profile ────────────────────────────────
    const sb = client as any;

    const { data: profileRow } = await sb
      .from('user_profiles')
      .select(
        'id, name, picture_url, bio, medium, location, website, links, galleries, news_publications, user_id, role, is_active, artist_cv_json, artist_cv_file_url, artist_cv_file_path, artist_cv_uploaded_at',
      )
      .eq('id', id)
      .eq('role', USER_ROLES.ARTIST)
      .eq('is_active', true)
      .maybeSingle();

    if (!profileRow) {
      redirect('/registry');
    }

    if (profileRow.user_id) {
      redirect(`/artists/${profileRow.user_id}/cv`);
    }

    // For unclaimed profiles only show CV if it exists
    const cvJson = profileRow.artist_cv_json as ArtistCvJson | null;
    if (!cvJson) {
      console.log('[ArtistCV] no cv on unclaimed profile, redirecting', { id });
      redirect(`/artists/${id}`);
    }

    // Fetch exhibitions via artwork links (mirrors unclaimed view in main profile page)
    const artworkRows = await sb
      .from('artworks')
      .select('id')
      .eq('artist_profile_id', id)
      .eq('status', 'verified')
      .eq('is_public', true);

    const artworkIds = (artworkRows.data || []).map((a: { id: string }) => a.id).filter(Boolean);
    const exhibitions: ExhibitionSummary[] = [];

    if (artworkIds.length > 0) {
      const { data: exLinks } = await sb
        .from('exhibition_artworks')
        .select(
          `exhibition_id, exhibitions!exhibition_artworks_exhibition_id_fkey (id, title, start_date, end_date, location, published_at)`,
        )
        .in('artwork_id', artworkIds);

      const seen = new Set<string>();
      for (const row of exLinks || []) {
        const ex = row.exhibitions;
        if (ex?.id && !seen.has(ex.id) && ex.published_at !== null) {
          seen.add(ex.id);
          exhibitions.push({
            id: ex.id,
            title: ex.title,
            start_date: ex.start_date,
            end_date: ex.end_date ?? null,
            location: ex.location ?? null,
          });
        }
      }
    }

    const fakeExhibitions = exhibitions.map((e) => ({
      id: e.id,
      gallery_id: '',
      title: e.title,
      description: null,
      start_date: e.start_date,
      end_date: e.end_date ?? null,
      location: e.location ?? null,
      image_url: null,
      owner_role: null as any,
      created_at: e.start_date,
      updated_at: e.start_date,
    }));

    const merged = mergeCvExhibitions(cvJson, fakeExhibitions);
    const newsPublications = (profileRow.news_publications as any[]) ?? [];

    console.log('[ArtistCV] unclaimed profile cv loaded', {
      profileId: profileRow.id,
      mergedExhibitions: merged.length,
    });

    return (
      <ArtistCvView
        artistId={id}
        displayName={profileRow.name}
        medium={profileRow.medium ?? null}
        location={profileRow.location ?? null}
        cvJson={cvJson}
        uploadedAt={profileRow.artist_cv_uploaded_at ?? null}
        mergedExhibitions={merged}
        newsPublications={newsPublications}
        isOwner={false}
      />
    );
  }

  // ── CLAIMED ACCOUNT PATH ──────────────────────────────────────────────────
  const isOwner = user?.id === account.id;
  const primaryRole = getUserRole(account.public_data as Record<string, any>);

  // CV is only for artists, not galleries
  if (primaryRole === USER_ROLES.GALLERY) {
    console.log('[ArtistCV] gallery account has no CV page, redirecting', { id });
    redirect(`/artists/${id}`);
  }

  let roleProfile = null;
  if (requestedProfileId) {
    const specificProfile = await getUserProfileById(requestedProfileId);
    if (
      specificProfile &&
      specificProfile.user_id === account.id &&
      specificProfile.role === USER_ROLES.ARTIST
    ) {
      roleProfile = specificProfile;
    }
  }
  if (!roleProfile) {
    roleProfile = await getUserProfileByRole(account.id, USER_ROLES.ARTIST);
  }

  const cvJson = (roleProfile?.artist_cv_json ?? null) as ArtistCvJson | null;

  // Visitors without a CV get redirected; owners see the empty upload state
  if (!cvJson && !isOwner) {
    console.log('[ArtistCV] no cv on profile, visitor redirected', { id });
    redirect(`/artists/${id}`);
  }

  const provenanceExhibitions = await getExhibitionsForArtistAccount(account.id, {
    artistProfileId: roleProfile?.id ?? null,
    publishedOnly: true,
  });

  const merged = mergeCvExhibitions(cvJson, provenanceExhibitions);
  const displayName = roleProfile?.name || account.name;
  const medium = roleProfile?.medium ?? null;
  const location = roleProfile?.location ?? null;
  const uploadedAt = (roleProfile?.artist_cv_uploaded_at as string | null | undefined) ?? null;
  const hasOriginalFile = Boolean(roleProfile?.artist_cv_file_path);
  const newsPublications = (roleProfile?.news_publications as any[]) ?? [];

  console.log('[ArtistCV] claimed account cv loaded', {
    accountId: account.id,
    profileId: roleProfile?.id,
    hasCv: Boolean(cvJson),
    mergedExhibitions: merged.length,
    isOwner,
  });

  // For owner with no CV yet, render the view with an empty CV so the upload panel is visible
  const safeCvJson: ArtistCvJson = cvJson ?? {};

  return (
    <ArtistCvView
      artistId={id}
      displayName={displayName}
      medium={medium}
      location={location}
      cvJson={safeCvJson}
      uploadedAt={uploadedAt}
      mergedExhibitions={merged}
      newsPublications={newsPublications}
      isOwner={isOwner}
      profileId={roleProfile?.id}
      hasOriginalFile={hasOriginalFile}
    />
  );
}

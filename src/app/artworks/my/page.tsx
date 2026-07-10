import { asUntyped } from '~/lib/supabase-untyped';
import { redirect } from 'next/navigation';
import { Images } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';
import { getUserProfiles } from '~/app/profiles/_actions/get-user-profiles';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { getUserRole, getCertificateTypeForRole, type UserRole } from '~/lib/user-roles';
import { readPerspective, perspectiveToOwnerRole } from '~/lib/read-perspective';
import { buildModeEntityDisplayNames } from '~/lib/mode-entity-display-names';
import { SpreadsheetEditForm } from '../edit-provenance/_components/spreadsheet-edit-form';
import { CollectionHeaderActions } from './_components/collection-header-actions';

export const metadata = {
  title: 'Collection Management | Provenance',
};

export default async function MyArtworksPage({
  searchParams,
}: {
  searchParams?: Promise<{ exhibition?: string; assign?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const assignExhibitionIdParam =
    typeof resolvedSearchParams.exhibition === 'string' && resolvedSearchParams.exhibition.length > 0
      ? resolvedSearchParams.exhibition
      : null;
  const isAssignFlow = resolvedSearchParams.assign === '1' && assignExhibitionIdParam !== null;

  const client = asUntyped(getSupabaseServerClient());
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  // Resolve the active "mode": client perspective (cookie) for UI defaults,
  // falling back to the DB account role so server-rendered state is sensible
  // even before the client hydrates.
  const perspective = await readPerspective();
  const { data: accountRow } = await client
    .from('accounts')
    .select('public_data, name')
    .eq('id', user.id)
    .single();
  const accountRole: UserRole | null = getUserRole(
    (accountRow?.public_data ?? {}) as Record<string, unknown>,
  );
  const activeRole: UserRole | null = perspective ?? accountRole;
  const ownerRole = perspectiveToOwnerRole(activeRole);
  console.log('[Collection] my page loaded', {
    accountRole,
    perspective,
    ownerRole,
    isAssignFlow,
  });

  const artworkCollectionSelect =
    `id, title, artist_name, description, creation_date, certificate_number, account_id,
       medium, dimensions, former_owners, auction_history, exhibition_history,
       historic_context, celebrity_notes, is_public, value, value_is_public,
       edition, production_location, owned_by, owned_by_is_public, sold_by, sold_by_is_public,
       image_url, created_at, is_sold, display_order, certificate_type, status`;

  // Determine the certificate type that matches the active perspective so the
  // collection only shows relevant cert types (COA for artists, COO for
  // collectors, COS for gallery/institution team members).
  const certFilter = getCertificateTypeForRole(activeRole);

  const isGalleryMode =
    activeRole === 'gallery' || activeRole === 'institution';

  // In gallery/institution mode we show the gallery team's COS artworks
  // (filtered by gallery_profile_id). Load all gallery profiles the user
  // is part of (owned + team memberships via getUserGalleryProfiles).
  const galleryProfiles = isGalleryMode
    ? await getUserGalleryProfiles(user.id)
    : [];

  const galleryProfileIds = galleryProfiles.map((p) => p.id);

  console.log('[Collection] fetch params', {
    activeRole,
    certFilter,
    isGalleryMode,
    galleryProfileCount: galleryProfileIds.length,
    galleryProfileIds,
  });

  // Fetch artworks + user profiles in parallel so the early-return path also
  // has entity names available for the New Exhibition dialog.
  let artworksResult: { data: Record<string, unknown>[] | null; error: unknown } = { data: null, error: null };

  if (isGalleryMode && galleryProfileIds.length > 0) {
    // Gallery / institution mode: fetch COS rows across all gallery profiles
    // the user belongs to (owned + team). account_id is NOT filtered because
    // different team members post under their own account_id.
    const { data, error } = await asUntyped(client)
      .from('artworks')
      .select(artworkCollectionSelect)
      .in('gallery_profile_id', galleryProfileIds)
      .eq('status', 'verified')
      .eq('certificate_type', certFilter)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    artworksResult = { data: data ?? [], error };
  } else {
    // Artist / collector mode (or gallery mode with no profiles yet): fetch
    // by account_id filtered to the cert type matching the perspective.
    const { data, error } = await asUntyped(client)
      .from('artworks')
      .select(artworkCollectionSelect)
      .eq('account_id', user.id)
      .eq('status', 'verified')
      .eq('certificate_type', certFilter)
      .order('display_order', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    artworksResult = { data: data ?? [], error };
  }

  if (artworksResult.error) {
    console.error('[Collection] artworks fetch failed', artworksResult.error);
  }

  const userProfiles = await getUserProfiles(user.id);

  // Gallery team account IDs — used to find exhibitions owned by any of the
  // team's gallery accounts so draft showroom listings surface correctly.
  const galleryAccountIds = [
    ...new Set(
      galleryProfiles
        .map((p) => p.user_id)
        .filter((id): id is string => typeof id === 'string'),
    ),
  ];

  // Exhibitions we need to scan for draft artwork rows:
  // • personal exhibitions (gallery_id = user.id)
  // • team gallery exhibitions (gallery_id IN galleryAccountIds)
  const exhibitionOwnerIds = isGalleryMode
    ? [...new Set([user.id, ...galleryAccountIds])]
    : [user.id];

  /** Draft listings linked to shows you own (`exhibition_artworks` → exhibitions.gallery_id). */
  const { data: ownedExhibitions } = await asUntyped(client)
    .from('exhibitions')
    .select('id')
    .in('gallery_id', exhibitionOwnerIds);

  const ownedExhibitionIds = (ownedExhibitions ?? []).map((e: { id: string }) => e.id).filter(Boolean);
  let draftRowsForShows: Record<string, unknown>[] = [];

  if (ownedExhibitionIds.length > 0) {
    const { data: showLinks } = await client
      .from('exhibition_artworks')
      .select('artwork_id')
      .in('exhibition_id', ownedExhibitionIds);

    const showArtworkIds = [
      ...new Set(
        (showLinks ?? [])
          .map((r: { artwork_id: string }) => r.artwork_id)
          .filter(Boolean),
      ),
    ] as string[];

    if (showArtworkIds.length > 0) {
      // For draft rows in gallery mode, match by gallery_profile_id; for
      // personal modes, match by account_id.
      let draftQuery = asUntyped(client)
        .from('artworks')
        .select(artworkCollectionSelect)
        .in('id', showArtworkIds)
        .eq('certificate_type', certFilter)
        .eq('status', 'draft');

      if (isGalleryMode && galleryProfileIds.length > 0) {
        draftQuery = draftQuery.in('gallery_profile_id', galleryProfileIds);
      } else {
        draftQuery = draftQuery.eq('account_id', user.id);
      }

      const { data: drafts } = await draftQuery;
      draftRowsForShows = (drafts ?? []) as Record<string, unknown>[];
    }
  }

  const verifiedList = (artworksResult.data ?? []) as Record<string, unknown>[];
  const verifiedIdSet = new Set(verifiedList.map((a) => a.id as string));
  const extraDrafts = draftRowsForShows.filter((row) => !verifiedIdSet.has(row.id as string));

  type CollatableRow = { display_order?: number | string | null; created_at?: string };
  const artworks = [...verifiedList, ...extraDrafts];
  artworks.sort((a, b) => {
    const ar = a as CollatableRow;
    const br = b as CollatableRow;
    const ao = ar.display_order;
    const bo = br.display_order;
    const aHas = ao != null && ao !== '';
    const bHas = bo != null && bo !== '';
    if (aHas && bHas && Number(ao) !== Number(bo)) return Number(ao) - Number(bo);
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    const ca = new Date(String(ar.created_at ?? 0)).getTime();
    const cb = new Date(String(br.created_at ?? 0)).getTime();
    return cb - ca;
  });

  // Per-role display names for New Exhibition "Creating as" (profile → account → email).
  // Pass team gallery profiles so the entity name shows "Flight" even when
  // the user doesn't own a gallery profile themselves.
  const modeEntityNames = buildModeEntityDisplayNames(
    userProfiles,
    accountRow?.name ?? null,
    user.email ?? null,
    galleryProfiles,
  );

  if (!artworks || artworks.length === 0) {
    return (
      <div className="min-h-[calc(100vh-5rem)] bg-parchment">
        <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
          <div className="container mx-auto max-w-7xl w-full min-w-0 px-4 sm:px-6 py-8 sm:py-12">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl space-y-4">
                <div className="flex items-center gap-3">
                  <span className="h-px w-10 bg-wine/35 shrink-0" aria-hidden />
                  <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase">
                    Your collection
                  </p>
                </div>
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-wine tracking-tight">
                  Collection
                </h1>
                <p className="text-base sm:text-lg text-ink/70 font-serif leading-relaxed">
                  Register artworks, refine provenance, and keep your holdings organized in one
                  place.
                </p>
              </div>
              <div className="shrink-0">
                <CollectionHeaderActions accountRole={accountRole} modeEntityNames={modeEntityNames} />
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto max-w-7xl w-full min-w-0 px-4 sm:px-6 py-10 sm:py-14">
          <div className="mx-auto max-w-lg rounded-2xl border border-wine/15 bg-parchment/80 p-8 sm:p-10 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-wine/10 text-wine">
              <Images className="h-7 w-7" strokeWidth={1.25} aria-hidden />
            </div>
            <h2 className="font-display text-xl font-semibold text-wine sm:text-2xl">
              No artworks in collection yet
            </h2>
            <p className="mt-3 font-serif text-sm text-ink/65 leading-relaxed">
              Verified pieces and draft showroom listings tied to your exhibitions appear here once
              you add them from Add artwork or from an exhibition.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const artworkIds = artworks.map((artwork) => artwork.id);
  const { data: exhibitionLinks } = await client
    .from('exhibition_artworks')
    .select('artwork_id, exhibition_id')
    .in('artwork_id', artworkIds);

  const initialExhibitionIdByArtworkId: Record<string, string | null> = {};
  for (const id of artworkIds) {
    initialExhibitionIdByArtworkId[id] = null;
  }
  for (const row of exhibitionLinks || []) {
    const r = row as { artwork_id: string; exhibition_id: string };
    if (r.artwork_id && r.exhibition_id) {
      initialExhibitionIdByArtworkId[r.artwork_id] = r.exhibition_id;
    }
  }

  // Resolve the best display name for the "Received by" stamp
  const ROLE_PRIORITY = ['gallery', 'institution', 'artist', 'collector'];
  const bestProfile = ROLE_PRIORITY.reduce<(typeof userProfiles)[number] | null>((best, role) => {
    if (best) return best;
    return userProfiles.find((p) => p.role === role && p.is_active) ?? null;
  }, null);
  const receiverName = bestProfile?.name ?? user.email ?? 'Unknown';

  // When the user is in gallery or institution mode, use the active profile's
  // name for the catalog cover. If the user has no owned gallery profile,
  // fall back to the first team gallery profile name (e.g. "Flight").
  const activeProfileForMode =
    isGalleryMode
      ? (userProfiles.find((p) => p.role === activeRole && p.is_active) ?? null)
      : null;
  const teamGalleryName = isGalleryMode && !activeProfileForMode
    ? (galleryProfiles[0]?.name ?? null)
    : null;
  const catalogGalleryName =
    activeProfileForMode?.name ?? teamGalleryName ?? accountRow?.name ?? undefined;

  console.log('[Collection] artwork count and gallery context', {
    artworkCount: artworks.length,
    certFilter,
    isGalleryMode,
    catalogGalleryName,
    galleryProfileIds: galleryProfileIds.length,
  });

  let linkableExhibitions = await getUserExhibitions(user.id, {
    forCollectionManagement: true,
    ownerRole: ownerRole ?? undefined,
  });
  const linkableIds = new Set(linkableExhibitions.map((e) => e.id));
  const linkedIds = new Set(
    Object.values(initialExhibitionIdByArtworkId).filter(Boolean) as string[],
  );
  const missingExhibitionIds = [...linkedIds].filter((id) => !linkableIds.has(id));

  // Ensure the just-created exhibition from the New Exhibition dialog is visible
  // in the picker even before any link exists yet.
  if (
    assignExhibitionIdParam &&
    !linkableIds.has(assignExhibitionIdParam) &&
    !missingExhibitionIds.includes(assignExhibitionIdParam)
  ) {
    missingExhibitionIds.push(assignExhibitionIdParam);
  }

  if (missingExhibitionIds.length > 0) {
    const { data: extraRows } = await asUntyped(client)
      .from('exhibitions')
      .select('id, title, start_date, end_date')
      .in('id', missingExhibitionIds);

    for (const row of extraRows || []) {
      if (row?.id && !linkableIds.has(row.id)) {
        linkableExhibitions = [...linkableExhibitions, row];
        linkableIds.add(row.id);
      }
    }
  }

  const assignExhibition =
    isAssignFlow && assignExhibitionIdParam
      ? linkableExhibitions.find((ex) => ex.id === assignExhibitionIdParam) ?? null
      : null;
  const assignExhibitionId = assignExhibition?.id ?? null;
  const assignExhibitionTitle = assignExhibition?.title ?? null;

  // Fetch user_profiles for registry directory picks (artist: one COA; gallery: up to 5).
  const { data: profilesWithPick } = await asUntyped(client)
    .from('user_profiles')
    .select('id, role, registry_artwork_id, registry_artwork_ids')
    .eq('user_id', user.id)
    .eq('is_active', true);

  const registryArtworkIdsByScope: Record<string, string[]> = {};
  for (const prof of profilesWithPick || []) {
    const key = prof.role === 'artist' ? 'artist' : (prof.id as string);
    if (prof.role === 'gallery') {
      const multi = (prof.registry_artwork_ids as string[] | null)?.filter(Boolean) ?? [];
      registryArtworkIdsByScope[key] =
        multi.length > 0
          ? multi
          : prof.registry_artwork_id
            ? [prof.registry_artwork_id as string]
            : [];
    } else {
      registryArtworkIdsByScope[key] = prof.registry_artwork_id
        ? [prof.registry_artwork_id as string]
        : [];
    }
  }

  const count = artworks.length;

  return (
    <div className="min-h-[calc(100vh-5rem)] bg-parchment pb-8">
      <div className="border-b border-wine/15 bg-gradient-to-b from-wine/[0.06] to-transparent">
        <div className="container mx-auto max-w-7xl w-full min-w-0 overflow-x-hidden px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-4 max-w-3xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="h-px w-10 bg-wine/35 shrink-0" aria-hidden />
                <p className="text-[11px] font-landing font-light tracking-[0.28em] text-ink/45 uppercase">
                  Your collection
                </p>
                <span
                  className="rounded-full border border-wine/20 bg-parchment/90 px-3 py-0.5 font-serif text-xs text-ink/70"
                  aria-label={`${count} artworks in collection`}
                >
                  {count} {count === 1 ? 'artwork' : 'artworks'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-display font-bold text-wine tracking-tight">
                Collection
              </h1>
              <p className="text-base sm:text-lg text-ink/70 font-serif leading-relaxed">
                Tap thumbnails to choose what you are editing, then update provenance in the panel
                below. Save when you are done.
              </p>
            </div>
            <div className="shrink-0">
              <CollectionHeaderActions accountRole={accountRole} modeEntityNames={modeEntityNames} />
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl w-full min-w-0 overflow-x-hidden px-4 sm:px-6 py-6 sm:py-8 pb-28 sm:pb-24">
        <SpreadsheetEditForm
          artworks={artworks}
          linkableExhibitions={linkableExhibitions}
          initialExhibitionIdByArtworkId={initialExhibitionIdByArtworkId}
          receiverName={receiverName}
          assignExhibitionId={assignExhibitionId}
          assignExhibitionTitle={assignExhibitionTitle}
          galleryName={catalogGalleryName}
          senderRole={activeRole}
          registryArtworkIdsByScope={registryArtworkIdsByScope}
        />
      </div>
    </div>
  );
}

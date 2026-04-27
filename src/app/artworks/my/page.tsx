import { redirect } from 'next/navigation';
import { Images } from 'lucide-react';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserExhibitions } from '~/app/artworks/add/_actions/get-user-exhibitions';
import { getUserProfiles } from '~/app/profiles/_actions/get-user-profiles';
import { getUserRole, type UserRole } from '~/lib/user-roles';
import { readPerspective, perspectiveToOwnerRole } from '~/lib/read-perspective';
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

  const client = getSupabaseServerClient();
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
    (accountRow?.public_data ?? {}) as Record<string, any>,
  );
  const activeRole: UserRole | null = perspective ?? accountRole;
  const ownerRole = perspectiveToOwnerRole(activeRole);
  console.log('[Collection] my page loaded', {
    accountRole,
    perspective,
    ownerRole,
    isAssignFlow,
  });

  // Fetch artworks user owns (explicit filter so we never show other users' artworks)
  const { data: artworks } = await client
    .from('artworks')
    .select(
      `id, title, artist_name, description, creation_date, certificate_number, account_id,
       medium, dimensions, former_owners, auction_history, exhibition_history,
       historic_context, celebrity_notes, is_public, value, value_is_public,
       edition, production_location, owned_by, owned_by_is_public, sold_by, sold_by_is_public,
       image_url, created_at, is_sold, display_order, certificate_type`,
    )
    .eq('account_id', user.id)
    .eq('status', 'verified')
    .order('display_order', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false });

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
                <CollectionHeaderActions accountRole={accountRole} />
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
              No verified artworks yet
            </h2>
            <p className="mt-3 font-serif text-sm text-ink/65 leading-relaxed">
              Once an artwork is verified, it appears here so you can edit details and link it to
              exhibitions.
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
  const userProfiles = await getUserProfiles(user.id);
  const ROLE_PRIORITY = ['gallery', 'institution', 'artist', 'collector'];
  const bestProfile = ROLE_PRIORITY.reduce<(typeof userProfiles)[number] | null>((best, role) => {
    if (best) return best;
    return userProfiles.find((p) => p.role === role && p.is_active) ?? null;
  }, null);
  const receiverName = bestProfile?.name ?? user.email ?? 'Unknown';

  // When the user is in gallery or institution mode, use the active profile's
  // name for the catalog cover instead of the raw account name (username).
  const activeProfileForMode =
    activeRole === 'gallery' || activeRole === 'institution'
      ? (userProfiles.find((p) => p.role === activeRole && p.is_active) ?? null)
      : null;
  const catalogGalleryName =
    activeProfileForMode?.name ?? accountRow?.name ?? undefined;

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
    const { data: extraRows } = await (client as any)
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

  // Fetch user_profiles to know which artwork is pinned as the registry photo.
  // We need both the artist profile and all gallery profiles so the UI can
  // show the current selection per-mode.
  const { data: profilesWithPick } = await (client as any)
    .from('user_profiles')
    .select('id, role, registry_artwork_id')
    .eq('user_id', user.id)
    .eq('is_active', true);

  // Build a lookup: 'artist' → artworkId, galleryProfileId → artworkId
  const registryArtworkIdByScope: Record<string, string | null> = {};
  for (const prof of profilesWithPick || []) {
    const key = prof.role === 'artist' ? 'artist' : (prof.id as string);
    registryArtworkIdByScope[key] = (prof.registry_artwork_id as string | null) ?? null;
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
              <CollectionHeaderActions accountRole={accountRole} />
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
          registryArtworkIdByScope={registryArtworkIdByScope}
        />
      </div>
    </div>
  );
}

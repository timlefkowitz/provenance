import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { RegistryContent } from './_components/registry-content';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { isPublicDirectoryGallery } from '~/config/public-registry-galleries';
import { MIN_VERIFIED_ARTWORKS_FOR_DIRECTORY } from '~/config/registry-directory-requirements';
import { registryRowKey } from './_lib/registry-row-key';

export const metadata = {
  title: 'Artists | Provenance',
  description: 'A directory of artists and galleries on Provenance',
};

type Account = {
  id: string;
  name: string;
  picture_url: string | null;
  public_data: unknown;
  created_at: string | null;
  role?: string;
  profileId?: string;
  profileSlug?: string | null;
  listPreviewUrl: string | null;
  /** True when preview image comes from public artwork, false when it is only the profile photo. */
  listPreviewUsesArtwork: boolean;
};

type AccountRow = Omit<Account, 'listPreviewUrl' | 'listPreviewUsesArtwork'>;

type PreviewCandidate = {
  rowKey: string;
  image_url: string;
  created_at: string;
};

export default async function RegistryPage() {
  console.log('[Registry] RegistryPage load started');

  const client = getSupabaseServerClient();

  const { data: accounts, error } = await client
    .from('accounts')
    .select('id, name, picture_url, public_data, created_at')
    .order('name', { ascending: true })
    .limit(200);

  if (error) {
    console.error('[Registry] Error fetching accounts', error);
  }

  const accountsList = accounts || [];

  // Fetch gallery profiles — include registry_artwork_id so we can honor explicit picks
  const { data: galleryProfiles, error: profilesError } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, name, picture_url, role, created_at, slug, registry_artwork_id')
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(200);

  if (profilesError) {
    console.error('[Registry] Error fetching gallery profiles', profilesError);
  }

  const listedGalleryProfiles =
    (galleryProfiles as any[] ?? []).filter((p: any) =>
      isPublicDirectoryGallery({
        name: p.name,
        slug: p.slug,
      }),
    );

  console.log('[Registry] Public directory galleries', {
    listed: listedGalleryProfiles.length,
    totalGalleryProfiles: galleryProfiles?.length ?? 0,
  });

  const combinedList: AccountRow[] = [];

  listedGalleryProfiles.forEach((profile: any) => {
    combinedList.push({
      id: profile.user_id,
      name: profile.name,
      picture_url: profile.picture_url,
      public_data: { role: USER_ROLES.GALLERY },
      created_at: profile.created_at,
      role: USER_ROLES.GALLERY,
      profileId: profile.id,
      profileSlug: profile.slug ?? null,
    });
  });

  accountsList.forEach((account) => {
    const hasAnyGalleryProfile = (galleryProfiles as any[] ?? []).some((p: any) => p.user_id === account.id);
    const hasListedGalleryProfile = listedGalleryProfiles.some((p: any) => p.user_id === account.id);
    const accountRole = getUserRole(account.public_data as Record<string, unknown> | null);

    if (!hasAnyGalleryProfile) {
      combinedList.push(account);
      return;
    }

    if (hasListedGalleryProfile) {
      return;
    }

    if (accountRole !== USER_ROLES.GALLERY) {
      combinedList.push(account);
    }
  });

  const artworkCounts: Record<string, number> = {};

  const galleryProfileIds = combinedList
    .filter((a) => a.role === USER_ROLES.GALLERY && a.profileId)
    .map((a) => a.profileId!);

  const nonGalleryAccountIds = combinedList
    .filter((a) => !(a.role === USER_ROLES.GALLERY && a.profileId))
    .map((a) => a.id);

  if (galleryProfileIds.length > 0) {
    const { data: galleryArtworks } = await client
      .from('artworks')
      .select('gallery_profile_id, account_id')
      .in('gallery_profile_id', galleryProfileIds)
      .eq('status', 'verified');

    galleryArtworks?.forEach((artwork) => {
      if (artwork.gallery_profile_id) {
        const profile = combinedList.find((a) => a.profileId === artwork.gallery_profile_id);
        if (profile) {
          const key = `${profile.id}-${profile.profileId}`;
          artworkCounts[key] = (artworkCounts[key] || 0) + 1;
        }
      }
    });
  }

  if (nonGalleryAccountIds.length > 0) {
    const { data: artistArtworks } = await client
      .from('artworks')
      .select('account_id, gallery_profile_id')
      .in('account_id', nonGalleryAccountIds)
      .eq('status', 'verified');

    artistArtworks?.forEach((artwork) => {
      if (!artwork.gallery_profile_id) {
        artworkCounts[artwork.account_id] = (artworkCounts[artwork.account_id] || 0) + 1;
      }
    });
  }

  const previewByKey: Record<string, string | null> = {};
  const artworkPreviewKeys = new Set<string>();
  combinedList.forEach((a) => {
    previewByKey[registryRowKey(a)] = a.picture_url;
  });

  try {
    // ── Gallery previews: COAs only, most-recent fallback ──────────────
    if (galleryProfileIds.length > 0) {
      const { data: galleryArtRows, error: gErr } = await (client as any)
        .from('artworks')
        .select('gallery_profile_id, image_url, created_at')
        .in('gallery_profile_id', galleryProfileIds)
        .eq('status', 'verified')
        .eq('is_public', true)
        .eq('certificate_type', 'authenticity')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (gErr) {
        console.error('[Registry] Gallery preview artwork query failed', gErr);
      }

      const seenGallery = new Set<string>();
      for (const row of galleryArtRows || []) {
        const gid = row.gallery_profile_id as string | null;
        if (!gid || seenGallery.has(gid)) continue;
        seenGallery.add(gid);
        const profile = combinedList.find((a) => a.profileId === gid);
        if (!profile) continue;
        const key = registryRowKey(profile);
        const url = row.image_url as string;
        if (url) {
          previewByKey[key] = url;
          artworkPreviewKeys.add(key);
        }
      }

      // Override with user-selected registry artwork where set
      const galleryRegistryPicks = listedGalleryProfiles.filter(
        (p: any) => p.registry_artwork_id,
      );
      if (galleryRegistryPicks.length > 0) {
        const pickArtworkIds = galleryRegistryPicks.map((p: any) => p.registry_artwork_id as string);
        const { data: pickedRows } = await (client as any)
          .from('artworks')
          .select('id, gallery_profile_id, image_url')
          .in('id', pickArtworkIds)
          .eq('status', 'verified')
          .eq('is_public', true)
          .eq('certificate_type', 'authenticity')
          .not('image_url', 'is', null);

        for (const picked of pickedRows || []) {
          const gid = picked.gallery_profile_id as string | null;
          if (!gid) continue;
          const profile = combinedList.find((a) => a.profileId === gid);
          if (!profile) continue;
          const key = registryRowKey(profile);
          if (picked.image_url) {
            previewByKey[key] = picked.image_url as string;
            artworkPreviewKeys.add(key);
          }
        }
      }
    }

    // ── Artist previews: COAs only, most-recent fallback ──────────────
    if (nonGalleryAccountIds.length > 0) {
      const candidates: PreviewCandidate[] = [];

      const { data: byUploader, error: uErr } = await (client as any)
        .from('artworks')
        .select('account_id, gallery_profile_id, image_url, created_at')
        .in('account_id', nonGalleryAccountIds)
        .is('gallery_profile_id', null)
        .eq('status', 'verified')
        .eq('is_public', true)
        .eq('certificate_type', 'authenticity')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (uErr) {
        console.error('[Registry] Artist preview (uploader) query failed', uErr);
      }

      for (const row of byUploader || []) {
        const aid = row.account_id as string;
        candidates.push({
          rowKey: aid,
          image_url: row.image_url as string,
          created_at: row.created_at as string,
        });
      }

      const { data: byCredit, error: cErr } = await (client as any)
        .from('artworks')
        .select('artist_account_id, image_url, created_at')
        .in('artist_account_id', nonGalleryAccountIds)
        .eq('status', 'verified')
        .eq('is_public', true)
        .eq('certificate_type', 'authenticity')
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(2000);

      if (cErr) {
        console.error('[Registry] Artist preview (credit) query failed', cErr);
      }

      for (const row of byCredit || []) {
        const aid = row.artist_account_id as string;
        candidates.push({
          rowKey: aid,
          image_url: row.image_url as string,
          created_at: row.created_at as string,
        });
      }

      candidates.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );

      const assigned = new Set<string>();
      for (const c of candidates) {
        if (!nonGalleryAccountIds.includes(c.rowKey) || assigned.has(c.rowKey)) continue;
        assigned.add(c.rowKey);
        previewByKey[c.rowKey] = c.image_url;
        artworkPreviewKeys.add(c.rowKey);
      }

      // Override with user-selected registry artwork where set
      const { data: artistProfilesWithPick } = await (client as any)
        .from('user_profiles')
        .select('user_id, registry_artwork_id')
        .in('user_id', nonGalleryAccountIds)
        .eq('role', 'artist')
        .eq('is_active', true)
        .not('registry_artwork_id', 'is', null);

      if (artistProfilesWithPick && artistProfilesWithPick.length > 0) {
        const pickIds = artistProfilesWithPick.map((p: any) => p.registry_artwork_id as string);
        const { data: pickedArtworks } = await (client as any)
          .from('artworks')
          .select('id, account_id, artist_account_id, image_url')
          .in('id', pickIds)
          .eq('status', 'verified')
          .eq('is_public', true)
          .eq('certificate_type', 'authenticity')
          .not('image_url', 'is', null);

        const artworkById: Record<string, any> = {};
        for (const a of pickedArtworks || []) {
          artworkById[a.id] = a;
        }

        for (const prof of artistProfilesWithPick) {
          const artwork = artworkById[prof.registry_artwork_id];
          if (!artwork) continue;
          // The artwork must be related to this user
          const userId = prof.user_id as string;
          if (artwork.account_id !== userId && artwork.artist_account_id !== userId) continue;
          if (!nonGalleryAccountIds.includes(userId)) continue;
          if (artwork.image_url) {
            previewByKey[userId] = artwork.image_url as string;
            artworkPreviewKeys.add(userId);
          }
        }
      }
    }
  } catch (previewErr) {
    console.error('[Registry] Failed to resolve preview images', previewErr);
  }

  const withPreview: Account[] = combinedList.map((a) => {
    const key = registryRowKey(a);
    const url = previewByKey[key] ?? a.picture_url;
    return {
      ...a,
      listPreviewUrl: url,
      listPreviewUsesArtwork: artworkPreviewKeys.has(key),
    };
  });

  const minWorks = MIN_VERIFIED_ARTWORKS_FOR_DIRECTORY;
  const directoryAccounts = withPreview.filter((a) => {
    const key = registryRowKey(a);
    return (artworkCounts[key] ?? 0) >= minWorks;
  });

  console.log('[Registry] RegistryPage load finished', {
    combined: withPreview.length,
    afterMinArtworks: directoryAccounts.length,
    minVerifiedArtworks: minWorks,
  });

  return (
    <div className="min-h-screen bg-parchment">
      <RegistryContent accounts={directoryAccounts} artworkCounts={artworkCounts} />
    </div>
  );
}

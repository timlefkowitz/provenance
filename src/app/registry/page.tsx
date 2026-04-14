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

  const { data: galleryProfiles, error: profilesError } = await client
    .from('user_profiles')
    .select('id, user_id, name, picture_url, role, created_at, slug')
    .eq('role', USER_ROLES.GALLERY)
    .eq('is_active', true)
    .order('name', { ascending: true })
    .limit(200);

  if (profilesError) {
    console.error('[Registry] Error fetching gallery profiles', profilesError);
  }

  const listedGalleryProfiles =
    galleryProfiles?.filter((p) =>
      isPublicDirectoryGallery({
        name: p.name,
        slug: (p as { slug?: string | null }).slug,
      }),
    ) ?? [];

  console.log('[Registry] Public directory galleries', {
    listed: listedGalleryProfiles.length,
    totalGalleryProfiles: galleryProfiles?.length ?? 0,
  });

  const combinedList: AccountRow[] = [];

  listedGalleryProfiles.forEach((profile) => {
    combinedList.push({
      id: profile.user_id,
      name: profile.name,
      picture_url: profile.picture_url,
      public_data: { role: USER_ROLES.GALLERY },
      created_at: profile.created_at,
      role: USER_ROLES.GALLERY,
      profileId: profile.id,
      profileSlug: (profile as { slug?: string | null }).slug ?? null,
    });
  });

  accountsList.forEach((account) => {
    const hasAnyGalleryProfile = galleryProfiles?.some((p) => p.user_id === account.id) ?? false;
    const hasListedGalleryProfile = listedGalleryProfiles.some((p) => p.user_id === account.id);
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
    if (galleryProfileIds.length > 0) {
      const { data: galleryArtRows, error: gErr } = await (client as any)
        .from('artworks')
        .select('gallery_profile_id, image_url, created_at')
        .in('gallery_profile_id', galleryProfileIds)
        .eq('status', 'verified')
        .eq('is_public', true)
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
    }

    if (nonGalleryAccountIds.length > 0) {
      const candidates: PreviewCandidate[] = [];

      const { data: byUploader, error: uErr } = await (client as any)
        .from('artworks')
        .select('account_id, gallery_profile_id, image_url, created_at')
        .in('account_id', nonGalleryAccountIds)
        .is('gallery_profile_id', null)
        .eq('status', 'verified')
        .eq('is_public', true)
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

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserRole, USER_ROLES } from '~/lib/user-roles';
import { getArtistPublicProfileHref } from '~/lib/artist-profile-link';
import { checkRateLimit } from '~/lib/rate-limit';

const PreviewQuerySchema = z
  .object({
    accountId: z.string().uuid().optional(),
    profileId: z.string().uuid().optional(),
    posterAccountId: z.string().uuid().optional(),
  })
  .refine((data) => data.accountId || data.profileId || data.posterAccountId, {
    message: 'At least one of accountId, profileId, or posterAccountId is required',
  });

type RecentWork = {
  id: string;
  title: string;
  image_url: string | null;
};

export async function GET(request: NextRequest) {
  if (!await checkRateLimit(request, { keyPrefix: 'artist_preview', maxPerWindow: 120 })) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  console.log('[API/artist-preview] GET started');

  const parseResult = PreviewQuerySchema.safeParse({
    accountId: request.nextUrl.searchParams.get('accountId') ?? undefined,
    profileId: request.nextUrl.searchParams.get('profileId') ?? undefined,
    posterAccountId: request.nextUrl.searchParams.get('posterAccountId') ?? undefined,
  });

  if (!parseResult.success) {
    console.error('[API/artist-preview] Invalid query params', parseResult.error);
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  const { accountId, profileId, posterAccountId } = parseResult.data;

  try {
    const client = getSupabaseServerClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = client as any;

    let name: string | null = null;
    let picture_url: string | null = null;
    let bio: string | null = null;
    let medium: string | null = null;
    let location: string | null = null;
    let resolvedAccountId = accountId ?? null;
    let resolvedProfileId = profileId ?? null;
    // Set when the poster account is a gallery and we resolved its gallery
    // profile (e.g. "FL!GHT") so the panel shows the gallery, not the personal account.
    let galleryProfileSlug: string | null = null;
    let galleryProfileId: string | null = null;

    // Tracks pinned artwork IDs for the feed panel (set when a profile has overridden the default).
    let pinnedArtworkIds: string[] | null = null;

    if (accountId) {
      const { data: account, error: accountError } = await (client as any)
        .from('accounts')
        .select('id, name, picture_url, public_data')
        .eq('id', accountId)
        .maybeSingle();

      if (accountError) {
        console.error('[API/artist-preview] Account lookup failed', accountError);
      }

      if (account) {
        name = account.name;
        picture_url = account.picture_url;
        const publicData = account.public_data as Record<string, unknown> | null;
        bio = (publicData?.bio as string) ?? null;
        medium = (publicData?.medium as string) ?? null;
        location = (publicData?.location as string) ?? null;
      }

      const { data: profile } = await sb
        .from('user_profiles')
        .select('id, name, picture_url, bio, medium, location, feed_panel_artwork_ids')
        .eq('user_id', accountId)
        .eq('role', USER_ROLES.ARTIST)
        .eq('is_active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (profile) {
        resolvedProfileId = profile.id;
        name = profile.name ?? name;
        picture_url = profile.picture_url ?? picture_url;
        bio = profile.bio ?? bio;
        medium = profile.medium ?? medium;
        location = profile.location ?? location;
        const ids = profile.feed_panel_artwork_ids as string[] | null;
        if (ids && ids.length > 0) pinnedArtworkIds = ids;
      }
    } else if (profileId) {
      const { data: profile, error: profileError } = await sb
        .from('user_profiles')
        .select('id, name, picture_url, bio, medium, location, user_id, feed_panel_artwork_ids')
        .eq('id', profileId)
        .eq('role', USER_ROLES.ARTIST)
        .eq('is_active', true)
        .maybeSingle();

      if (profileError) {
        console.error('[API/artist-preview] Profile lookup failed', profileError);
      }

      if (profile) {
        resolvedProfileId = profile.id;
        resolvedAccountId = profile.user_id ?? null;
        name = profile.name;
        picture_url = profile.picture_url;
        bio = profile.bio;
        medium = profile.medium;
        location = profile.location;
        const ids = profile.feed_panel_artwork_ids as string[] | null;
        if (ids && ids.length > 0) pinnedArtworkIds = ids;
      }
    } else if (posterAccountId) {
      const { data: account } = await (client as any)
        .from('accounts')
        .select('id, name, picture_url, public_data')
        .eq('id', posterAccountId)
        .maybeSingle();

      if (account) {
        resolvedAccountId = account.id;
        name = account.name;
        picture_url = account.picture_url;
        const publicData = account.public_data as Record<string, unknown> | null;
        bio = (publicData?.bio as string) ?? null;
        medium = (publicData?.medium as string) ?? null;
        location = (publicData?.location as string) ?? null;

        // When a gallery posts a certificate (e.g. a Certificate of Show), the
        // poster account name is the owner's personal name (e.g. "timothy lefkowitz").
        // Prefer the gallery profile (e.g. "FL!GHT") so the artist panel shows the
        // gallery that posted it, mirroring the certificate page's "Uploaded by Gallery".
        const posterRole = getUserRole(publicData as Record<string, any> | null);
        if (posterRole === USER_ROLES.GALLERY) {
          const { data: galleryProfiles } = await sb
            .from('user_profiles')
            .select('id, name, picture_url, bio, medium, location, slug, feed_panel_artwork_ids')
            .eq('user_id', posterAccountId)
            .eq('role', USER_ROLES.GALLERY)
            .eq('is_active', true)
            .order('name', { ascending: true });

          let galleryProfile = null;
          if (galleryProfiles && galleryProfiles.length > 0) {
            // Prefer a profile whose name differs from the personal account name
            // (this surfaces "FL!GHT" rather than "timothy lefkowitz").
            galleryProfile =
              galleryProfiles.find(
                (p: { name: string | null }) =>
                  (p.name ?? '').toLowerCase() !== (account.name ?? '').toLowerCase(),
              ) ?? galleryProfiles[0];
          }

          if (galleryProfile) {
            name = galleryProfile.name || name;
            picture_url = galleryProfile.picture_url ?? picture_url;
            bio = galleryProfile.bio ?? bio;
            medium = galleryProfile.medium ?? medium;
            location = galleryProfile.location ?? location;
            galleryProfileId = galleryProfile.id;
            galleryProfileSlug = galleryProfile.slug ?? null;
            const ids = galleryProfile.feed_panel_artwork_ids as string[] | null;
            if (ids && ids.length > 0) pinnedArtworkIds = ids;
            console.log('[API/artist-preview] Resolved gallery profile for poster', {
              posterAccountId,
              galleryProfileId,
            });
          }
        }
      }
    }

    let profileHref: string | null;
    if (galleryProfileId) {
      profileHref = galleryProfileSlug
        ? `/g/${galleryProfileSlug}`
        : `/artists/${posterAccountId}?role=gallery&profileId=${galleryProfileId}`;
    } else {
      profileHref =
        getArtistPublicProfileHref({
          artist_account_id: resolvedAccountId,
          artist_profile_id: resolvedProfileId,
        }) ?? (posterAccountId ? `/artists/${posterAccountId}` : null);
    }

    let recentWorks: RecentWork[] = [];

    // For a gallery poster we show what the gallery posted (any certificate type),
    // not works where the gallery account is credited as the artist.
    const isGalleryPoster = !!galleryProfileId;

    if (pinnedArtworkIds && pinnedArtworkIds.length > 0) {
      // Artist or gallery has pinned specific artworks — fetch them in order.
      const { data: pinned, error: pinnedError } = await sb
        .from('artworks')
        .select('id, title, image_url')
        .in('id', pinnedArtworkIds)
        .eq('status', 'verified')
        .eq('is_public', true);

      if (pinnedError) {
        console.error('[API/artist-preview] Pinned works lookup failed', pinnedError);
      } else {
        // Preserve the user-defined order
        const byId = new Map((pinned ?? []).map((w: RecentWork) => [w.id, w]));
        recentWorks = pinnedArtworkIds.map((id) => byId.get(id)).filter(Boolean) as RecentWork[];
      }
    } else {
      const worksFilters: string[] = [];
      if (!isGalleryPoster) {
        if (resolvedAccountId) worksFilters.push(`artist_account_id.eq.${resolvedAccountId}`);
        if (resolvedProfileId) worksFilters.push(`artist_profile_id.eq.${resolvedProfileId}`);
      }
      if (posterAccountId && worksFilters.length === 0) {
        worksFilters.push(`account_id.eq.${posterAccountId}`);
      }

      if (worksFilters.length > 0) {
        let worksQuery = sb
          .from('artworks')
          .select('id, title, image_url')
          .eq('status', 'verified')
          .eq('is_public', true);

        // Gallery feed entries are Certificates of Show; restrict to authenticity
        // only when surfacing an individual artist's catalog.
        if (!isGalleryPoster) {
          worksQuery = worksQuery.eq('certificate_type', 'authenticity');
        }

        const { data: works, error: worksError } = await worksQuery
          .or(worksFilters.join(','))
          .order('created_at', { ascending: false })
          .limit(3);

        if (worksError) {
          console.error('[API/artist-preview] Recent works lookup failed', worksError);
        } else {
          recentWorks = works ?? [];
        }
      }
    }

    console.log('[API/artist-preview] Preview resolved', {
      name,
      hasProfileHref: !!profileHref,
      recentWorksCount: recentWorks.length,
    });

    return NextResponse.json({
      name,
      picture_url,
      bio,
      medium,
      location,
      profileHref,
      recentWorks,
    });
  } catch (err) {
    console.error('[API/artist-preview] Unexpected error', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { USER_ROLES } from '~/lib/user-roles';
import { getArtistPublicProfileHref } from '~/lib/artist-profile-link';

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

    if (accountId) {
      const { data: account, error: accountError } = await client
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
        .select('id, name, picture_url, bio, medium, location')
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
      }
    } else if (profileId) {
      const { data: profile, error: profileError } = await sb
        .from('user_profiles')
        .select('id, name, picture_url, bio, medium, location, user_id')
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
      }
    } else if (posterAccountId) {
      const { data: account } = await client
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
      }
    }

    const profileHref =
      getArtistPublicProfileHref({
        artist_account_id: resolvedAccountId,
        artist_profile_id: resolvedProfileId,
      }) ?? (posterAccountId ? `/artists/${posterAccountId}` : null);

    let recentWorks: RecentWork[] = [];

    const worksFilters: string[] = [];
    if (resolvedAccountId) worksFilters.push(`artist_account_id.eq.${resolvedAccountId}`);
    if (resolvedProfileId) worksFilters.push(`artist_profile_id.eq.${resolvedProfileId}`);
    if (posterAccountId && worksFilters.length === 0) {
      worksFilters.push(`account_id.eq.${posterAccountId}`);
    }

    if (worksFilters.length > 0) {
      const { data: works, error: worksError } = await sb
        .from('artworks')
        .select('id, title, image_url')
        .eq('status', 'verified')
        .eq('certificate_type', 'authenticity')
        .eq('is_public', true)
        .or(worksFilters.join(','))
        .order('created_at', { ascending: false })
        .limit(3);

      if (worksError) {
        console.error('[API/artist-preview] Recent works lookup failed', worksError);
      } else {
        recentWorks = works ?? [];
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

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type {
  SiteData,
  SiteTheme,
  SiteSections,
  SiteCta,
  SiteArtworkFilters,
  CertificateTypeKey,
} from '~/app/_sites/types';
import {
  DEFAULT_THEME,
  DEFAULT_SECTIONS,
  DEFAULT_ARTWORK_FILTERS,
} from '~/app/_sites/types';

/**
 * Resolve a site handle → full SiteData for rendering.
 * Returns null if the site doesn't exist or is not published.
 *
 * Uses the service client (anon key is fine for public reads; RLS allows
 * published sites to be read by anyone).
 */
export async function getSiteData(handle: string): Promise<SiteData | null> {
  console.log('[Sites] getSiteData', { handle });
  const client = getSupabaseServerClient();
  const sb = client as any;

  // 1. Resolve profile_sites row by handle
  const { data: siteRow, error: siteErr } = await sb
    .from('profile_sites')
    .select('*')
    .eq('handle', handle.toLowerCase())
    .maybeSingle();

  if (siteErr) {
    console.error('[Sites] getSiteData profile_sites query failed', siteErr);
    return null;
  }
  if (!siteRow) {
    return null;
  }

  // 2. Resolve the owning user_profile
  const { data: profile, error: profileErr } = await sb
    .from('user_profiles')
    .select(
      'id, user_id, name, role, bio, medium, location, website, picture_url, links, news_publications',
    )
    .eq('id', siteRow.profile_id)
    .eq('is_active', true)
    .maybeSingle();

  if (profileErr || !profile) {
    console.error('[Sites] getSiteData user_profiles query failed', profileErr);
    return null;
  }

  const sections: SiteSections = {
    ...DEFAULT_SECTIONS,
    ...(siteRow.sections ?? {}),
  };

  const theme: SiteTheme = {
    ...DEFAULT_THEME,
    ...(siteRow.theme ?? {}),
  };

  const cta: SiteCta | null = siteRow.cta ?? null;

  const artworkFilters: SiteArtworkFilters = {
    ...DEFAULT_ARTWORK_FILTERS,
    ...(siteRow.artwork_filters ?? {}),
  };
  const allowedCertTypes = (artworkFilters.certificate_types?.length
    ? artworkFilters.certificate_types
    : DEFAULT_ARTWORK_FILTERS.certificate_types) as CertificateTypeKey[];

  // 3. Fetch public artworks (up to 24), filtered by chosen certificate types
  //
  // The link between an artwork and a profile depends on the profile role:
  //   - gallery: artworks have `gallery_profile_id = profile.id` (these are
  //     Certificates of Show, including those posted by gallery team members).
  //   - artist:  matched via `artist_account_id`, `artist_profile_id`, or a
  //     legacy `account_id` upload that hasn't been linked to an artist yet.
  //   - other (collector / fallback): artworks they own via `account_id`.
  //
  // Without the gallery branch, a gallery's COSes never appear on its site.
  const artworks: SiteData['artworks'] = [];
  if (sections.artworks) {
    let q = sb
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number, certificate_type')
      .eq('status', 'verified')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(24);

    if (profile.role === 'gallery') {
      console.log('[Sites] artworks query: gallery branch', {
        galleryProfileId: profile.id,
      });
      q = q.eq('gallery_profile_id', profile.id);
    } else if (profile.role === 'artist') {
      console.log('[Sites] artworks query: artist branch', {
        userId: profile.user_id,
        profileId: profile.id,
      });
      q = q.or(
        [
          `artist_account_id.eq.${profile.user_id}`,
          `artist_profile_id.eq.${profile.id}`,
          `and(account_id.eq.${profile.user_id},artist_account_id.is.null,artist_profile_id.is.null)`,
        ].join(','),
      );
    } else {
      console.log('[Sites] artworks query: default branch', {
        userId: profile.user_id,
      });
      q = q.or(
        [
          `artist_account_id.eq.${profile.user_id}`,
          `and(account_id.eq.${profile.user_id},artist_account_id.is.null)`,
        ].join(','),
      );
    }

    if (allowedCertTypes.length > 0 && allowedCertTypes.length < 3) {
      q = q.in('certificate_type', allowedCertTypes);
    }

    const { data: artworkRows, error: artworkErr } = await q;
    if (artworkErr) {
      console.error('[Sites] artworks query failed', artworkErr);
    }

    for (const row of artworkRows ?? []) {
      artworks.push({
        id: row.id,
        title: row.title,
        artist_name: row.artist_name ?? null,
        image_url: row.image_url ?? null,
        created_at: row.created_at,
        certificate_number: row.certificate_number,
      });
    }
  }

  // 4. Fetch exhibitions
  const exhibitions: SiteData['exhibitions'] = [];
  if (sections.exhibitions) {
    const { data: exhibitionRows } = await sb
      .from('exhibitions')
      .select('id, title, start_date, end_date, location, image_url')
      .eq('gallery_id', profile.user_id)
      .order('start_date', { ascending: false })
      .limit(12);

    for (const row of exhibitionRows ?? []) {
      exhibitions.push({
        id: row.id,
        title: row.title,
        start_date: row.start_date,
        end_date: row.end_date ?? null,
        location: row.location ?? null,
        image_url: row.image_url ?? null,
      });
    }
  }

  // 5. Press
  const press: SiteData['press'] = sections.press
    ? ((profile.news_publications as SiteData['press']) ?? [])
    : [];

  console.log('[Sites] getSiteData resolved', {
    handle,
    artworks: artworks.length,
    exhibitions: exhibitions.length,
    press: press.length,
  });

  return {
    handle: siteRow.handle,
    template_id: siteRow.template_id,
    theme,
    sections,
    cta,
    published_at: siteRow.published_at,
    hero_image_url: siteRow.hero_image_url ?? null,
    tagline: siteRow.tagline ?? null,
    name: profile.name,
    display_name: siteRow.display_name ?? null,
    bio: siteRow.about_override ?? profile.bio ?? null,
    location: profile.location ?? null,
    website: profile.website ?? null,
    picture_url: profile.picture_url ?? null,
    medium: profile.medium ?? null,
    role: profile.role,
    artworks,
    exhibitions,
    press,
    surface_color: siteRow.surface_color ?? null,
    custom_domain: siteRow.custom_domain ?? null,
  };
}

/**
 * Get the SiteData for a profile_id (used in the editor to preview unpublished drafts).
 * Only callable server-side with the authenticated user's session.
 */
// Re-export so preview page and other callers can resolve the root domain consistently
export function getRootDomain(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.guru';
  const h = new URL(raw).hostname;
  return h.startsWith('www.') ? h.slice(4) : h;
}

export async function getSiteDataByProfileId(profileId: string): Promise<SiteData | null> {
  console.log('[Sites] getSiteDataByProfileId', { profileId });
  const client = getSupabaseServerClient();
  const sb = client as any;

  const { data: siteRow, error } = await sb
    .from('profile_sites')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[Sites] getSiteDataByProfileId failed', error);
    return null;
  }
  if (!siteRow) return null;

  return getSiteData(siteRow.handle);
}

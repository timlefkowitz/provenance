import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type {
  SiteData,
  SiteTheme,
  SiteSections,
  SiteCta,
} from '~/app/_sites/types';
import { DEFAULT_THEME, DEFAULT_SECTIONS } from '~/app/_sites/types';

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

  // 3. Fetch public artworks (up to 24)
  const artworks: SiteData['artworks'] = [];
  if (sections.artworks) {
    const { data: artworkRows } = await sb
      .from('artworks')
      .select('id, title, artist_name, image_url, created_at, certificate_number')
      .or(
        [
          `artist_account_id.eq.${profile.user_id}`,
          `and(account_id.eq.${profile.user_id},artist_account_id.is.null)`,
        ].join(','),
      )
      .eq('status', 'verified')
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(24);

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
    name: profile.name,
    bio: profile.bio ?? null,
    location: profile.location ?? null,
    website: profile.website ?? null,
    picture_url: profile.picture_url ?? null,
    medium: profile.medium ?? null,
    role: profile.role,
    artworks,
    exhibitions,
    press,
    custom_domain: siteRow.custom_domain ?? null,
  };
}

/**
 * Get the SiteData for a profile_id (used in the editor to preview unpublished drafts).
 * Only callable server-side with the authenticated user's session.
 */
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

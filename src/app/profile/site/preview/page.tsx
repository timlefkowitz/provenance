import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getUserProfiles } from '~/app/profiles/_actions/get-user-profiles';
import { getSiteData } from '~/app/_sites/[handle]/_data/get-site-data';
import { getSiteConfig } from '../_actions/get-site-config';
import { EditorialTemplate } from '~/app/_sites/_templates/editorial';
import { StudioTemplate } from '~/app/_sites/_templates/studio';
import { AtelierTemplate } from '~/app/_sites/_templates/atelier';
import type { SiteData } from '~/app/_sites/types';
import { DEFAULT_SECTIONS, DEFAULT_THEME } from '~/app/_sites/types';

export const dynamic = 'force-dynamic';

export default async function SitePreviewPage() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const profiles = await getUserProfiles(user.id);
  if (profiles.length === 0) {
    redirect('/profile/site');
  }

  const activeProfile = profiles[0];
  const config = await getSiteConfig(activeProfile.id);

  if (!config?.handle) {
    redirect('/profile/site');
  }

  // Fetch the full SiteData — getSiteData requires published_at by default.
  // For preview we build a preview-ready SiteData directly from config + profile data.
  const sb = client as any;

  const { data: profile } = await sb
    .from('user_profiles')
    .select('id, user_id, name, role, bio, medium, location, website, picture_url, links, news_publications')
    .eq('id', activeProfile.id)
    .eq('is_active', true)
    .maybeSingle();

  const sections = { ...DEFAULT_SECTIONS, ...(config.sections ?? {}) };
  const theme = { ...DEFAULT_THEME, ...(config.theme ?? {}) };

  // Artworks
  const { data: artworkRows } = await sb
    .from('artworks')
    .select('id, title, artist_name, image_url, created_at, certificate_number')
    .or([
      `artist_account_id.eq.${user.id}`,
      `and(account_id.eq.${user.id},artist_account_id.is.null)`,
    ].join(','))
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .limit(24);

  // Exhibitions
  const { data: exhibitionRows } = await sb
    .from('exhibitions')
    .select('id, title, start_date, end_date, location, image_url')
    .eq('gallery_id', user.id)
    .order('start_date', { ascending: false })
    .limit(12);

  const siteData: SiteData = {
    handle: config.handle,
    template_id: config.templateId,
    theme,
    sections,
    cta: config.cta,
    published_at: config.publishedAt,
    name: profile?.name ?? activeProfile.name,
    bio: profile?.bio ?? null,
    location: profile?.location ?? null,
    website: profile?.website ?? null,
    picture_url: profile?.picture_url ?? null,
    medium: profile?.medium ?? null,
    role: profile?.role ?? activeProfile.role,
    artworks: (artworkRows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      artist_name: r.artist_name ?? null,
      image_url: r.image_url ?? null,
      created_at: r.created_at,
      certificate_number: r.certificate_number,
    })),
    exhibitions: (exhibitionRows ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      start_date: r.start_date,
      end_date: r.end_date ?? null,
      location: r.location ?? null,
      image_url: r.image_url ?? null,
    })),
    press: sections.press
      ? ((profile?.news_publications as SiteData['press']) ?? [])
      : [],
    custom_domain: null,
  };

  const accentMap: Record<string, string> = {
    wine: '#4A2F25', slate: '#3D4B5C', forest: '#2D4A3E',
    sand: '#8B7355', midnight: '#1A1A2E', rose: '#8B4558',
  };
  const accentColor = accentMap[theme.accent] ?? '#4A2F25';

  return (
    <div className="relative">
      {/* ── Floating preview banner ── */}
      <div
        className="fixed top-0 inset-x-0 z-[9999] flex items-center justify-between gap-4 px-4 py-2.5 shadow-md"
        style={{ background: accentColor }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'system-ui, sans-serif' }}
          >
            Preview
          </span>
          <span
            className="text-xs"
            style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'system-ui, sans-serif' }}
          >
            {config.templateId.charAt(0).toUpperCase() + config.templateId.slice(1)} template ·{' '}
            {config.handle}.{config.siteDomain}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {config.publishedAt ? (
            <a
              href={config.siteUrl ?? '#'}
              target="_blank"
              rel="noreferrer"
              className="text-xs px-3 py-1 rounded border transition-opacity hover:opacity-80"
              style={{
                color: '#fff',
                borderColor: 'rgba(255,255,255,0.4)',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              Visit live site ↗
            </a>
          ) : (
            <span
              className="text-xs"
              style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'system-ui, sans-serif' }}
            >
              Not yet published
            </span>
          )}
          <Link
            href="/profile/site"
            className="text-xs px-3 py-1.5 rounded font-medium transition-opacity hover:opacity-80"
            style={{
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            ← Back to editor
          </Link>
        </div>
      </div>

      {/* Push content below the fixed banner */}
      <div style={{ paddingTop: '40px' }}>
        {/* Inject accent CSS var so templates' var(--site-accent) resolves */}
        <style>{`:root { --site-accent: ${accentColor}; }`}</style>

        {config.templateId === 'editorial' && <EditorialTemplate site={siteData} />}
        {config.templateId === 'studio' && <StudioTemplate site={siteData} />}
        {config.templateId === 'atelier' && <AtelierTemplate site={siteData} />}
      </div>
    </div>
  );
}

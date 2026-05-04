import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { getSiteConfig } from '../_actions/get-site-config';
import { EditorialTemplate } from '~/app/_sites/_templates/editorial';
import { StudioTemplate } from '~/app/_sites/_templates/studio';
import { AtelierTemplate } from '~/app/_sites/_templates/atelier';
import type { SiteData } from '~/app/_sites/types';

export const dynamic = 'force-dynamic';

/**
 * Preview the configured site for an authenticated owner / team member.
 *
 * Query params:
 *   profileId — required, the user_profiles id whose site to preview
 *   embed=1   — render without the floating preview banner (used inside the editor iframe)
 */
export default async function SitePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{ profileId?: string; embed?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const profileId = params.profileId;
  const embedMode = params.embed === '1';

  const client = getSupabaseServerClient();
  const { data: { user } } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  if (!profileId) {
    redirect('/profile/site');
  }

  // Verify access (owner or gallery team)
  const sb = client as any;
  const { data: profile } = await sb
    .from('user_profiles')
    .select('id, user_id, name, role, bio, medium, location, website, picture_url, links, news_publications')
    .eq('id', profileId)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile) redirect('/profile/site');
  let hasAccess = profile.user_id === user.id;
  if (!hasAccess && profile.role === 'gallery') {
    hasAccess = await canManageGallery(user.id, profileId);
  }
  if (!hasAccess) redirect('/profile/site');

  const config = await getSiteConfig(profileId);
  if (!config?.handle) {
    return <PreviewEmptyState handleMissing embed={embedMode} />;
  }

  // Build artworks query, applying certificate-type filter
  const allowedTypes = config.artworkFilters.certificate_types ?? [];
  let artworkQuery = sb
    .from('artworks')
    .select('id, title, artist_name, image_url, created_at, certificate_number, certificate_type')
    .or([
      `artist_account_id.eq.${profile.user_id}`,
      `and(account_id.eq.${profile.user_id},artist_account_id.is.null)`,
    ].join(','))
    .eq('status', 'verified')
    .order('created_at', { ascending: false })
    .limit(24);
  if (allowedTypes.length > 0 && allowedTypes.length < 3) {
    artworkQuery = artworkQuery.in('certificate_type', allowedTypes);
  }
  const { data: artworkRows } = await artworkQuery;

  const { data: exhibitionRows } = await sb
    .from('exhibitions')
    .select('id, title, start_date, end_date, location, image_url')
    .eq('gallery_id', profile.user_id)
    .order('start_date', { ascending: false })
    .limit(12);

  const siteData: SiteData = {
    handle: config.handle,
    template_id: config.templateId,
    theme: config.theme,
    sections: config.sections,
    cta: config.cta,
    published_at: config.publishedAt,
    hero_image_url: config.heroImageUrl,
    tagline: config.tagline,
    name: profile.name,
    bio: config.aboutOverride ?? profile.bio ?? null,
    location: profile.location ?? null,
    website: profile.website ?? null,
    picture_url: profile.picture_url ?? null,
    medium: profile.medium ?? null,
    role: profile.role,
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
    press: config.sections.press
      ? ((profile.news_publications as SiteData['press']) ?? [])
      : [],
    surface_color: config.surfaceColor,
    custom_domain: null,
  };

  const accentMap: Record<string, string> = {
    wine: '#4A2F25', slate: '#3D4B5C', forest: '#2D4A3E',
    sand: '#8B7355', midnight: '#1A1A2E', rose: '#8B4558',
  };
  const accentColor = accentMap[config.theme.accent] ?? '#4A2F25';

  const TemplateComponent =
    config.templateId === 'editorial' ? EditorialTemplate :
    config.templateId === 'atelier' ? AtelierTemplate :
    StudioTemplate;

  return (
    <div className="relative">
      <style>{`:root { --site-accent: ${accentColor}; }`}</style>

      {!embedMode && (
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
              {profile.name} · {config.templateId} · {config.handle}.{config.siteDomain}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {config.publishedAt && config.siteUrl ? (
              <a
                href={config.siteUrl}
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
              href={`/profile/site?profileId=${profileId}`}
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
      )}

      <div style={{ paddingTop: embedMode ? 0 : '40px' }}>
        <TemplateComponent site={siteData} />
      </div>
    </div>
  );
}

function PreviewEmptyState({ handleMissing, embed }: { handleMissing: boolean; embed: boolean }) {
  return (
    <div
      style={{
        minHeight: '100svh',
        background: '#FAF7F0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        fontFamily: 'system-ui, sans-serif',
        textAlign: 'center',
      }}
    >
      <div style={{ maxWidth: '24rem' }}>
        <p style={{ fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#aaa' }}>
          Preview
        </p>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginTop: '0.5rem', color: '#222' }}>
          {handleMissing ? 'No site saved yet' : 'Nothing to preview yet'}
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#777', marginTop: '0.75rem', lineHeight: '1.5' }}>
          {handleMissing
            ? 'Type a handle in the editor and click "Save & refresh preview" to see your site here.'
            : 'Select a profile and save a handle in the editor.'}
        </p>
        {embed && (
          <p style={{ fontSize: '0.75rem', color: '#bbb', marginTop: '1rem' }}>
            ↑ Use the Save button above
          </p>
        )}
        {!embed && (
          <a
            href="/profile/site"
            style={{ display: 'inline-block', marginTop: '1.25rem', fontSize: '0.85rem', color: '#4A2F25', textDecoration: 'underline' }}
          >
            ← Back to editor
          </a>
        )}
      </div>
    </div>
  );
}

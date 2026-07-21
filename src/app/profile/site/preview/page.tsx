import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getActiveSubscription } from '~/lib/subscription';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { getSiteConfig } from '../_actions/get-site-config';
import { renderSiteTemplate } from '~/app/_sites/_templates/render-template';
import {
  resolveAccent,
  isValidSurfaceKey,
  isValidFontPairingKey,
  isValidHexColor,
} from '~/app/_sites/_templates/palette';
import { SiteFontStyles } from '~/app/_sites/_components/site-font-styles';
import {
  ProvenanceSiteBar,
  PoweredByProvenanceFooter,
} from '~/app/_sites/_components/provenance-site-bar';
import { EditModeWrapper } from './_components/edit-mode-wrapper';
import type { SiteData, TemplateId, SiteSectionKey } from '~/app/_sites/types';
import { SITE_TEMPLATES, ORDERABLE_SECTION_KEYS } from '~/app/_sites/types';
import {
  getEligibleSiteArtworks,
  getFeaturedSiteArtworks,
} from '~/app/_sites/_data/get-eligible-site-artworks';
import { asUntyped } from '~/lib/supabase-untyped';

export const dynamic = 'force-dynamic';

/**
 * Preview the configured site for an authenticated owner / team member.
 *
 * Query params:
 *   profileId — required, the user_profiles id whose site to preview
 *   embed=1   — render without the floating preview banner (used inside the editor iframe)
 *   template  — optional design override (unsaved editor state)
 *   accent    — optional accent override (preset key or #hex)
 *   surface   — optional surface override
 *   font      — optional font_pairing override
 */
export default async function SitePreviewPage({
  searchParams,
}: {
  searchParams?: Promise<{
    profileId?: string;
    embed?: string;
    template?: string;
    accent?: string;
    surface?: string;
    font?: string;
    ink?: string;
    v?: string;
  }>;
}) {
  const params = (await searchParams) ?? {};
  const profileId = params.profileId;
  const embedMode = params.embed === '1';

  const client = asUntyped(getSupabaseServerClient());
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

  const subscription = await getActiveSubscription(user.id);
  const isWhiteLabel = subscription !== null;

  const config = await getSiteConfig(profileId);
  if (!config?.handle) {
    return <PreviewEmptyState handleMissing embed={embedMode} />;
  }

  const validTemplateIds = new Set(SITE_TEMPLATES.map((t) => t.id));
  const templateOverride =
    params.template && validTemplateIds.has(params.template as TemplateId)
      ? (params.template as TemplateId)
      : null;
  const accentOverride = params.accent?.trim() || null;
  const surfaceOverride =
    params.surface && isValidSurfaceKey(params.surface) ? params.surface : null;
  const fontOverride =
    params.font && isValidFontPairingKey(params.font) ? params.font : null;
  const inkOverride =
    params.ink && isValidHexColor(params.ink) ? params.ink : null;

  const effectiveTemplateId = templateOverride ?? config.templateId;
  const effectiveAccent = accentOverride ?? config.theme.accent;
  const effectiveSurface = surfaceOverride ?? config.surfaceColor;
  const effectiveFontPairing = fontOverride ?? config.theme.font_pairing;
  const effectiveTextColor = inkOverride ?? config.theme.text_color ?? null;
  const effectiveTheme = {
    ...config.theme,
    accent: effectiveAccent,
    font_pairing: effectiveFontPairing,
    text_color: effectiveTextColor,
  };

  console.log('[SitePreview] design overrides', {
    templateOverride,
    accentOverride,
    surfaceOverride,
    fontOverride,
    inkOverride,
  });

  // Fetch artworks: curated if featured_artwork_ids set, else auto.
  const featuredIds: string[] = Array.isArray(config.featuredArtworkIds)
    ? (config.featuredArtworkIds as string[]).filter(Boolean)
    : [];

  let artworkRows: unknown[];
  if (featuredIds.length > 0) {
    console.log('[SitePreview] artworks: curated mode', { count: featuredIds.length });
    artworkRows = await getFeaturedSiteArtworks(sb, featuredIds);
  } else {
    console.log('[SitePreview] artworks: auto mode', { role: profile.role });
    artworkRows = await getEligibleSiteArtworks(
      sb,
      profile,
      config.artworkFilters,
      24,
    );
  }

  const { data: exhibitionRows } = await sb
    .from('exhibitions')
    .select('id, title, start_date, end_date, location, image_url')
    .eq('gallery_id', profile.user_id)
    .not('published_at', 'is', null)
    .order('start_date', { ascending: false })
    .limit(12);

  const siteData: SiteData = {
    handle: config.handle,
    template_id: effectiveTemplateId,
    theme: effectiveTheme,
    sections: config.sections,
    cta: config.cta,
    published_at: config.publishedAt,
    hero_image_url: config.heroImageUrl,
    tagline: config.tagline,
    name: profile.name,
    display_name: config.displayName,
    logo_image_url: config.logoImageUrl,
    bio: config.aboutOverride ?? profile.bio ?? null,
    location: profile.location ?? null,
    website: profile.website ?? null,
    picture_url: profile.picture_url ?? null,
    medium: profile.medium ?? null,
    role: profile.role,
    artworks: ((artworkRows ?? []) as Record<string, unknown>[]).map((r) => ({
      id: r.id as string,
      title: r.title as string,
      artist_name: (r.artist_name ?? null) as string | null,
      image_url: (r.image_url ?? null) as string | null,
      created_at: r.created_at as string,
      certificate_number: r.certificate_number as string,
      for_sale: (r.for_sale ?? false) as boolean,
      sale_price: (r.sale_price ?? null) as number | null,
      sale_currency: (r.sale_currency ?? null) as string | null,
      sold_at: (r.sold_at ?? null) as string | null,
    })),
    exhibitions: (exhibitionRows ?? []).map((r: Record<string, unknown>) => ({
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
    surface_color: effectiveSurface,
    custom_domain: config.customDomainVerifiedAt ? config.customDomain : null,
    is_white_label: isWhiteLabel,
    section_order: config.sectionOrder,
  };

  const accentColor = resolveAccent(effectiveAccent);

  return (
    <div className="relative">
      <SiteFontStyles fontPairingKey={effectiveFontPairing} />
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
              {profile.name} · {effectiveTemplateId} · {config.handle}.{config.siteDomain}
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
        {embedMode ? (
          // Edit mode: live-reactive wrapper handles bridge overrides client-side
          <EditModeWrapper
            initialData={siteData}
            chrome={
              <>
                {!isWhiteLabel && <ProvenanceSiteBar />}
              </>
            }
          />
        ) : (
          <>
            {!isWhiteLabel && <ProvenanceSiteBar />}
            {renderSiteTemplate(siteData)}
          </>
        )}
        {!embedMode && !isWhiteLabel && <PoweredByProvenanceFooter />}
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

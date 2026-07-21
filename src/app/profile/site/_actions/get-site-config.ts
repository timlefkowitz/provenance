'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type {
  TemplateId,
  SiteTheme,
  SiteSections,
  SiteCta,
  SiteArtworkFilters,
  SiteSectionKey,
} from '~/app/_sites/types';
import {
  DEFAULT_THEME,
  DEFAULT_SECTIONS,
  DEFAULT_ARTWORK_FILTERS,
  DEFAULT_SURFACE,
  ORDERABLE_SECTION_KEYS,
} from '~/app/_sites/types';

export type SiteConfig = {
  profileId: string;
  handle: string;
  templateId: TemplateId;
  theme: SiteTheme;
  sections: SiteSections;
  cta: SiteCta | null;
  heroImageUrl: string | null;
  tagline: string | null;
  aboutOverride: string | null;
  /** Optional display name override shown in the site header/logo */
  displayName: string | null;
  /** Optional logo image URL — replaces the text name in hero / nav */
  logoImageUrl: string | null;
  surfaceColor: string;
  artworkFilters: SiteArtworkFilters;
  /** Ordered array of artwork UUIDs pinned for curation. Empty = auto. */
  featuredArtworkIds: string[];
  /** Section display order. null = template default. */
  sectionOrder: SiteSectionKey[] | null;
  /** Ordered array of exhibition UUIDs pinned for curation. Empty = auto. */
  featuredExhibitionIds: string[];
  /** What happens when a visitor clicks an artwork thumbnail. */
  artworkClickBehavior: 'page' | 'modal' | 'lightbox';
  publishedAt: string | null;
  siteUrl: string | null;
  /** Root hostname without www. (e.g. "provenance.guru") */
  siteDomain: string;
  customDomain: string | null;
  customDomainVerifiedAt: string | null;
};

function parseSectionOrder(raw: unknown): SiteSectionKey[] | null {
  if (!Array.isArray(raw)) return null;
  const valid = raw.filter((k): k is SiteSectionKey => ORDERABLE_SECTION_KEYS.includes(k as SiteSectionKey));
  return valid.length > 0 ? valid : null;
}

/**
 * Fetch the site config for a profile. Returns null if no row exists yet.
 */
export async function getSiteConfig(profileId: string): Promise<SiteConfig | null> {
  console.log('[Sites] getSiteConfig query', { profileId });
  const client = getSupabaseServerClient();

  const { data, error } = await asUntyped(client)
    .from('profile_sites')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[Sites] getSiteConfig failed', { profileId, error });
    return null;
  }
  if (!data) {
    console.log('[Sites] getSiteConfig: no row for profile', { profileId });
    return null;
  }
  console.log('[Sites] getSiteConfig: row found', { profileId, handle: data.handle, published: !!data.published_at });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://provenance.guru';
  const rawHost = new URL(baseUrl).hostname;
  const siteDomain = rawHost.startsWith('www.') ? rawHost.slice(4) : rawHost;
  const siteUrl = data.published_at ? `https://${data.handle}.${siteDomain}` : null;

  return {
    profileId: data.profile_id,
    handle: data.handle,
    templateId: data.template_id as TemplateId,
    theme: { ...DEFAULT_THEME, ...(data.theme ?? {}) },
    sections: { ...DEFAULT_SECTIONS, ...(data.sections ?? {}) },
    cta: data.cta ?? null,
    heroImageUrl: data.hero_image_url ?? null,
    tagline: data.tagline ?? null,
    aboutOverride: data.about_override ?? null,
    displayName: data.display_name ?? null,
    logoImageUrl: data.logo_image_url ?? null,
    surfaceColor: data.surface_color ?? DEFAULT_SURFACE,
    artworkFilters: { ...DEFAULT_ARTWORK_FILTERS, ...(data.artwork_filters ?? {}) },
    featuredArtworkIds: Array.isArray(data.featured_artwork_ids) ? (data.featured_artwork_ids as string[]).filter(Boolean) : [],
    sectionOrder: parseSectionOrder(data.section_order),
    featuredExhibitionIds: Array.isArray(data.featured_exhibition_ids) ? (data.featured_exhibition_ids as string[]).filter(Boolean) : [],
    artworkClickBehavior: (['page', 'modal', 'lightbox'].includes(data.artwork_click_behavior) ? data.artwork_click_behavior : 'page') as 'page' | 'modal' | 'lightbox',
    publishedAt: data.published_at ?? null,
    siteUrl,
    siteDomain,
    customDomain: data.custom_domain ?? null,
    customDomainVerifiedAt: data.custom_domain_verified_at ?? null,
  };
}

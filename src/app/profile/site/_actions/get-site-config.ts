'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type {
  TemplateId,
  SiteTheme,
  SiteSections,
  SiteCta,
  SiteArtworkFilters,
} from '~/app/_sites/types';
import {
  DEFAULT_THEME,
  DEFAULT_SECTIONS,
  DEFAULT_ARTWORK_FILTERS,
  DEFAULT_SURFACE,
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
  surfaceColor: string;
  artworkFilters: SiteArtworkFilters;
  publishedAt: string | null;
  siteUrl: string | null;
  /** Root hostname without www. (e.g. "provenance.guru") */
  siteDomain: string;
};

/**
 * Fetch the site config for a profile. Returns null if no row exists yet.
 */
export async function getSiteConfig(profileId: string): Promise<SiteConfig | null> {
  const client = getSupabaseServerClient();

  const { data, error } = await (client as any)
    .from('profile_sites')
    .select('*')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (error) {
    console.error('[Sites] getSiteConfig failed', error);
    return null;
  }
  if (!data) return null;

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
    surfaceColor: data.surface_color ?? DEFAULT_SURFACE,
    artworkFilters: { ...DEFAULT_ARTWORK_FILTERS, ...(data.artwork_filters ?? {}) },
    publishedAt: data.published_at ?? null,
    siteUrl,
    siteDomain,
  };
}

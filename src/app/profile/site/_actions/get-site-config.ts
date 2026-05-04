'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { TemplateId, SiteTheme, SiteSections, SiteCta } from '~/app/_sites/types';
import { DEFAULT_THEME, DEFAULT_SECTIONS } from '~/app/_sites/types';

export type SiteConfig = {
  profileId: string;
  handle: string;
  templateId: TemplateId;
  theme: SiteTheme;
  sections: SiteSections;
  cta: SiteCta | null;
  publishedAt: string | null;
  siteUrl: string | null;
  /** Root hostname without www. (e.g. "provenance.guru") */
  siteDomain: string;
};

/**
 * Fetch the current user's site config for the given profile.
 * Returns null if no site has been configured yet.
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
  // Strip www. to get the root domain for subdomain construction
  const siteDomain = rawHost.startsWith('www.') ? rawHost.slice(4) : rawHost;
  const siteUrl = data.published_at ? `https://${data.handle}.${siteDomain}` : null;

  return {
    profileId: data.profile_id,
    handle: data.handle,
    templateId: data.template_id as TemplateId,
    theme: { ...DEFAULT_THEME, ...(data.theme ?? {}) },
    sections: { ...DEFAULT_SECTIONS, ...(data.sections ?? {}) },
    cta: data.cta ?? null,
    publishedAt: data.published_at ?? null,
    siteUrl,
    siteDomain,
  };
}

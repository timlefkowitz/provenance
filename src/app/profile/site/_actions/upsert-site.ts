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
  DEFAULT_SECTIONS,
  DEFAULT_THEME,
  DEFAULT_ARTWORK_FILTERS,
} from '~/app/_sites/types';
import { canManageGallery } from '~/app/profiles/_actions/gallery-members';
import { validateHandleAction } from './validate-handle';

export type UpsertSiteInput = {
  profileId: string;
  handle: string;
  templateId: TemplateId;
  theme?: Partial<SiteTheme>;
  sections?: Partial<SiteSections>;
  cta?: SiteCta | null;
  heroImageUrl?: string | null;
  tagline?: string | null;
  aboutOverride?: string | null;
  surfaceColor?: string | null;
  artworkFilters?: Partial<SiteArtworkFilters>;
};

export type UpsertSiteResult =
  | { success: true; handle: string }
  | { success: false; error: string };

/**
 * Verify caller can manage the given user_profiles row.
 * Owner OR gallery team admin/owner is OK.
 */
async function userCanManageProfile(
  userId: string,
  profileId: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const client = getSupabaseServerClient();
  const { data: profile } = await (client as any)
    .from('user_profiles')
    .select('id, user_id, role')
    .eq('id', profileId)
    .eq('is_active', true)
    .maybeSingle();

  if (!profile) {
    return { ok: false, reason: 'Profile not found' };
  }

  if (profile.user_id === userId) {
    return { ok: true };
  }

  // Team-member access for gallery profiles only
  if (profile.role === 'gallery') {
    const canManage = await canManageGallery(userId, profileId);
    if (canManage) return { ok: true };
  }

  return { ok: false, reason: 'You do not have permission to manage this profile' };
}

/**
 * Upsert (create or update) a profile site config. Does not publish.
 * Validates handle uniqueness excluding the current profile.
 */
export async function upsertSiteAction(input: UpsertSiteInput): Promise<UpsertSiteResult> {
  console.log('[Sites] upsertSiteAction', { profileId: input.profileId, handle: input.handle });

  const client = getSupabaseServerClient();

  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const access = await userCanManageProfile(user.id, input.profileId);
  if (!access.ok) {
    console.error('[Sites] upsertSiteAction access denied', { profileId: input.profileId, reason: access.reason });
    return { success: false, error: access.reason };
  }

  const handleResult = await validateHandleAction(input.handle, input.profileId);
  if (!handleResult.ok) {
    return { success: false, error: handleResult.error };
  }

  const theme: SiteTheme = { ...DEFAULT_THEME, ...(input.theme ?? {}) };
  const sections: SiteSections = { ...DEFAULT_SECTIONS, ...(input.sections ?? {}) };
  const artworkFilters: SiteArtworkFilters = {
    ...DEFAULT_ARTWORK_FILTERS,
    ...(input.artworkFilters ?? {}),
  };

  // Always keep at least one certificate type so the artworks section never goes empty by accident
  if (!artworkFilters.certificate_types || artworkFilters.certificate_types.length === 0) {
    artworkFilters.certificate_types = DEFAULT_ARTWORK_FILTERS.certificate_types;
  }

  const payload = {
    profile_id: input.profileId,
    handle: handleResult.normalized,
    template_id: input.templateId,
    theme,
    sections,
    cta: input.cta ?? null,
    hero_image_url: input.heroImageUrl ?? null,
    tagline: input.tagline?.trim() || null,
    about_override: input.aboutOverride?.trim() || null,
    surface_color: input.surfaceColor ?? null,
    artwork_filters: artworkFilters,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertErr } = await (client as any)
    .from('profile_sites')
    .upsert(payload, { onConflict: 'profile_id' });

  if (upsertErr) {
    console.error('[Sites] upsertSiteAction upsert failed', upsertErr);
    return { success: false, error: upsertErr.message };
  }

  console.log('[Sites] upsertSiteAction succeeded', { handle: handleResult.normalized });
  return { success: true, handle: handleResult.normalized };
}

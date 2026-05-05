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
  /** Optional display name override shown in the site header/logo */
  displayName?: string | null;
  surfaceColor?: string | null;
  artworkFilters?: Partial<SiteArtworkFilters>;
};

export type UpsertSiteResult =
  | { success: true; handle: string }
  | {
      success: false;
      error: string;
      /** Present when the handle is taken by another profile the caller manages.
       *  Forwarded verbatim from validateHandleAction so the editor can render
       *  the Transfer / Remove conflict banner on a Save click. */
      takenByOwnProfile?: { profileId: string; profileName: string };
    };

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
    // Forward takenByOwnProfile so the editor can show Transfer/Remove buttons
    // rather than a dead-end error strip.
    return {
      success: false,
      error: handleResult.error,
      takenByOwnProfile: handleResult.takenByOwnProfile,
    };
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

  // Full payload — requires migration 20260514 (extra columns)
  const fullPayload = {
    profile_id: input.profileId,
    handle: handleResult.normalized,
    template_id: input.templateId,
    theme,
    sections,
    cta: input.cta ?? null,
    hero_image_url: input.heroImageUrl ?? null,
    tagline: input.tagline?.trim() || null,
    about_override: input.aboutOverride?.trim() || null,
    display_name: input.displayName?.trim() || null,
    surface_color: input.surfaceColor ?? null,
    artwork_filters: artworkFilters,
    updated_at: new Date().toISOString(),
  };

  // Mid payload — columns from migration 20260514 (extra cols) but not 20260531 (display_name).
  // Used as a fallback when only display_name is missing.
  const midPayload = {
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

  // Base payload — only columns from the original migration 20260513.
  // Used as a last-resort fallback if the extra-columns migrations haven't been applied yet.
  const basePayload = {
    profile_id: input.profileId,
    handle: handleResult.normalized,
    template_id: input.templateId,
    theme,
    sections,
    cta: input.cta ?? null,
    updated_at: new Date().toISOString(),
  };

  console.log('[Sites] upsertSiteAction attempting full payload', { handle: handleResult.normalized });

  let { error: upsertErr } = await (client as any)
    .from('profile_sites')
    .upsert(fullPayload, { onConflict: 'profile_id' });

  // If a column is missing (migration not yet applied), step down through progressively
  // narrower payloads so saves degrade gracefully rather than silently dropping fields.
  if (upsertErr) {
    const isColumnMissing = (err: { message?: string; code?: string }) =>
      err.message?.includes('column') ||
      err.code === '42703' || // undefined_column
      err.code === 'PGRST204'; // schema cache mismatch

    if (isColumnMissing(upsertErr)) {
      // display_name column may not exist yet (migration 20260531) — try mid payload
      console.warn('[Sites] upsertSiteAction full payload failed — trying mid payload', upsertErr.message);
      const mid = await (client as any)
        .from('profile_sites')
        .upsert(midPayload, { onConflict: 'profile_id' });
      upsertErr = mid.error ?? null;
    }

    if (upsertErr && isColumnMissing(upsertErr)) {
      // Extra columns (migration 20260514) also missing — fall back to base payload
      console.warn('[Sites] upsertSiteAction mid payload failed — falling back to base payload', upsertErr.message);
      const fallback = await (client as any)
        .from('profile_sites')
        .upsert(basePayload, { onConflict: 'profile_id' });
      upsertErr = fallback.error ?? null;
    }

    if (upsertErr) {
      console.error('[Sites] upsertSiteAction upsert failed', {
        code: upsertErr.code,
        message: upsertErr.message,
        details: upsertErr.details,
        hint: upsertErr.hint,
      });
      return { success: false, error: upsertErr.message };
    }
  }

  console.log('[Sites] upsertSiteAction succeeded', { handle: handleResult.normalized });
  return { success: true, handle: handleResult.normalized };
}

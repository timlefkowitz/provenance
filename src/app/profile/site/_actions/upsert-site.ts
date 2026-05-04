'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import type { TemplateId, SiteTheme, SiteSections, SiteCta } from '~/app/_sites/types';
import { DEFAULT_SECTIONS, DEFAULT_THEME } from '~/app/_sites/types';
import { validateHandleAction } from './validate-handle';

export type UpsertSiteInput = {
  profileId: string;
  handle: string;
  templateId: TemplateId;
  theme?: Partial<SiteTheme>;
  sections?: Partial<SiteSections>;
  cta?: SiteCta | null;
};

export type UpsertSiteResult =
  | { success: true; handle: string }
  | { success: false; error: string };

/**
 * Upsert (create or update) a profile site config. Does not publish.
 * Validates handle uniqueness excluding the current profile.
 */
export async function upsertSiteAction(input: UpsertSiteInput): Promise<UpsertSiteResult> {
  console.log('[Sites] upsertSiteAction', { profileId: input.profileId, handle: input.handle });

  const client = getSupabaseServerClient();

  // Verify caller owns this profile
  const { data: { user }, error: authErr } = await client.auth.getUser();
  if (authErr || !user) {
    return { success: false, error: 'Not authenticated' };
  }

  const { data: profile, error: profileErr } = await (client as any)
    .from('user_profiles')
    .select('id, user_id')
    .eq('id', input.profileId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (profileErr || !profile) {
    console.error('[Sites] upsertSiteAction profile ownership check failed', profileErr);
    return { success: false, error: 'Profile not found or not owned by you' };
  }

  // Validate handle
  const handleResult = await validateHandleAction(input.handle, input.profileId);
  if (!handleResult.ok) {
    return { success: false, error: handleResult.error };
  }

  const theme: SiteTheme = { ...DEFAULT_THEME, ...(input.theme ?? {}) };
  const sections: SiteSections = { ...DEFAULT_SECTIONS, ...(input.sections ?? {}) };

  const payload = {
    profile_id: input.profileId,
    handle: handleResult.normalized,
    template_id: input.templateId,
    theme,
    sections,
    cta: input.cta ?? null,
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

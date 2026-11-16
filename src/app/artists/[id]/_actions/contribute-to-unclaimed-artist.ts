'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { logger } from '~/lib/logger';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';
import { appendCvEntriesToCvJson, normalizeScalar, sanitizeCvEntries } from '~/lib/artist-details/fields';
import type { ArtistCvJson } from '~/lib/grants';
import { isUnclaimedArtistProfile, type ContributionField } from '~/lib/artist-profile-content/fields';
import { uploadProfilePicture } from '~/app/profiles/_actions/upload-profile-picture';

type Result = { success: true } | { success: false; error: string };

/** Edits one person may make to unclaimed profiles per hour. */
const MAX_CONTRIBUTIONS_PER_HOUR = 40;

const PROFILE_COLUMNS = 'id, user_id, role, is_active, is_claimed, name, bio, artist_statement, header_image_url, artist_cv_json';

type ContributableProfile = {
  id: string;
  user_id: string | null;
  role: string;
  is_active: boolean | null;
  is_claimed: boolean | null;
  name: string | null;
  bio: string | null;
  artist_statement: string | null;
  header_image_url: string | null;
  artist_cv_json: ArtistCvJson | null;
};

type Ctx = { userId: string; admin: UntypedSupabaseClient; profile: ContributableProfile };

/**
 * Signed in, the profile is an unclaimed artist, and the person is under the
 * hourly edit limit. Writes then go through the service role.
 */
async function requireContributor(profileId: string): Promise<{ ok: true; ctx: Ctx } | { ok: false; error: string }> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) return { ok: false, error: 'Sign in to add information about this artist.' };

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: profile } = await admin
    .from('user_profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', profileId)
    .maybeSingle<ContributableProfile>();
  if (!profile || !isUnclaimedArtistProfile(profile)) {
    return { ok: false, error: 'Only artists who are not on Provenance yet can be edited by others.' };
  }

  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await admin
    .from('artist_profile_contributions')
    .select('id', { count: 'exact', head: true })
    .eq('contributed_by', user.id)
    .gte('created_at', since);
  if ((count ?? 0) >= MAX_CONTRIBUTIONS_PER_HOUR) {
    return { ok: false, error: 'You have made a lot of edits in the last hour. Please try again later.' };
  }

  return { ok: true, ctx: { userId: user.id, admin, profile } };
}

async function saveContribution(
  ctx: Ctx,
  field: ContributionField,
  update: Record<string, unknown>,
  previousValue: unknown,
  newValue: unknown,
): Promise<Result> {
  // is('user_id', null) keeps a claim that lands mid-edit from being overwritten.
  const { data: changed, error } = await ctx.admin
    .from('user_profiles')
    .update({ ...update, updated_at: new Date().toISOString() })
    .eq('id', ctx.profile.id)
    .is('user_id', null)
    .select('id');
  if (error) {
    logger.error('artist_contribution_update_failed', { profileId: ctx.profile.id, field, error });
    return { success: false, error: 'Could not save your changes.' };
  }
  if (!changed || changed.length === 0) {
    return { success: false, error: 'This artist has just claimed their profile, so only they can edit it now.' };
  }

  const { error: logError } = await ctx.admin.from('artist_profile_contributions').insert({
    profile_id: ctx.profile.id,
    contributed_by: ctx.userId,
    field,
    previous_value: previousValue ?? null,
    new_value: newValue ?? null,
  });
  if (logError) logger.error('artist_contribution_log_failed', { profileId: ctx.profile.id, field, error: logError });

  console.log('[ArtistContributions] saved', { profileId: ctx.profile.id, field, by: ctx.userId });
  revalidatePath(`/artists/${ctx.profile.id}`);
  revalidatePath(`/artists/${ctx.profile.id}/cv`);
  return { success: true };
}

/** Write or replace the bio or artist statement of an unclaimed artist. Empty clears it. */
export async function updateUnclaimedArtistText(input: {
  profileId: string;
  field: 'bio' | 'artist_statement';
  value: string;
}): Promise<Result> {
  if (input.field !== 'bio' && input.field !== 'artist_statement') {
    return { success: false, error: 'That field cannot be edited here.' };
  }
  const auth = await requireContributor(input.profileId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { ctx } = auth;

  const next = normalizeScalar(input.field, input.value) as string | null;
  if (containsObjectionableText(next)) return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  const previous = ctx.profile[input.field];
  if ((previous ?? null) === next) return { success: true };

  return saveContribution(ctx, input.field, { [input.field]: next }, previous, next);
}

/** Upload a header image for an unclaimed artist (same checks as profile pictures). */
export async function uploadUnclaimedArtistHeaderImage(formData: FormData): Promise<Result & { url?: string }> {
  const profileId = String(formData.get('profileId') ?? '');
  const auth = await requireContributor(profileId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { ctx } = auth;

  const file = new FormData();
  const raw = formData.get('file');
  if (!(raw instanceof File)) return { success: false, error: 'Choose an image first.' };
  file.append('file', raw);
  const uploaded = await uploadProfilePicture(file);
  if (!uploaded.url) return { success: false, error: uploaded.error || 'Could not upload the image.' };

  const result = await saveContribution(
    ctx,
    'header_image_url',
    { header_image_url: uploaded.url },
    ctx.profile.header_image_url,
    uploaded.url,
  );
  return result.success ? { success: true, url: uploaded.url } : result;
}

export async function removeUnclaimedArtistHeaderImage(profileId: string): Promise<Result> {
  const auth = await requireContributor(profileId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { ctx } = auth;
  if (!ctx.profile.header_image_url) return { success: true };
  return saveContribution(ctx, 'header_image_url', { header_image_url: null }, ctx.profile.header_image_url, null);
}

/** Add exhibitions to an unclaimed artist's CV (skips ones already listed). */
export async function addUnclaimedArtistExhibitions(input: {
  profileId: string;
  exhibitions: { title: string; venue?: string; city?: string; year?: string; url?: string }[];
}): Promise<Result & { added?: number }> {
  const auth = await requireContributor(input.profileId);
  if (!auth.ok) return { success: false, error: auth.error };
  const { ctx } = auth;

  const entries = sanitizeCvEntries((input.exhibitions ?? []).map((e) => ({ ...e, type: 'exhibition' }))).slice(0, 50);
  if (entries.length === 0) return { success: false, error: 'Add a show title.' };
  if (containsObjectionableText(...entries.flatMap((e) => [e.title, e.venue, e.city]))) {
    return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
  }

  const before = ctx.profile.artist_cv_json;
  const next = appendCvEntriesToCvJson(before, entries);
  const added = (next.exhibitions?.length ?? 0) - (before?.exhibitions?.length ?? 0);
  if (added === 0) return { success: false, error: 'Those exhibitions are already listed.' };

  const result = await saveContribution(ctx, 'exhibitions', { artist_cv_json: next }, before?.exhibitions ?? null, entries);
  return result.success ? { success: true, added } : result;
}

export type ProfileContributor = { userId: string; name: string; lastContributedAt: string };

/** People who added to this profile, most recent first, for the "Contributed by" credit. */
export async function getArtistProfileContributors(profileId: string): Promise<ProfileContributor[]> {
  const db = asUntyped(getSupabaseServerClient());
  const { data, error } = await db
    .from('artist_profile_contributions')
    .select('contributed_by, created_at')
    .eq('profile_id', profileId)
    .not('contributed_by', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) {
    // Table may not exist yet where the migration hasn't run; the page still renders.
    console.warn('[ArtistContributions] contributors load failed', error.message);
    return [];
  }
  const latest = new Map<string, string>();
  for (const row of (data ?? []) as { contributed_by: string; created_at: string }[]) {
    if (!latest.has(row.contributed_by)) latest.set(row.contributed_by, row.created_at);
  }
  if (latest.size === 0) return [];
  const { data: accounts } = await asUntyped(getSupabaseServerAdminClient())
    .from('accounts')
    .select('id, name')
    .in('id', [...latest.keys()]);
  const names = new Map<string, string>();
  for (const a of (accounts ?? []) as { id: string; name: string | null }[]) if (a.name) names.set(a.id, a.name);
  return [...latest.entries()]
    .filter(([id]) => names.has(id))
    .map(([userId, at]) => ({ userId, name: names.get(userId)!, lastContributedAt: at }));
}

'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import {
  SCALAR_FIELDS,
  buildProfileUpdateFromSuggestion,
  normalizeScalar,
  sanitizePress,
  suggestionFieldKeys,
  type ArtistDetailScalars,
  type ProfileSuggestionFields,
  type ScalarField,
} from '~/lib/artist-details/fields';
import type { ArtistCvJson } from '~/lib/grants';
import { createNotification } from '~/lib/notifications';
import { containsObjectionableText, OBJECTIONABLE_TEXT_MESSAGE } from '~/lib/moderation/text-filter';

export type PendingProfileSuggestion = {
  id: string;
  profileId: string;
  profileName: string;
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  requestedByName: string | null;
  message: string | null;
  createdAt: string;
  fields: ProfileSuggestionFields;
  current: ArtistDetailScalars;
  sources: { id: string; kind: string; url: string; title: string | null }[];
};

/** Open suggestions for every profile the signed-in user owns. */
export async function getMyProfileSuggestions(): Promise<PendingProfileSuggestion[]> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) return [];
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: profiles } = await admin.from('user_profiles').select('*').eq('user_id', user.id);
  const byId = new Map<string, Record<string, unknown>>();
  for (const p of (profiles || []) as Record<string, unknown>[]) byId.set(p.id as string, p);
  if (byId.size === 0) return [];

  const { data: rows, error } = await admin
    .from('artist_profile_suggestions')
    .select('id, profile_id, exhibition_id, requested_by, update_fields, source_finding_ids, message, created_at')
    .in('profile_id', [...byId.keys()])
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[ProfileSuggestions] load failed', error);
    return [];
  }
  const list = (rows || []) as {
    id: string;
    profile_id: string;
    exhibition_id: string | null;
    requested_by: string;
    update_fields: ProfileSuggestionFields;
    source_finding_ids: string[] | null;
    message: string | null;
    created_at: string;
  }[];
  if (list.length === 0) return [];

  const exIds = [...new Set(list.map((r) => r.exhibition_id).filter(Boolean))] as string[];
  const titles = new Map<string, string>();
  if (exIds.length) {
    const { data } = await admin.from('exhibitions').select('id, title').in('id', exIds);
    for (const e of (data || []) as { id: string; title: string }[]) titles.set(e.id, e.title);
  }
  const requesterIds = [...new Set(list.map((r) => r.requested_by))];
  const names = new Map<string, string>();
  const { data: accounts } = await admin.from('accounts').select('id, name').in('id', requesterIds);
  for (const a of (accounts || []) as { id: string; name: string }[]) names.set(a.id, a.name);

  const findingIds = [...new Set(list.flatMap((r) => r.source_finding_ids ?? []))];
  const findings = new Map<string, { id: string; kind: string; url: string; title: string | null }>();
  if (findingIds.length) {
    const { data } = await admin
      .from('artist_research_findings')
      .select('id, kind, source_url, source_title')
      .in('id', findingIds);
    for (const f of (data || []) as { id: string; kind: string; source_url: string; source_title: string | null }[]) {
      findings.set(f.id, { id: f.id, kind: f.kind, url: f.source_url, title: f.source_title });
    }
  }

  return list.map((r) => {
    const p = byId.get(r.profile_id) ?? {};
    const current = {} as Record<ScalarField, unknown>;
    for (const f of SCALAR_FIELDS) current[f] = normalizeScalar(f, p[f]);
    return {
      id: r.id,
      profileId: r.profile_id,
      profileName: (p.name as string) || 'Your profile',
      exhibitionId: r.exhibition_id,
      exhibitionTitle: r.exhibition_id ? titles.get(r.exhibition_id) ?? null : null,
      requestedByName: names.get(r.requested_by) ?? null,
      message: r.message,
      createdAt: r.created_at,
      fields: r.update_fields || {},
      current: current as ArtistDetailScalars,
      sources: (r.source_finding_ids ?? []).map((id) => findings.get(id)).filter(Boolean) as PendingProfileSuggestion['sources'],
    };
  });
}

export async function countMyPendingProfileSuggestions(): Promise<number> {
  const list = await getMyProfileSuggestions();
  return list.length;
}

/**
 * The artist accepts some or all suggested changes (optionally editing text
 * first) or declines. Accepted fields are written to their profile.
 */
export async function respondToProfileSuggestion(input: {
  suggestionId: string;
  decision: 'accept' | 'decline';
  /** Keys of the suggestion to accept (scalar fields, 'cv_entries_add', 'press_add'). */
  accepted?: string[];
  /** Artist's own edits to scalar fields before accepting. */
  overrides?: Partial<Record<ScalarField, unknown>>;
  reviewMessage?: string;
}): Promise<{ success: true } | { success: false; error: string }> {
  const {
    data: { user },
  } = await getSupabaseServerClient().auth.getUser();
  if (!user) return { success: false, error: 'Sign in to review these changes.' };
  const admin = asUntyped(getSupabaseServerAdminClient());

  const { data: suggestion } = await admin
    .from('artist_profile_suggestions')
    .select('id, profile_id, exhibition_id, requested_by, update_fields, status')
    .eq('id', input.suggestionId)
    .maybeSingle();
  if (!suggestion) return { success: false, error: 'Suggestion not found.' };
  if (suggestion.status !== 'pending') return { success: false, error: 'This suggestion was already answered.' };

  const { data: profile } = await admin
    .from('user_profiles')
    .select('id, user_id, name, artist_cv_json, news_publications')
    .eq('id', suggestion.profile_id)
    .maybeSingle();
  if (!profile || profile.user_id !== user.id) {
    return { success: false, error: 'Only the artist can review these changes.' };
  }

  const fields = (suggestion.update_fields || {}) as ProfileSuggestionFields;
  const available = new Set<string>(suggestionFieldKeys(fields));
  const accepted = input.decision === 'accept' ? (input.accepted ?? [...available]).filter((k) => available.has(k)) : [];

  if (input.decision === 'accept' && accepted.length === 0) {
    return { success: false, error: 'Choose at least one change to accept, or decline.' };
  }

  if (accepted.length > 0) {
    const overrides = input.overrides ?? {};
    if (
      containsObjectionableText(
        ...(['bio', 'artist_statement', 'birth_place', 'nationality'] as ScalarField[]).map((f) =>
          typeof overrides[f] === 'string' ? (overrides[f] as string) : null,
        ),
      )
    ) {
      return { success: false, error: OBJECTIONABLE_TEXT_MESSAGE };
    }
    const update = buildProfileUpdateFromSuggestion(
      fields,
      {
        artist_cv_json: (profile.artist_cv_json as ArtistCvJson | null) ?? null,
        news_publications: sanitizePress(profile.news_publications),
      },
      accepted,
      overrides,
    );
    const { error } = await admin.from('user_profiles').update(update).eq('id', profile.id);
    if (error) {
      console.error('[ProfileSuggestions] profile update failed', error);
      return { success: false, error: 'Could not update your profile.' };
    }
  }

  const status =
    accepted.length === 0 ? 'denied' : accepted.length === available.size ? 'approved' : 'partially_approved';
  const { error: statusError } = await admin
    .from('artist_profile_suggestions')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      review_message: input.reviewMessage?.trim().slice(0, 2000) || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', suggestion.id);
  if (statusError) console.error('[ProfileSuggestions] status update failed', statusError);

  try {
    await createNotification({
      userId: suggestion.requested_by,
      type: status === 'denied' ? 'artist_profile_suggestion_denied' : 'artist_profile_suggestion_approved',
      title:
        status === 'denied'
          ? `${profile.name || 'The artist'} declined your profile suggestions`
          : `${profile.name || 'The artist'} added your suggestions to their profile`,
      message:
        status === 'partially_approved'
          ? `They accepted ${accepted.length} of ${available.size} changes.`
          : input.reviewMessage?.trim() || undefined,
      relatedUserId: user.id,
      metadata: { suggestion_id: suggestion.id, exhibition_id: suggestion.exhibition_id, profile_id: profile.id },
    });
  } catch (e) {
    console.error('[ProfileSuggestions] notify curator failed', e);
  }

  console.log('[ProfileSuggestions] responded', { suggestionId: suggestion.id, status, accepted });
  revalidatePath('/profiles/suggestions');
  revalidatePath(`/artists/${user.id}`);
  if (suggestion.exhibition_id) revalidatePath(`/exhibitions/${suggestion.exhibition_id}/curate`);
  return { success: true };
}

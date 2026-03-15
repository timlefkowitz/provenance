'use server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '~/lib/admin';
import { slugify } from '~/lib/slug';
import { TEXAS_OPEN_CALLS_SEED } from '../_data/texas-open-calls-seed';

/**
 * Seed 20 Texas open calls into the database.
 * Admin only. Uses the first gallery profile in the DB as the "owner" of these open calls.
 */
export async function seedTexasOpenCalls(): Promise<
  { success: true; count: number } | { success: false; error: string }
> {
  const client = getSupabaseServerClient();
  const admin = getSupabaseServerAdminClient();

  const { data: { user } } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be signed in.' };
  }

  const userIsAdmin = await isAdmin(user.id);
  if (!userIsAdmin) {
    return { success: false, error: 'Only admins can seed Texas open calls.' };
  }

  console.log('[OpenCalls] seedTexasOpenCalls started');

  const { data: profile } = await (admin as any)
    .from('user_profiles')
    .select('id, user_id')
    .eq('role', 'gallery')
    .limit(1)
    .single();

  if (!profile) {
    console.error('[OpenCalls] seedTexasOpenCalls: no gallery profile found');
    return {
      success: false,
      error: 'No gallery profile found. Create a gallery account and profile first, then run this again.',
    };
  }

  const galleryUserId = profile.user_id as string;
  const galleryProfileId = profile.id as string;
  let inserted = 0;

  for (let i = 0; i < TEXAS_OPEN_CALLS_SEED.length; i++) {
    const entry = TEXAS_OPEN_CALLS_SEED[i];
    const baseSlug = slugify(entry.title);
    const slug = baseSlug ? `${baseSlug}-${i + 1}` : `texas-open-call-${i + 1}`;

    const { data: existing } = await (admin as any)
      .from('open_calls')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      console.log('[OpenCalls] seedTexasOpenCalls: slug already exists', slug);
      continue;
    }

    const { data: exhibition, error: exhibitionError } = await (admin as any)
      .from('exhibitions')
      .insert({
        gallery_id: galleryUserId,
        title: entry.title,
        description: entry.description || null,
        start_date: entry.start_date,
        end_date: entry.end_date || null,
        location: entry.location || null,
        created_by: galleryUserId,
        updated_by: galleryUserId,
      })
      .select('id')
      .single();

    if (exhibitionError || !exhibition) {
      console.error('[OpenCalls] seedTexasOpenCalls: exhibition insert failed', exhibitionError);
      return {
        success: false,
        error: `Failed to create exhibition: ${exhibitionError?.message ?? 'Unknown error'}`,
      };
    }

    const { error: openCallError } = await (admin as any)
      .from('open_calls')
      .insert({
        exhibition_id: exhibition.id,
        gallery_profile_id: galleryProfileId,
        slug,
        submission_open_date: entry.submission_open_date,
        submission_closing_date: entry.submission_closing_date,
        call_type: entry.call_type,
        eligible_locations: entry.eligible_locations ?? [],
        external_url: entry.external_url || null,
        created_by: galleryUserId,
        updated_by: galleryUserId,
      });

    if (openCallError) {
      console.error('[OpenCalls] seedTexasOpenCalls: open_call insert failed', openCallError);
      return {
        success: false,
        error: `Failed to create open call: ${openCallError.message}`,
      };
    }

    inserted++;
  }

  console.log('[OpenCalls] seedTexasOpenCalls ok', { inserted });
  revalidatePath('/open-calls/browse');
  revalidatePath('/open-calls');

  return { success: true, count: inserted };
}

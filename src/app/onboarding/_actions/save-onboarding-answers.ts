'use server';

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type OnboardingAnswers = {
  has_cv: boolean;
  has_sold_work: 'never' | 'occasionally' | 'regularly' | 'gallery_represented';
  medium: string;
  goal: string;
};

export type SaveOnboardingAnswersResult =
  | { success: true; profileId: string }
  | { success: false; error: string };

/**
 * Ensures an artist user_profile row exists for the current user,
 * then saves the Taco onboarding answers to it.
 */
export async function saveOnboardingAnswers(
  answers: OnboardingAnswers,
): Promise<SaveOnboardingAnswersResult> {
  console.log('[Onboarding] saveOnboardingAnswers started', {
    has_cv: answers.has_cv,
    has_sold_work: answers.has_sold_work,
    medium: answers.medium,
    goal: answers.goal,
  });

  const client = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Onboarding] saveOnboardingAnswers auth failed', authError);
    return { success: false, error: 'Not authenticated' };
  }

  try {
    // Check for existing artist profile
    const { data: existing } = await asUntyped(client)
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'artist')
      .eq('is_active', true)
      .maybeSingle();

    const admin = getSupabaseServerAdminClient();
    let profileId: string;

    if (existing?.id) {
      profileId = existing.id as string;
      console.log('[Onboarding] existing artist profile found', profileId);

      // Update onboarding answers on existing profile
      const { error: updateErr } = await asUntyped(admin)
        .from('user_profiles')
        .update({
          medium: answers.medium || undefined,
          has_sold_work: answers.has_sold_work,
          onboarding_answers: answers,
          onboarding_completed_at: new Date().toISOString(),
        })
        .eq('id', profileId);

      if (updateErr) {
        console.error('[Onboarding] update profile failed', updateErr);
        return { success: false, error: updateErr.message };
      }
    } else {
      // Fetch the user's display name from accounts
      const { data: account } = await asUntyped(admin)
        .from('accounts')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      const displayName = (account?.name as string | null) ?? user.email?.split('@')[0] ?? 'Artist';

      console.log('[Onboarding] creating new artist profile for', user.id);

      const { data: inserted, error: insertErr } = await asUntyped(admin)
        .from('user_profiles')
        .insert({
          user_id: user.id,
          role: 'artist',
          name: displayName,
          medium: answers.medium || null,
          has_sold_work: answers.has_sold_work,
          onboarding_answers: answers,
          onboarding_completed_at: new Date().toISOString(),
          is_active: true,
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[Onboarding] insert profile failed', insertErr);
        return { success: false, error: insertErr.message };
      }

      profileId = inserted.id as string;
      console.log('[Onboarding] artist profile created', profileId);
    }

    console.log('[Onboarding] saveOnboardingAnswers completed successfully', profileId);
    return { success: true, profileId };
  } catch (err) {
    console.error('[Onboarding] saveOnboardingAnswers threw', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unexpected error',
    };
  }
}

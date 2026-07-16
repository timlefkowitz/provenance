import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { ArtPracticeSection } from '~/components/art-practice-section';
import { getMyGoals } from '~/app/profile/_actions/manage-goals';
import { getCommitHistory } from '~/app/profile/_actions/get-commit-history';
import { asUntyped } from '~/lib/supabase-untyped';

export const metadata = {
  title: 'Goals | Provenance',
};

export default async function GoalsPage() {
  console.log('[Goals] GoalsPage started');
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    redirect('/auth/sign-in');
  }

  const [goals, commits, foundingBadge] = await Promise.all([
    getMyGoals(),
    getCommitHistory(user.id),
    client
      .from('user_badges')
      .select('id')
      .eq('user_id', user.id)
      .eq('badge_type', 'founding_artist')
      .maybeSingle(),
  ]);

  const isFoundingArtist = !!foundingBadge.data;

  console.log('[Goals] GoalsPage loaded', {
    userId: user.id,
    goalCount: goals.length,
    commitCount: commits.length,
  });

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-4xl font-display font-bold text-wine mb-2">
          Goals
        </h1>
        <p className="text-ink/70 font-serif">
          Log your practice, build streaks, and track the goals that matter to your art career.
        </p>
      </div>

      <div className="flex w-full flex-1 flex-col space-y-4">
        <ArtPracticeSection initialGoals={goals} commits={commits} isFoundingArtist={isFoundingArtist} />
      </div>
    </div>
  );
}

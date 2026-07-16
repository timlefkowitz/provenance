import { redirect } from 'next/navigation';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@kit/ui/card';
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

        <Card className="border-wine/20 bg-parchment/60">
          <CardHeader>
            <CardTitle className="font-display text-wine">All goals</CardTitle>
            <CardDescription className="font-serif">
              Every goal you&apos;re currently tracking, including your default practice goal.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {goals.length === 0 ? (
              <p className="text-xs text-ink/55 font-serif">
                You don&apos;t have any goals yet. Add one above to start tracking a streak.
              </p>
            ) : (
              <ul className="space-y-2">
                {goals.map((goal) => (
                  <li
                    key={goal.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-wine/15 bg-parchment/40 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg" aria-hidden>
                        {goal.emoji}
                      </span>
                      <div className="min-w-0">
                        <p className="font-serif text-sm text-ink truncate">
                          {goal.title}
                          {goal.isDefault && (
                            <span className="ml-2 text-[10px] uppercase tracking-wide text-wine/60 font-sans">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-ink/55 font-serif">
                          {goal.currentStreakDays} day streak · best {goal.longestStreakDays}
                        </p>
                      </div>
                    </div>
                    <span
                      className={
                        goal.checkedInToday
                          ? 'shrink-0 text-xs font-serif text-wine'
                          : 'shrink-0 text-xs font-serif text-ink/40'
                      }
                    >
                      {goal.checkedInToday ? 'Logged today \u2713' : 'Not logged yet'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

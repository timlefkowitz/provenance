'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, X } from 'lucide-react';
import { Button } from '@kit/ui/button';
import { Input } from '@kit/ui/input';
import { toast } from '@kit/ui/sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@kit/ui/card';
import { ContributionGraph, type ContributionDay } from '~/components/contribution-graph';
import { StreakStar } from '~/components/streak-star';
import { checkInToday, checkInToGoal } from '~/app/profile/_actions/check-in';
import { archiveGoal, createGoal } from '~/app/profile/_actions/manage-goals';
import type { UserGoalView } from '~/app/profile/_actions/manage-goals';

const EMOJI_CHOICES = ['🎨', '🖌️', '📸', '🖼️', '✍️', '🧵', '🏺', '💰', '📬', '🎯'];

export function ArtPracticeSection({
  initialGoals,
  commits,
}: {
  initialGoals: UserGoalView[];
  commits: ContributionDay[];
}) {
  const router = useRouter();
  const [goals, setGoals] = useState(initialGoals);
  const [note, setNote] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [newGoalEmoji, setNewGoalEmoji] = useState(EMOJI_CHOICES[0]);
  const [pending, startTransition] = useTransition();

  const defaultGoal = useMemo(() => goals.find((g) => g.isDefault) ?? null, [goals]);
  const customGoals = useMemo(() => goals.filter((g) => !g.isDefault), [goals]);

  function handleCheckInToday() {
    startTransition(async () => {
      try {
        const result = await checkInToday(note || undefined);
        setGoals((prev) =>
          prev.map((g) =>
            g.isDefault
              ? {
                  ...g,
                  checkedInToday: true,
                  currentStreakDays: result.currentStreakDays,
                  longestStreakDays: result.longestStreakDays,
                  starTier: result.starTier,
                }
              : g,
          ),
        );
        setNote('');
        setShowNoteInput(false);
        toast.success(`Logged today's commit — ${result.currentStreakDays} day streak!`);
        router.refresh();
      } catch (error) {
        console.error('[ArtPracticeSection] check-in failed', error);
        toast.error('Could not log your check-in. Try again.');
      }
    });
  }

  function handleGoalCheckIn(goalId: string) {
    startTransition(async () => {
      try {
        const result = await checkInToGoal(goalId);
        setGoals((prev) =>
          prev.map((g) =>
            g.id === goalId
              ? {
                  ...g,
                  checkedInToday: true,
                  currentStreakDays: result.currentStreakDays,
                  longestStreakDays: result.longestStreakDays,
                  starTier: result.starTier,
                }
              : g,
          ),
        );
        toast.success(`Checked in — ${result.currentStreakDays} day streak!`);
        router.refresh();
      } catch (error) {
        console.error('[ArtPracticeSection] goal check-in failed', error);
        toast.error('Could not check in on that goal. Try again.');
      }
    });
  }

  function handleCreateGoal() {
    const title = newGoalTitle.trim();
    if (!title) {
      toast.error('Give your goal a name first');
      return;
    }

    startTransition(async () => {
      try {
        await createGoal({ title, emoji: newGoalEmoji });
        setNewGoalTitle('');
        setShowAddGoal(false);
        toast.success('Goal added');
        router.refresh();
      } catch (error) {
        console.error('[ArtPracticeSection] create goal failed', error);
        toast.error(error instanceof Error ? error.message : 'Could not create goal');
      }
    });
  }

  function handleArchiveGoal(goalId: string) {
    startTransition(async () => {
      try {
        await archiveGoal(goalId);
        setGoals((prev) => prev.filter((g) => g.id !== goalId));
        toast.success('Goal archived');
        router.refresh();
      } catch (error) {
        console.error('[ArtPracticeSection] archive goal failed', error);
        toast.error('Could not archive that goal');
      }
    });
  }

  return (
    <Card className="border-wine/20 bg-parchment/60">
      <CardHeader>
        <CardTitle className="font-display text-wine">Art practice</CardTitle>
        <CardDescription className="font-serif">
          Log a commit whenever you work on your art or career — like a GitHub contribution graph for your practice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <ContributionGraph commits={commits} />
        </div>

        <div className="space-y-2 rounded-md border border-wine/15 bg-parchment/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {defaultGoal ? (
                <div className="flex items-center gap-3">
                  <StreakStar tier={defaultGoal.starTier} streakDays={defaultGoal.currentStreakDays} />
                  <span className="text-xs text-ink/55 font-serif">
                    Longest streak: {defaultGoal.longestStreakDays} days
                  </span>
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              {showNoteInput && (
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="What did you work on? (optional)"
                  className="w-56 font-serif"
                  maxLength={280}
                />
              )}
              <Button
                size="sm"
                disabled={pending || defaultGoal?.checkedInToday}
                onClick={() => (showNoteInput ? handleCheckInToday() : setShowNoteInput(true))}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                {defaultGoal?.checkedInToday
                  ? "Logged today \u2713"
                  : showNoteInput
                    ? 'Save commit'
                    : 'Did you work on your art today?'}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-serif font-medium text-ink">Your goals</h3>
            <Button
              size="sm"
              variant="outline"
              className="font-serif border-wine/30"
              onClick={() => setShowAddGoal((v) => !v)}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add goal
            </Button>
          </div>

          {showAddGoal && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-wine/15 bg-parchment/40 p-3">
              <select
                value={newGoalEmoji}
                onChange={(e) => setNewGoalEmoji(e.target.value)}
                className="rounded-md border border-wine/20 bg-parchment px-2 py-1.5 text-sm font-serif"
              >
                {EMOJI_CHOICES.map((emoji) => (
                  <option key={emoji} value={emoji}>
                    {emoji}
                  </option>
                ))}
              </select>
              <Input
                value={newGoalTitle}
                onChange={(e) => setNewGoalTitle(e.target.value)}
                placeholder="e.g. Apply to a grant every week"
                className="flex-1 min-w-[200px] font-serif"
                maxLength={80}
              />
              <Button
                size="sm"
                disabled={pending}
                onClick={handleCreateGoal}
                className="bg-wine text-parchment hover:bg-wine/90 font-serif"
              >
                Save
              </Button>
            </div>
          )}

          {customGoals.length === 0 ? (
            <p className="text-xs text-ink/55 font-serif">
              Add a goal like &quot;Sketch daily&quot; or &quot;Reach out to a gallery weekly&quot; to track your own streak.
            </p>
          ) : (
            <ul className="space-y-2">
              {customGoals.map((goal) => (
                <li
                  key={goal.id}
                  className="flex items-center justify-between gap-3 rounded-md border border-wine/15 bg-parchment/40 px-3 py-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg" aria-hidden>
                      {goal.emoji}
                    </span>
                    <div className="min-w-0">
                      <p className="font-serif text-sm text-ink truncate">{goal.title}</p>
                      <p className="text-xs text-ink/55 font-serif">
                        {goal.currentStreakDays} day streak · best {goal.longestStreakDays}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant={goal.checkedInToday ? 'outline' : 'default'}
                      disabled={pending || goal.checkedInToday}
                      onClick={() => handleGoalCheckIn(goal.id)}
                      className={
                        goal.checkedInToday
                          ? 'font-serif border-wine/30'
                          : 'bg-wine text-parchment hover:bg-wine/90 font-serif'
                      }
                    >
                      {goal.checkedInToday ? 'Done \u2713' : 'Check in'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => handleArchiveGoal(goal.id)}
                      aria-label={`Archive ${goal.title}`}
                    >
                      <X className="h-4 w-4 text-ink/40" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { Star } from 'lucide-react';
import type { StarTier } from '~/lib/streak-service';

export function starTierToColorClass(starTier: StarTier): string {
  switch (starTier) {
    case 'gold':
      return 'text-yellow-500';
    case 'silver':
      return 'text-slate-400';
    default:
      return 'text-amber-700';
  }
}

export function StreakStar({
  tier,
  streakDays,
}: {
  tier: StarTier;
  streakDays: number;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-wine/20 bg-parchment px-3 py-1">
      <Star className={`h-4 w-4 fill-current ${starTierToColorClass(tier)}`} />
      <span className="text-sm font-serif text-ink">
        {tier} star - {streakDays} day streak
      </span>
    </div>
  );
}

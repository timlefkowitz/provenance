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
  isFoundingArtist = false,
}: {
  tier: StarTier;
  streakDays: number;
  isFoundingArtist?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex items-center gap-2 rounded-full border border-wine/20 bg-parchment px-3 py-1">
        <Star className={`h-4 w-4 fill-current ${starTierToColorClass(tier)}`} />
        <span className="text-sm font-serif text-ink">
          {tier} star · {streakDays} day streak
        </span>
      </div>

      {isFoundingArtist && (
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/40 bg-yellow-50 px-3 py-1"
          title="One of the first 30 artists to join Provenance"
        >
          <span className="text-sm leading-none" aria-hidden>👑</span>
          <span className="text-sm font-serif font-medium text-yellow-800 leading-none">
            Founding Artist
          </span>
        </div>
      )}
    </div>
  );
}

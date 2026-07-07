export type ContributionDay = {
  date: string;
  count: number;
  breakdown?: Record<string, number>;
  note?: string | null;
};

const WEEKS_TO_SHOW = 26;
const DAY_MS = 24 * 60 * 60 * 1000;

const SOURCE_LABELS: Record<string, string> = {
  manual_checkin: 'check-in',
  goal_checkin: 'goal check-in',
  daily_activity: 'site visit',
  artwork_uploaded: 'COA/artwork upload',
  artwork_favorited: 'favorite',
};

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function levelForCount(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
}

const LEVEL_CLASSES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-wine/10',
  1: 'bg-wine/35',
  2: 'bg-wine/55',
  3: 'bg-wine/75',
  4: 'bg-wine',
};

function describeDay(dateKey: string, day: ContributionDay | undefined): string {
  const label = new Date(`${dateKey}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

  if (!day || day.count === 0) {
    return `No art activity on ${label}`;
  }

  const parts = Object.entries(day.breakdown ?? {}).map(([source, count]) => {
    const label = SOURCE_LABELS[source] ?? source;
    return `${count} ${label}${count === 1 ? '' : 's'}`;
  });

  const detail = parts.length > 0 ? ` (${parts.join(', ')})` : '';
  const noteSuffix = day.note ? ` — "${day.note}"` : '';
  return `${day.count} commit${day.count === 1 ? '' : 's'} on ${label}${detail}${noteSuffix}`;
}

/**
 * GitHub-style contribution graph. Renders the last `weeks` weeks of
 * activity as a grid of squares, one per day, shaded by commit count.
 */
export function ContributionGraph({
  commits,
  weeks = WEEKS_TO_SHOW,
}: {
  commits: ContributionDay[];
  weeks?: number;
}) {
  const byDate = new Map(commits.map((c) => [c.date, c]));

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  // Align the grid end to the upcoming Saturday so full weeks render.
  const daysUntilSaturday = 6 - today.getUTCDay();
  const gridEnd = new Date(today.getTime() + daysUntilSaturday * DAY_MS);
  const totalDays = weeks * 7;
  const gridStart = new Date(gridEnd.getTime() - (totalDays - 1) * DAY_MS);

  const columns: { dateKey: string; date: Date }[][] = [];
  for (let w = 0; w < weeks; w++) {
    const column: { dateKey: string; date: Date }[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(gridStart.getTime() + (w * 7 + d) * DAY_MS);
      column.push({ dateKey: toDateKey(date), date });
    }
    columns.push(column);
  }

  const totalCommits = commits.reduce((sum, c) => sum + c.count, 0);
  const activeDays = commits.filter((c) => c.count > 0).length;

  let lastMonth = -1;
  const monthLabels = columns.map((column) => {
    const month = column[0].date.getUTCMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      return column[0].date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    }
    return '';
  });

  return (
    <div className="inline-block">
      <div className="flex gap-[3px] pl-0 mb-1">
        {monthLabels.map((label, idx) => (
          <div key={idx} className="w-[11px] text-[10px] font-serif text-ink/50 leading-none">
            {label}
          </div>
        ))}
      </div>
      <div className="flex gap-[3px]">
        {columns.map((column, colIdx) => (
          <div key={colIdx} className="flex flex-col gap-[3px]">
            {column.map(({ dateKey, date }) => {
              const day = byDate.get(dateKey);
              const level = levelForCount(day?.count ?? 0);
              const isFuture = date.getTime() > today.getTime();

              return (
                <div
                  key={dateKey}
                  title={isFuture ? undefined : describeDay(dateKey, day)}
                  className={`h-[11px] w-[11px] rounded-[2px] ${
                    isFuture ? 'bg-transparent' : LEVEL_CLASSES[level]
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] font-serif text-ink/50">
        <span>
          {totalCommits} commit{totalCommits === 1 ? '' : 's'} in the last {weeks} weeks
          {activeDays > 0 ? ` · ${activeDays} active days` : ''}
        </span>
        <div className="flex items-center gap-1">
          <span>Less</span>
          {([0, 1, 2, 3, 4] as const).map((level) => (
            <span key={level} className={`h-[10px] w-[10px] rounded-[2px] ${LEVEL_CLASSES[level]}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

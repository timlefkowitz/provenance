import type { BreakdownRow } from '~/lib/portal-graphs/load-breakdown-rows';
import type { ValueSource } from '~/lib/portal-graphs/value-waterfall';

const SOURCE_LABELS: Record<ValueSource, string> = {
  formal_valuation: 'Formal valuation',
  sale_price: 'Sale price',
  declared_value: 'Declared value',
  unknown: 'No value',
};

const SOURCE_STYLES: Record<ValueSource, { bg: string; text: string; dot: string }> = {
  formal_valuation: { bg: 'bg-emerald-50', text: 'text-emerald-800', dot: 'bg-emerald-500' },
  sale_price: { bg: 'bg-blue-50', text: 'text-blue-800', dot: 'bg-blue-500' },
  declared_value: { bg: 'bg-amber-50', text: 'text-amber-800', dot: 'bg-amber-500' },
  unknown: { bg: 'bg-ink/5', text: 'text-ink/60', dot: 'bg-ink/25' },
};

interface SourceSummaryProps {
  rows: BreakdownRow[];
}

export function SourceSummary({ rows }: SourceSummaryProps) {
  const counts: Record<ValueSource, number> = {
    formal_valuation: 0,
    sale_price: 0,
    declared_value: 0,
    unknown: 0,
  };

  for (const row of rows) {
    counts[row.current_value.source]++;
  }

  const entries = (Object.entries(counts) as [ValueSource, number][]).filter(([, n]) => n > 0);

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map(([source, count]) => {
        const styles = SOURCE_STYLES[source];
        return (
          <div
            key={source}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-serif ${styles.bg} ${styles.text}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${styles.dot}`} />
            {count} {count === 1 ? 'work' : 'works'} &middot; {SOURCE_LABELS[source]}
          </div>
        );
      })}
    </div>
  );
}

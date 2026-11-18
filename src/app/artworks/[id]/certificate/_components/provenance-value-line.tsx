import {
  formatProvenanceAmount,
  type ProvenanceValue,
} from '~/lib/valuation/provenance-value';

/**
 * The artist's price plus premiums for a documented history (exhibited,
 * published). Shown under the artist's own Value, never replacing it.
 */
export function ProvenanceValueLine({
  value,
  isPrivate,
  variant = 'field',
}: {
  value: ProvenanceValue;
  isPrivate: boolean;
  variant?: 'field' | 'section';
}) {
  const breakdown = [
    `Artist price ${formatProvenanceAmount(value.base, value.currency)}`,
    ...value.premiums.map((p) => `${p.label} +${Math.round(p.rate * 100)}%`),
  ].join(' · ');

  return (
    <div className={variant === 'field' ? 'border-t border-ink/10 pt-3' : 'mb-5'}>
      <p
        className={'text-[11px] font-medium uppercase tracking-[0.12em] text-ink/50 font-serif mb-1.5'}
      >
        Provenance Value
        {isPrivate && <span className="ml-2 normal-case tracking-normal text-ink/40 italic font-normal">(Private)</span>}
      </p>
      <p className="text-sm sm:text-base font-serif text-wine break-words">
        {formatProvenanceAmount(value.total, value.currency)}
      </p>
      <p className="text-xs text-ink/50 font-serif mt-0.5">{breakdown}</p>
    </div>
  );
}

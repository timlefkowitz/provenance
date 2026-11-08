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
    <div className={variant === 'field' ? 'border-b border-wine/20 pb-2' : 'mb-3 sm:mb-4'}>
      <p
        className={`text-xs sm:text-sm text-ink/60 font-serif mb-1${variant === 'section' ? ' font-semibold' : ''}`}
      >
        Provenance Value
        {isPrivate && <span className="ml-2 text-xs text-ink/40 italic font-normal">(Private)</span>}
      </p>
      <p className="text-sm sm:text-base font-serif text-wine break-words">
        {formatProvenanceAmount(value.total, value.currency)}
      </p>
      <p className="text-xs text-ink/50 font-serif mt-0.5">{breakdown}</p>
    </div>
  );
}

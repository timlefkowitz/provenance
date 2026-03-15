/**
 * Medium options for open calls (filter + display).
 */
export const OPEN_CALL_MEDIUMS = [
  { value: 'painting', label: 'Painting' },
  { value: 'sculpture', label: 'Sculpture' },
  { value: 'photography', label: 'Photography' },
  { value: 'printmaking', label: 'Printmaking' },
  { value: 'mixed-media', label: 'Mixed Media' },
  { value: 'digital', label: 'Digital' },
  { value: 'drawing', label: 'Drawing' },
  { value: 'installation', label: 'Installation' },
  { value: 'other', label: 'Other' },
] as const;

export type OpenCallMedium = (typeof OPEN_CALL_MEDIUMS)[number]['value'];

export function getMediumLabel(value: string | null | undefined): string {
  if (!value) return '';
  return OPEN_CALL_MEDIUMS.find((m) => m.value === value)?.label ?? value;
}

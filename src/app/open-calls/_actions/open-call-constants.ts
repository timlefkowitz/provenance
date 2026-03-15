/**
 * Call type options for open calls (filter + display).
 */
export const OPEN_CALL_TYPES = [
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'art', label: 'Art' },
  { value: 'residency', label: 'Residency' },
  { value: 'grant', label: 'Grant' },
] as const;

export type OpenCallType = (typeof OPEN_CALL_TYPES)[number]['value'];

export function getCallTypeLabel(value: string): string {
  return OPEN_CALL_TYPES.find((t) => t.value === value)?.label ?? value;
}

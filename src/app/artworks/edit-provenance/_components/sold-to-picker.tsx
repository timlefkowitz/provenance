'use client';

import { PersonPicker } from '~/components/person-picker';

export type SoldToValue = {
  accountId?: string | null;
  email?: string | null;
  name?: string | null;
};

export interface SoldToPickerProps {
  value: SoldToValue | null;
  onChange: (value: SoldToValue | null) => void;
  className?: string;
}

/** Buyer field: someone on Provenance, or a new buyer by name with an optional email invite. */
export function SoldToPicker({ value, onChange, className }: SoldToPickerProps) {
  return (
    <PersonPicker
      className={className}
      role="any"
      noun="buyer"
      placeholder="Search for the buyer, or add them"
      askEmailForNew
      includeUnclaimed={false}
      value={
        value && (value.accountId || value.email || value.name)
          ? {
              accountId: value.accountId ?? null,
              name: value.name ?? '',
              email: value.email ?? null,
              isNew: !value.accountId,
            }
          : null
      }
      onChange={(v) =>
        onChange(
          v
            ? {
                accountId: v.accountId ?? null,
                name: v.name?.trim() || null,
                email: v.email?.trim().toLowerCase() || null,
              }
            : null,
        )
      }
    />
  );
}

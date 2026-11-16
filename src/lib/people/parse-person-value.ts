import { z } from 'zod';

import type { PersonValue } from './types';

const PersonValueSchema = z.object({
  accountId: z.string().uuid().nullish(),
  profileId: z.string().uuid().nullish(),
  name: z.string().max(200).default(''),
  email: z.string().trim().max(320).email().nullish().or(z.literal('').transform(() => null)),
  isNew: z.boolean().optional(),
});

/** Parse a PersonValue sent from a form (JSON string or object). Invalid → null. */
export function parsePersonValue(raw: unknown): PersonValue | null {
  if (raw == null || raw === '') return null;
  let input = raw;
  if (typeof raw === 'string') {
    try {
      input = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  const parsed = PersonValueSchema.safeParse(input);
  if (!parsed.success) return null;
  const v = parsed.data;
  if (!v.accountId && !v.profileId && !v.name.trim()) return null;
  return {
    accountId: v.accountId ?? null,
    profileId: v.profileId ?? null,
    name: v.name.trim(),
    email: v.email ? v.email.toLowerCase() : null,
    isNew: v.isNew,
  };
}

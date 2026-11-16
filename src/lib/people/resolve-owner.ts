import { asUntyped } from '~/lib/supabase-untyped';

import type { PersonValue } from './types';

export interface OwnerColumns {
  owned_by: string | null;
  owned_by_account_id: string | null;
  owned_by_profile_id: string | null;
}

/**
 * Columns for an "Owned by" value. Ids are re-checked against the database
 * (an unknown id is dropped, keeping the name). Never changes who holds the
 * work: that only happens when the owner accepts an ownership invite.
 */
export async function resolveOwnerColumns(
  db: unknown,
  owner: PersonValue | null | undefined,
): Promise<OwnerColumns> {
  if (!owner) return { owned_by: null, owned_by_account_id: null, owned_by_profile_id: null };
  const client = asUntyped(db);
  let name = owner.name?.trim() || null;
  let accountId: string | null = null;
  let profileId: string | null = null;

  if (owner.accountId) {
    const { data } = await client
      .from('accounts')
      .select('id, name')
      .eq('id', owner.accountId)
      .maybeSingle();
    if (data) {
      accountId = data.id as string;
      name = name || ((data.name as string | null) ?? null);
    }
  }
  if (owner.profileId) {
    const { data } = await client
      .from('user_profiles')
      .select('id, name, user_id, is_claimed, is_active')
      .eq('id', owner.profileId)
      .maybeSingle();
    if (data && data.is_active !== false) {
      profileId = data.id as string;
      name = name || ((data.name as string | null) ?? null);
      if (!accountId && data.is_claimed && data.user_id) accountId = data.user_id as string;
    }
  }

  return { owned_by: name, owned_by_account_id: accountId, owned_by_profile_id: profileId };
}

/** Only include the id columns when set, so older rows/updates stay untouched. */
export function ownerIdColumns(cols: OwnerColumns): Partial<OwnerColumns> {
  const out: Partial<OwnerColumns> = {};
  if (cols.owned_by_account_id) out.owned_by_account_id = cols.owned_by_account_id;
  if (cols.owned_by_profile_id) out.owned_by_profile_id = cols.owned_by_profile_id;
  return out;
}

import { asUntyped } from '~/lib/supabase-untyped';
import { escapeIlike } from '~/lib/escape-ilike';
import { getUserRole, isValidRole, type UserRole } from '~/lib/user-roles';

import {
  normalizePersonName,
  type PersonSearchResult,
  type PersonSearchRole,
} from './types';

export interface AccountRow {
  id: string;
  name: string | null;
  picture_url: string | null;
  public_data: Record<string, unknown> | null;
}

export interface ProfileRow {
  id: string;
  user_id: string | null;
  name: string | null;
  picture_url: string | null;
  location: string | null;
  role: string | null;
  is_claimed: boolean | null;
}

export interface MergeOptions {
  role: PersonSearchRole;
  includeUnclaimed: boolean;
  excludeIds: Set<string>;
  query: string;
  limit: number;
}

/**
 * Merge account and profile rows into one list of people:
 * - one entry per login account (its profile for the searched role attached),
 * - plus placeholder profiles with no login (only when includeUnclaimed),
 * - role-filtered, blocked/self excluded, exact-name matches first.
 */
export function mergePeople(
  accounts: AccountRow[],
  profiles: ProfileRow[],
  opts: MergeOptions,
): PersonSearchResult[] {
  const wantRole = opts.role === 'any' ? null : (opts.role as UserRole);
  const byAccount = new Map<string, PersonSearchResult>();
  const placeholders: PersonSearchResult[] = [];

  for (const acct of accounts) {
    if (!acct.name || opts.excludeIds.has(acct.id)) continue;
    const role = getUserRole(acct.public_data ?? {});
    byAccount.set(acct.id, {
      key: `account:${acct.id}`,
      accountId: acct.id,
      profileId: null,
      name: acct.name,
      picture_url: acct.picture_url ?? null,
      role,
      location: null,
      claimed: true,
    });
  }

  for (const p of profiles) {
    const role = isValidRole(p.role) ? (p.role as UserRole) : null;
    if (wantRole && role !== wantRole) continue;
    if (!p.name) continue;

    if (p.user_id) {
      if (opts.excludeIds.has(p.user_id)) continue;
      // A claimed managed profile (is_claimed false but user_id = builder) is
      // a draft owned by someone else, not that person's identity.
      if (p.is_claimed === false) {
        if (!opts.includeUnclaimed) continue;
        placeholders.push(placeholderFrom(p, role));
        continue;
      }
      const existing = byAccount.get(p.user_id);
      if (existing) {
        // Someone with several roles: the profile for the searched role wins,
        // so a collector who also has an artist profile is found as an artist.
        if (wantRole && role === wantRole) {
          existing.role = role;
          existing.profileId = p.id;
        } else if (!existing.profileId) {
          existing.profileId = p.id;
          existing.role = existing.role ?? role;
        }
        existing.location = existing.location ?? p.location ?? null;
        if (!existing.picture_url) existing.picture_url = p.picture_url ?? null;
        continue;
      }
      byAccount.set(p.user_id, {
        key: `account:${p.user_id}`,
        accountId: p.user_id,
        profileId: p.id,
        name: p.name,
        picture_url: p.picture_url ?? null,
        role,
        location: p.location ?? null,
        claimed: true,
      });
      continue;
    }

    if (!opts.includeUnclaimed) continue;
    placeholders.push(placeholderFrom(p, role));
  }

  let people = Array.from(byAccount.values());
  if (wantRole) {
    people = people.filter((p) => p.role === wantRole);
  }

  const q = normalizePersonName(opts.query);
  const rank = (p: PersonSearchResult) => {
    const n = normalizePersonName(p.name);
    if (n === q) return 0;
    if (n.startsWith(q)) return 1;
    return 2;
  };

  // De-dupe placeholders that share a normalised name; keep the first.
  const seenPlaceholder = new Set<string>();
  const uniquePlaceholders = placeholders.filter((p) => {
    const n = normalizePersonName(p.name);
    if (seenPlaceholder.has(n)) return false;
    seenPlaceholder.add(n);
    return true;
  });

  return [...people, ...uniquePlaceholders]
    .map((p, i) => ({ p, i }))
    .sort((a, b) => {
      const r = rank(a.p) - rank(b.p);
      if (r !== 0) return r;
      // Real accounts before placeholders at the same rank.
      if (a.p.claimed !== b.p.claimed) return a.p.claimed ? -1 : 1;
      return a.i - b.i;
    })
    .map(({ p }) => p)
    .slice(0, opts.limit);
}

function placeholderFrom(p: ProfileRow, role: UserRole | null): PersonSearchResult {
  return {
    key: `profile:${p.id}`,
    accountId: null,
    profileId: p.id,
    name: p.name ?? '',
    picture_url: p.picture_url ?? null,
    role,
    location: p.location ?? null,
    claimed: false,
  };
}

/**
 * Search people by name across accounts and user_profiles. Callers do auth
 * and rate limiting. Never selects email.
 */
export async function searchPeople(
  client: unknown,
  params: {
    query: string;
    role: PersonSearchRole;
    includeUnclaimed: boolean;
    excludeIds?: Iterable<string>;
    limit?: number;
  },
): Promise<PersonSearchResult[]> {
  const db = asUntyped(client);
  const pattern = `%${escapeIlike(params.query)}%`;
  const fetchLimit = 30;

  let profileQuery = db
    .from('user_profiles')
    .select('id, user_id, name, picture_url, location, role, is_claimed')
    .eq('is_active', true)
    .ilike('name', pattern)
    .limit(fetchLimit);
  if (params.role !== 'any') {
    profileQuery = profileQuery.eq('role', params.role);
  }

  const [accountsRes, profilesRes] = await Promise.all([
    db
      .from('accounts')
      .select('id, name, picture_url, public_data')
      .ilike('name', pattern)
      .limit(fetchLimit),
    profileQuery,
  ]);

  if (accountsRes.error) {
    console.error('[People] accounts search failed', accountsRes.error);
  }
  if (profilesRes.error) {
    console.error('[People] user_profiles search failed', profilesRes.error);
  }
  if (accountsRes.error && profilesRes.error) {
    throw new Error('People search failed');
  }

  // Profiles matched by name may belong to accounts whose account name
  // differs; fetch those accounts so roles and avatars resolve.
  const accounts = (accountsRes.data ?? []) as AccountRow[];
  const profiles = (profilesRes.data ?? []) as ProfileRow[];
  const known = new Set(accounts.map((a) => a.id));
  const missing = Array.from(
    new Set(
      profiles
        .filter((p) => p.user_id && p.is_claimed !== false && !known.has(p.user_id))
        .map((p) => p.user_id as string),
    ),
  );
  if (missing.length > 0) {
    const { data: extra } = await db
      .from('accounts')
      .select('id, name, picture_url, public_data')
      .in('id', missing);
    // Keep the profile's display name: it is what matched the search.
    for (const a of (extra ?? []) as AccountRow[]) {
      const prof = profiles.find((p) => p.user_id === a.id);
      accounts.push({ ...a, name: prof?.name ?? a.name });
    }
  }

  return mergePeople(accounts, profiles, {
    role: params.role,
    includeUnclaimed: params.includeUnclaimed,
    excludeIds: new Set(params.excludeIds ?? []),
    query: params.query,
    limit: params.limit ?? 12,
  });
}

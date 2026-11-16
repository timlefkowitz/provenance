import type { UserRole } from '~/lib/user-roles';

/** A person or organisation found by search. Never carries an email. */
export interface PersonSearchResult {
  /** Stable key for lists: `account:<id>` or `profile:<id>`. */
  key: string;
  /** The person's login account, when they have one. */
  accountId: string | null;
  /** Their user_profiles row for the searched role (claimed or placeholder). */
  profileId: string | null;
  name: string;
  picture_url: string | null;
  role: UserRole | null;
  location: string | null;
  /** False for placeholder profiles nobody has claimed yet. */
  claimed: boolean;
}

/**
 * What a person field submits. Either an existing person (accountId and/or
 * profileId), or a new one by name (plus an optional email to invite them).
 */
export interface PersonValue {
  accountId?: string | null;
  profileId?: string | null;
  name: string;
  email?: string | null;
  /** True when the user chose "add as new" rather than an existing match. */
  isNew?: boolean;
}

export type PersonSearchRole = 'artist' | 'collector' | 'gallery' | 'institution' | 'any';

/** Case- and whitespace-insensitive form of a name, for duplicate matching. */
export function normalizePersonName(name: string | null | undefined): string {
  return (name ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase();
}

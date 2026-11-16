/**
 * Artist profile content that other people can ask for (claimed artists) or
 * fill in themselves (unclaimed artists): CV, statement, exhibition history,
 * bio and header image. Pure helpers, shared by server actions, client
 * components and tests.
 */
import type { ArtistCvJson } from '~/lib/grants';
import { USER_ROLES } from '~/lib/user-roles';
import { appendCvEntriesToCvJson, cvEntriesFromCvJson } from '~/lib/artist-details/fields';

export const REQUESTABLE_FIELDS = ['cv', 'artist_statement', 'exhibitions', 'bio', 'header_image'] as const;
export type RequestableField = (typeof REQUESTABLE_FIELDS)[number];

export const REQUESTABLE_FIELD_LABELS: Record<RequestableField, string> = {
  cv: 'CV',
  artist_statement: 'Artist statement',
  exhibitions: 'Exhibition history',
  bio: 'Bio',
  header_image: 'Header image',
};

/** Columns in artist_profile_contributions.field */
export const CONTRIBUTION_FIELDS = ['bio', 'artist_statement', 'header_image_url', 'cv', 'exhibitions'] as const;
export type ContributionField = (typeof CONTRIBUTION_FIELDS)[number];

export const MAX_REQUEST_MESSAGE = 2000;
/** Open requests one person may have across all artists at once. */
export const MAX_OPEN_REQUESTS_PER_REQUESTER = 25;

export function sanitizeRequestedFields(raw: unknown): RequestableField[] {
  if (!Array.isArray(raw)) return [];
  const wanted = new Set(raw.filter((f): f is string => typeof f === 'string'));
  return REQUESTABLE_FIELDS.filter((f) => wanted.has(f));
}

export function describeRequestedFields(fields: readonly RequestableField[]): string {
  const labels = fields.map((f) => REQUESTABLE_FIELD_LABELS[f]);
  if (labels.length <= 1) return labels[0] ?? '';
  return `${labels.slice(0, -1).join(', ')} and ${labels[labels.length - 1]}`;
}

/** Where the artist goes to do what was asked. Without a profile yet, the general profile page. */
export function fulfilHrefForField(
  field: RequestableField,
  target: { artistAccountId: string; profileId: string | null },
): string {
  const query = target.profileId ? `?profileId=${target.profileId}` : '';
  switch (field) {
    case 'cv':
    case 'exhibitions':
      return `/artists/${target.artistAccountId}/cv${query}`;
    default:
      return target.profileId ? `/profiles/${target.profileId}/edit` : '/profile';
  }
}

export type ArtistProfileLike = {
  id?: string;
  role?: string | null;
  user_id?: string | null;
  is_active?: boolean | null;
  is_claimed?: boolean | null;
};

/** An artist profile nobody has claimed: anyone signed in may add to it. */
export function isUnclaimedArtistProfile(profile: ArtistProfileLike | null | undefined): boolean {
  return Boolean(
    profile &&
      profile.role === USER_ROLES.ARTIST &&
      profile.user_id == null &&
      profile.is_active !== false &&
      profile.is_claimed !== true,
  );
}

/** A signed-in visitor (not the artist themself) may ask an artist with an account for an update. */
export function canRequestUpdateFrom(artistAccountId: string | null | undefined, viewerId: string | null | undefined): boolean {
  return Boolean(viewerId && artistAccountId && artistAccountId !== viewerId);
}

// ---------------------------------------------------------------------------
// Carry-over when a claim merges a duplicate profile into the artist's own

export type CarryOverProfile = {
  bio: string | null;
  artist_statement: string | null;
  header_image_url: string | null;
  artist_cv_json: ArtistCvJson | null;
  artist_cv_file_url: string | null;
  artist_cv_file_path: string | null;
  artist_cv_uploaded_at: string | null;
};

const blank = (v: unknown) => v == null || (typeof v === 'string' && v.trim() === '');

/**
 * user_profiles update that copies content from a duplicate (unclaimed)
 * profile into the artist's own profile. Never overwrites what the artist
 * already wrote: text and header fill only empty fields, a CV file is copied
 * only when the target has none, and CV entries the target lacks are added.
 * Returns the fields changed (empty when there is nothing to copy).
 */
export function buildCarryOverUpdate(from: CarryOverProfile, to: CarryOverProfile): Partial<CarryOverProfile> {
  const update: Partial<CarryOverProfile> = {};
  for (const f of ['bio', 'artist_statement', 'header_image_url'] as const) {
    if (blank(to[f]) && !blank(from[f])) update[f] = from[f];
  }

  const fromEntries = cvEntriesFromCvJson(from.artist_cv_json);
  if (!to.artist_cv_json && from.artist_cv_json) {
    update.artist_cv_json = from.artist_cv_json;
  } else if (to.artist_cv_json && fromEntries.length > 0) {
    const merged = appendCvEntriesToCvJson(to.artist_cv_json, fromEntries);
    if (cvEntriesFromCvJson(merged).length > cvEntriesFromCvJson(to.artist_cv_json).length) {
      update.artist_cv_json = merged;
    }
  }
  if (!to.artist_cv_file_path && from.artist_cv_file_path) {
    update.artist_cv_file_path = from.artist_cv_file_path;
    update.artist_cv_file_url = from.artist_cv_file_url;
    update.artist_cv_uploaded_at = from.artist_cv_uploaded_at;
  }
  return update;
}

/**
 * Pure helpers for open calls. Not in _actions so they are not treated as Server Actions.
 */

export type OpenCallForExpiry = {
  submission_closing_date: string | null;
};

export type OpenCallEntryForLocation = {
  eligible_locations: string[] | null;
};

/** True if submission period has ended (used for expired section / detail page). */
export function isOpenCallSubmissionExpired(openCall: OpenCallForExpiry): boolean {
  const closing = openCall.submission_closing_date;
  if (!closing) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const closeDate = new Date(closing);
  closeDate.setHours(0, 0, 0, 0);
  return closeDate < today;
}

/** True if user's location qualifies (empty eligible_locations = qualifies). */
export function qualifiesByLocation(
  entry: OpenCallEntryForLocation,
  userLocation: string | null,
): boolean {
  if (!userLocation?.trim()) return false;
  const locs = entry.eligible_locations ?? [];
  if (locs.length === 0) return true;
  const locationLower = userLocation.trim().toLowerCase();
  return locs.some(
    (loc) =>
      loc.toLowerCase().includes(locationLower) ||
      locationLower.includes(loc.toLowerCase()),
  );
}

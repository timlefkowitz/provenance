import 'server-only';

/**
 * Single place to gate AI features by plan. Artist research ("Find
 * information" on the curator's Artists tab) is free for now; to make it
 * paid later, check getActiveSubscription(userId) from ~/lib/subscription here.
 */
export async function canUseArtistResearch(_userId: string): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  return { allowed: true };
}

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { canManageExhibition, getTeamGalleriesForUser } from '~/app/profiles/_actions/gallery-members';
import { getUserGalleryProfiles } from '~/app/artworks/add/_actions/get-user-gallery-profiles';
import { canSellArtwork } from '~/lib/sales/can-sell-artwork';
import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { USER_ROLES } from '~/lib/user-roles';

export type AuctionRecord = {
  id: string;
  organizer_account_id: string;
  organizer_profile_id: string | null;
  owner_role: string | null;
  exhibition_id: string | null;
  title: string;
  description: string | null;
  image_url: string | null;
  currency: string;
  starts_at: string;
  ends_at: string;
  lot_stagger_seconds: number;
  anti_snipe_seconds: number;
  accepts_consignments: boolean;
  status: string;
  published_at: string | null;
  created_at: string;
};

export const AUCTION_SELECT =
  'id, organizer_account_id, organizer_profile_id, owner_role, exhibition_id, title, description, image_url, currency, starts_at, ends_at, lot_stagger_seconds, anti_snipe_seconds, accepts_consignments, status, published_at, created_at';

export function adminDb(): UntypedSupabaseClient {
  return asUntyped(getSupabaseServerAdminClient());
}

export async function getViewer(): Promise<{ id: string; email: string | null } | null> {
  const client = asUntyped(getSupabaseServerClient());
  const {
    data: { user },
  } = await client.auth.getUser();
  return user ? { id: user.id, email: user.email ?? null } : null;
}

export async function loadAuction(auctionId: string): Promise<AuctionRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(auctionId)) return null;
  const { data } = await adminDb().from('auctions').select(AUCTION_SELECT).eq('id', auctionId).maybeSingle();
  return (data ?? null) as AuctionRecord | null;
}

/** The organizer account itself, or anyone on its gallery / institution team. */
export async function canManageAuction(userId: string | null | undefined, auction: Pick<AuctionRecord, 'organizer_account_id'>) {
  if (!userId) return false;
  return canManageExhibition(userId, auction.organizer_account_id);
}

export async function canAuctionArtwork(
  userId: string,
  artwork: { id: string; account_id: string | null; gallery_profile_id?: string | null },
) {
  return canSellArtwork(userId, artwork);
}

/** Accounts this user can run an auction as: themselves plus their gallery / institution teams. */
export async function organizerOptions(userId: string, fallbackName: string) {
  const teams = await getTeamGalleriesForUser(userId).catch(() => []);
  return [{ accountId: userId, name: fallbackName }, ...teams.map((t) => ({ accountId: t.accountId, name: t.name }))];
}

export type AuctionableArtwork = {
  id: string;
  title: string;
  artist_name: string | null;
  image_url: string | null;
  certificate_type: string | null;
  value: string | null;
};

/**
 * Works this user can put up for auction: verified, unsold certificates they
 * hold, plus their gallery / institution team's certificates.
 */
export async function loadAuctionableArtworks(userId: string): Promise<AuctionableArtwork[]> {
  const db = adminDb();
  const select = 'id, title, artist_name, image_url, certificate_type, value, created_at';
  const { data: own } = await db
    .from('artworks')
    .select(select)
    .eq('account_id', userId)
    .eq('status', 'verified')
    .or('is_sold.is.null,is_sold.eq.false')
    .order('created_at', { ascending: false })
    .limit(500);

  const profiles = await getUserGalleryProfiles(userId, [USER_ROLES.GALLERY, USER_ROLES.INSTITUTION]).catch(() => []);
  let team: AuctionableArtwork[] = [];
  if (profiles.length) {
    const { data } = await db
      .from('artworks')
      .select(select)
      .in('gallery_profile_id', profiles.map((p) => p.id))
      .eq('status', 'verified')
      .or('is_sold.is.null,is_sold.eq.false')
      .order('created_at', { ascending: false })
      .limit(500);
    team = (data ?? []) as AuctionableArtwork[];
  }

  const byId = new Map<string, AuctionableArtwork>();
  for (const a of [...((own ?? []) as AuctionableArtwork[]), ...team]) byId.set(a.id, a);

  // Leave out works already on offer in another auction.
  const ids = [...byId.keys()];
  if (ids.length) {
    const { data: active } = await db
      .from('auction_lots')
      .select('artwork_id')
      .in('artwork_id', ids)
      .in('status', ['pending', 'open']);
    for (const r of (active ?? []) as Array<{ artwork_id: string }>) byId.delete(r.artwork_id);
  }
  return [...byId.values()];
}

export async function displayNameForAccount(db: UntypedSupabaseClient | SupabaseClient, accountId: string) {
  const { data } = await asUntyped(db).from('accounts').select('name').eq('id', accountId).maybeSingle();
  return (data?.name as string) || null;
}

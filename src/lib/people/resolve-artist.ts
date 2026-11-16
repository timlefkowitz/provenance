import { asUntyped } from '~/lib/supabase-untyped';
import { escapeIlike } from '~/lib/escape-ilike';
import { getUserRole, USER_ROLES, type UserRole } from '~/lib/user-roles';

import { normalizePersonName, type PersonValue } from './types';

export interface ResolvedArtist {
  /** Name to store in artworks.artist_name. */
  name: string;
  artistAccountId: string | null;
  artistProfileId: string | null;
  /** True when this call created a new placeholder profile. */
  created: boolean;
}

const EMPTY: ResolvedArtist = { name: '', artistAccountId: null, artistProfileId: null, created: false };

/** Roles that post other people's work and so name an artist. */
export function postsOthersWork(role: UserRole | null | undefined): boolean {
  return (
    role === USER_ROLES.GALLERY || role === USER_ROLES.COLLECTOR || role === USER_ROLES.INSTITUTION
  );
}

type ProfileRow = {
  id: string;
  user_id: string | null;
  name: string | null;
  role: string | null;
  is_active: boolean | null;
  is_claimed: boolean | null;
};

/**
 * Turn an artist field into artwork columns. Never trusts ids from the
 * browser: each is re-read and must be an active artist.
 *
 * - Picked account → that account + its claimed artist profile.
 * - Picked profile → that profile (+ its account if claimed).
 * - New name (`isNew`) → reuse a placeholder artist profile with the same
 *   name (ignoring case/spacing), else create one. Never attaches to a
 *   registered account by name: the user said this is someone new.
 * - Plain text (no ids, `isNew` unset; older callers, imports) → as above,
 *   but first link a registered artist account if exactly one has that name.
 *
 * `db` must be the service-role client: placeholder inserts bypass the
 * user_profiles insert policy, which only lets galleries create them.
 */
export async function resolveArtist(
  db: unknown,
  params: {
    artist: PersonValue | null | undefined;
    posterAccountId: string;
    medium?: string | null;
  },
): Promise<ResolvedArtist> {
  const client = asUntyped(db);
  const artist = params.artist;
  const typedName = (artist?.name ?? '').trim().replace(/\s+/g, ' ');

  if (artist?.accountId) {
    const byAccount = await resolveAccount(client, artist.accountId);
    if (byAccount) return byAccount;
  }
  if (artist?.profileId) {
    const byProfile = await resolveProfile(client, artist.profileId);
    if (byProfile) return byProfile;
  }
  if (!typedName) return EMPTY;

  const legacyText = !artist?.isNew && !artist?.accountId && !artist?.profileId;
  if (legacyText) {
    const account = await uniqueArtistAccountByName(client, typedName);
    if (account) {
      const linked = await resolveAccount(client, account);
      if (linked) return { ...linked, name: typedName };
    }
  }

  const placeholder = await findPlaceholderByName(client, typedName);
  if (placeholder) {
    return {
      name: typedName,
      artistAccountId: placeholder.user_id,
      artistProfileId: placeholder.id,
      created: false,
    };
  }

  const { data: inserted, error } = await client
    .from('user_profiles')
    .insert({
      user_id: null,
      role: USER_ROLES.ARTIST,
      name: typedName,
      medium: params.medium?.trim() || null,
      is_claimed: false,
      is_active: true,
      created_by_gallery_id: params.posterAccountId,
    })
    .select('id')
    .single();

  if (error || !inserted) {
    console.error('[People] resolveArtist placeholder insert failed', error);
    // A concurrent insert may have won; one more look before giving up.
    const again = await findPlaceholderByName(client, typedName);
    return again
      ? { name: typedName, artistAccountId: again.user_id, artistProfileId: again.id, created: false }
      : { ...EMPTY, name: typedName };
  }

  console.log('[People] resolveArtist created placeholder artist', { profileId: inserted.id });
  return { name: typedName, artistAccountId: null, artistProfileId: inserted.id as string, created: true };
}

async function resolveAccount(
  client: ReturnType<typeof asUntyped>,
  accountId: string,
): Promise<ResolvedArtist | null> {
  const [{ data: account }, { data: profile }] = await Promise.all([
    client.from('accounts').select('id, name, public_data').eq('id', accountId).maybeSingle(),
    client
      .from('user_profiles')
      .select('id, name')
      .eq('user_id', accountId)
      .eq('role', USER_ROLES.ARTIST)
      .eq('is_active', true)
      .eq('is_claimed', true)
      .maybeSingle(),
  ]);
  if (!account) return null;
  const isArtist =
    !!profile || getUserRole(account.public_data as Record<string, unknown>) === USER_ROLES.ARTIST;
  if (!isArtist) return null;
  return {
    name: ((profile?.name as string | null) || (account.name as string | null) || '').trim(),
    artistAccountId: account.id as string,
    artistProfileId: (profile?.id as string | null) ?? null,
    created: false,
  };
}

async function resolveProfile(
  client: ReturnType<typeof asUntyped>,
  profileId: string,
): Promise<ResolvedArtist | null> {
  const { data } = await client
    .from('user_profiles')
    .select('id, user_id, name, role, is_active, is_claimed')
    .eq('id', profileId)
    .maybeSingle();
  const p = data as ProfileRow | null;
  if (!p || p.role !== USER_ROLES.ARTIST || p.is_active === false) return null;
  return {
    name: (p.name ?? '').trim(),
    // A placeholder's user_id is null; a claimed profile's is the artist.
    artistAccountId: p.is_claimed ? p.user_id : null,
    artistProfileId: p.id,
    created: false,
  };
}

async function uniqueArtistAccountByName(
  client: ReturnType<typeof asUntyped>,
  name: string,
): Promise<string | null> {
  const { data } = await client
    .from('accounts')
    .select('id, name, public_data')
    .ilike('name', escapeIlike(name))
    .limit(5);
  const target = normalizePersonName(name);
  const artists = (data ?? []).filter(
    (row: { name: string | null; public_data: unknown }) =>
      normalizePersonName(row.name) === target &&
      getUserRole(row.public_data as Record<string, unknown>) === USER_ROLES.ARTIST,
  );
  return artists.length === 1 ? (artists[0].id as string) : null;
}

async function findPlaceholderByName(
  client: ReturnType<typeof asUntyped>,
  name: string,
): Promise<ProfileRow | null> {
  const { data } = await client
    .from('user_profiles')
    .select('id, user_id, name, role, is_active, is_claimed')
    .eq('role', USER_ROLES.ARTIST)
    .eq('is_active', true)
    .is('user_id', null)
    .ilike('name', escapeIlike(name))
    .order('created_at', { ascending: true })
    .limit(5);
  const target = normalizePersonName(name);
  return (
    ((data ?? []) as ProfileRow[]).find((p) => normalizePersonName(p.name) === target) ?? null
  );
}

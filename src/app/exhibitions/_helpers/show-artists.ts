import type { UntypedSupabaseClient } from '~/lib/supabase-untyped';

/** One artist in a show, credited directly or through a work in it. */
export type ShowArtist = {
  /** Stable per artist: `a:<account>`, `p:<profile>` or `n:<name>`. */
  key: string;
  name: string;
  picture_url: string | null;
  /** Public profile page, or null when the work names an artist we can't find. */
  href: string | null;
  workCount: number;
};

export type ShowArtistWorkRow = {
  artist_name: string | null;
  artist_account_id: string | null;
  artist_profile_id: string | null;
};

type ProfileRow = { id: string; user_id: string | null; name: string | null; picture_url: string | null };

const norm = (s: string | null | undefined) => (s ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

/**
 * Every artist in an exhibition: the ones credited on the show plus the
 * artist of each work in it, one entry each, linked to their profile.
 * `/artists/<id>` takes an account id or an unclaimed artist profile id
 * (a claimed profile redirects to its account).
 */
export async function resolveShowArtists(
  client: UntypedSupabaseClient,
  credited: Array<{ id: string; name: string; picture_url: string | null }>,
  works: ShowArtistWorkRow[],
): Promise<ShowArtist[]> {
  const profileIds = [...new Set(works.map((w) => w.artist_profile_id).filter(Boolean))] as string[];
  const profiles = new Map<string, ProfileRow>();
  if (profileIds.length > 0) {
    const { data, error } = await client
      .from('user_profiles')
      .select('id, user_id, name, picture_url')
      .in('id', profileIds);
    if (error) console.error('[Exhibitions] show artists: profiles fetch failed', error);
    for (const row of (data || []) as ProfileRow[]) profiles.set(row.id, row);
  }

  // Works that name an artist but aren't linked to one: link the name to an
  // artist profile only when exactly one active artist has it.
  const linkedNames = new Set(credited.map((c) => norm(c.name)));
  const looseNames = [
    ...new Set(
      works
        .filter((w) => !w.artist_account_id && !w.artist_profile_id && norm(w.artist_name))
        .map((w) => w.artist_name!.trim())
        .filter((n) => !linkedNames.has(norm(n))),
    ),
  ];
  const profileByName = new Map<string, ProfileRow>();
  await Promise.all(
    looseNames.map(async (name) => {
      const { data, error } = await client
        .from('user_profiles')
        .select('id, user_id, name, picture_url')
        .ilike('name', name.replace(/[\\%_]/g, (c) => `\\${c}`))
        .eq('role', 'artist')
        .eq('is_active', true)
        .limit(2);
      if (error) console.error('[Exhibitions] show artists: name lookup failed', error);
      if (data && data.length === 1) profileByName.set(norm(name), data[0] as ProfileRow);
    }),
  );

  const accountIds = new Set<string>();
  for (const w of works) {
    if (w.artist_account_id) accountIds.add(w.artist_account_id);
  }
  for (const p of [...profiles.values(), ...profileByName.values()]) {
    if (p.user_id) accountIds.add(p.user_id);
  }
  for (const c of credited) accountIds.delete(c.id);
  const accounts = new Map<string, { name: string | null; picture_url: string | null }>();
  if (accountIds.size > 0) {
    const { data, error } = await client
      .from('accounts')
      .select('id, name, picture_url')
      .in('id', [...accountIds]);
    if (error) console.error('[Exhibitions] show artists: accounts fetch failed', error);
    for (const row of data || []) accounts.set(row.id, { name: row.name, picture_url: row.picture_url });
  }

  const byKey = new Map<string, ShowArtist>();
  const keyByName = new Map<string, string>();
  const add = (entry: Omit<ShowArtist, 'workCount'>) => {
    const existing = byKey.get(entry.key);
    if (existing) return existing;
    const created = { ...entry, workCount: 0 };
    byKey.set(entry.key, created);
    const n = norm(entry.name);
    if (n && !keyByName.has(n)) keyByName.set(n, entry.key);
    return created;
  };

  for (const c of credited) {
    add({ key: `a:${c.id}`, name: c.name, picture_url: c.picture_url, href: `/artists/${c.id}` });
  }

  // Linked works first, so a bare name on another work can join that artist.
  const linkedFirst = [...works].sort(
    (a, b) =>
      Number(!a.artist_account_id && !a.artist_profile_id) -
      Number(!b.artist_account_id && !b.artist_profile_id),
  );
  for (const w of linkedFirst) {
    const typed = w.artist_name?.trim() || '';
    const profile =
      (w.artist_profile_id ? profiles.get(w.artist_profile_id) : undefined) ??
      (!w.artist_account_id && !w.artist_profile_id ? profileByName.get(norm(typed)) : undefined);
    const accountId = w.artist_account_id ?? profile?.user_id ?? null;
    const account = accountId ? accounts.get(accountId) : undefined;
    const name = typed || account?.name?.trim() || profile?.name?.trim() || '';

    let entry: ShowArtist | undefined;
    if (accountId) {
      entry =
        byKey.get(`a:${accountId}`) ??
        add({
          key: `a:${accountId}`,
          name: name || 'Unknown artist',
          picture_url: account?.picture_url ?? profile?.picture_url ?? null,
          href: `/artists/${accountId}`,
        });
    } else if (profile) {
      entry =
        byKey.get(`p:${profile.id}`) ??
        add({
          key: `p:${profile.id}`,
          name: name || 'Unknown artist',
          picture_url: profile.picture_url,
          href: `/artists/${profile.id}`,
        });
    } else if (name) {
      // Same name as an artist already listed: count it there.
      const known = keyByName.get(norm(name));
      entry = (known && byKey.get(known)) || add({ key: `n:${norm(name)}`, name, picture_url: null, href: null });
    }
    if (entry) entry.workCount += 1;
  }

  const result = [...byKey.values()];
  console.log('[Exhibitions] show artists', {
    credited: credited.length,
    total: result.length,
    unlinked: result.filter((a) => !a.href).length,
  });
  return result;
}

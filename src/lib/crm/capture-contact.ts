import { asUntyped, type UntypedSupabaseClient } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { resolveArtistUserId } from './owner';
import { uniqueArtworkIds } from './lead-artworks';

export type CaptureContactInput = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  source: string;
  notes?: string | null;
  /** Artwork this contact came from (sale, certificate, inquiry…); shown on hover in the mailing list. */
  artworkId?: string | null;
  /** Several artworks at once (batch invites, repeat buyers). Merged with `artworkId`. */
  artworkIds?: string[] | null;
};

function normalizeEmail(email: string | null | undefined): string | null {
  const trimmed = email?.trim().toLowerCase();
  return trimmed && trimmed.includes('@') ? trimmed : null;
}

function normalizeName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  return trimmed || null;
}

function hasContactData(input: CaptureContactInput): boolean {
  return Boolean(normalizeEmail(input.email) || normalizeName(input.name));
}

/**
 * Links a contact to artworks in artist_lead_artworks. Best-effort: a missing
 * table or a stale artwork id must never cost us the contact itself.
 */
async function linkArtworks(
  client: UntypedSupabaseClient,
  leadId: string,
  artworkIds: string[],
  source: string | null,
): Promise<void> {
  if (artworkIds.length === 0) return;
  const rows = artworkIds.map((artwork_id) => ({ lead_id: leadId, artwork_id, source }));
  const write = (r: typeof rows) =>
    client.from('artist_lead_artworks').upsert(r, { onConflict: 'lead_id,artwork_id', ignoreDuplicates: true });

  const { error } = await write(rows);
  if (!error) return;

  if (error.code === '23503') {
    // At least one artwork id is stale; link the rest one by one.
    for (const row of rows) {
      const { error: rowError } = await write([row]);
      if (rowError && rowError.code !== '23503') {
        console.error('[CRM] captureCrmContacts link failed', rowError);
      }
    }
    return;
  }
  console.error('[CRM] captureCrmContacts link failed', error);
}

/**
 * Upserts mailing-list contacts into artist_leads with is_lead=false.
 * Failures are logged and swallowed so primary actions are never blocked.
 *
 * By default runs as the signed-in user (RLS applies). Callers with no user
 * session — the Stripe webhook, public artist-site forms — must pass the admin
 * client, and must derive `actingUserId` from trusted server data, never from
 * request input, since the admin client bypasses RLS.
 */
export async function captureCrmContacts(
  actingUserId: string,
  contacts: CaptureContactInput[],
  options?: { client?: UntypedSupabaseClient },
): Promise<void> {
  const valid = contacts.filter(hasContactData);
  if (valid.length === 0) return;

  console.log('[CRM] captureCrmContacts started', { count: valid.length, actingUserId });

  try {
    const client = options?.client ?? asUntyped(getSupabaseServerClient());
    const artistUserId = await resolveArtistUserId(client, actingUserId);

    for (const input of valid) {
      const email = normalizeEmail(input.email);
      const name = normalizeName(input.name);
      const phone = input.phone?.trim() || null;
      const notes = input.notes?.trim() || null;
      const source = input.source?.trim() || null;
      const artworkIds = uniqueArtworkIds(input.artworkId, input.artworkIds);
      const artworkId = artworkIds[0] ?? null;

      let existing: { id: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; notes: string | null; source: string | null; artwork_id: string | null } | null = null;

      if (email) {
        const { data: byEmail } = await asUntyped(client)
          .from('artist_leads')
          .select('id, contact_name, contact_email, contact_phone, notes, source, artwork_id')
          .eq('artist_user_id', artistUserId)
          .ilike('contact_email', email)
          .limit(1)
          .maybeSingle();
        existing = byEmail ?? null;
      }

      if (!existing && name && !email) {
        const { data: byName } = await asUntyped(client)
          .from('artist_leads')
          .select('id, contact_name, contact_email, contact_phone, notes, source, artwork_id')
          .eq('artist_user_id', artistUserId)
          .is('contact_email', null)
          .ilike('contact_name', name)
          .limit(1)
          .maybeSingle();
        existing = byName ?? null;
      }

      if (existing) {
        const patch: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (name && !existing.contact_name) patch.contact_name = name;
        if (email && !existing.contact_email) patch.contact_email = email;
        if (phone && !existing.contact_phone) patch.contact_phone = phone;
        if (notes && !existing.notes) patch.notes = notes;
        if (source && !existing.source) patch.source = source;
        // Keep the first linked artwork; never overwrite an existing link.
        if (artworkId && !existing.artwork_id) patch.artwork_id = artworkId;

        if (Object.keys(patch).length > 1) {
          const applyPatch = (p: Record<string, unknown>) =>
            asUntyped(client)
              .from('artist_leads')
              .update(p)
              .eq('id', existing.id)
              .eq('artist_user_id', artistUserId);

          let { error: updateError } = await applyPatch(patch);

          // A stale artwork id (FK violation) must not block the other field updates.
          if (updateError?.code === '23503' && 'artwork_id' in patch) {
            console.warn('[CRM] captureCrmContacts: artwork link rejected on update', { artworkId });
            const { artwork_id: _dropped, ...rest } = patch;
            void _dropped;
            if (Object.keys(rest).length > 1) {
              ({ error: updateError } = await applyPatch(rest));
            } else {
              updateError = null;
            }
          }

          if (updateError) {
            console.error('[CRM] captureCrmContacts update failed', updateError);
          }
        }
        await linkArtworks(client, existing.id, artworkIds, source);
        continue;
      }

      const row = {
        artist_user_id: artistUserId,
        contact_name: name,
        contact_email: email,
        contact_phone: phone,
        notes,
        source,
        stage: 'interested',
        is_lead: false,
        intel: {},
      };

      let { data: inserted, error: insertError } = await client
        .from('artist_leads')
        .insert({ ...row, artwork_id: artworkId })
        .select('id')
        .maybeSingle();

      // A stale artwork id (FK violation) must not cost us the contact itself.
      if (insertError?.code === '23503' && artworkId) {
        console.warn('[CRM] captureCrmContacts: artwork link rejected, saving contact without it', { artworkId });
        ({ data: inserted, error: insertError } = await client
          .from('artist_leads')
          .insert(row)
          .select('id')
          .maybeSingle());
      }

      if (insertError) {
        console.error('[CRM] captureCrmContacts insert failed', insertError);
      } else if (inserted?.id) {
        await linkArtworks(client, inserted.id as string, artworkIds, source);
      }
    }

    console.log('[CRM] captureCrmContacts finished', { count: valid.length });
  } catch (err) {
    console.error('[CRM] captureCrmContacts failed', err);
  }
}

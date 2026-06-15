import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { resolveArtistUserId } from './owner';

export type CaptureContactInput = {
  email?: string | null;
  name?: string | null;
  phone?: string | null;
  source: string;
  notes?: string | null;
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
 * Upserts mailing-list contacts into artist_leads with is_lead=false.
 * Failures are logged and swallowed so primary actions are never blocked.
 */
export async function captureCrmContacts(
  actingUserId: string,
  contacts: CaptureContactInput[],
): Promise<void> {
  const valid = contacts.filter(hasContactData);
  if (valid.length === 0) return;

  console.log('[CRM] captureCrmContacts started', { count: valid.length, actingUserId });

  try {
    const client = getSupabaseServerClient();
    const artistUserId = await resolveArtistUserId(client, actingUserId);

    for (const input of valid) {
      const email = normalizeEmail(input.email);
      const name = normalizeName(input.name);
      const phone = input.phone?.trim() || null;
      const notes = input.notes?.trim() || null;
      const source = input.source?.trim() || null;

      let existing: { id: string; contact_name: string | null; contact_email: string | null; contact_phone: string | null; notes: string | null; source: string | null } | null = null;

      if (email) {
        const { data: byEmail } = await (client as any)
          .from('artist_leads')
          .select('id, contact_name, contact_email, contact_phone, notes, source')
          .eq('artist_user_id', artistUserId)
          .ilike('contact_email', email)
          .limit(1)
          .maybeSingle();
        existing = byEmail ?? null;
      }

      if (!existing && name && !email) {
        const { data: byName } = await (client as any)
          .from('artist_leads')
          .select('id, contact_name, contact_email, contact_phone, notes, source')
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

        if (Object.keys(patch).length > 1) {
          const { error: updateError } = await (client as any)
            .from('artist_leads')
            .update(patch)
            .eq('id', existing.id)
            .eq('artist_user_id', artistUserId);

          if (updateError) {
            console.error('[CRM] captureCrmContacts update failed', updateError);
          }
        }
        continue;
      }

      const { error: insertError } = await (client as any).from('artist_leads').insert({
        artist_user_id: artistUserId,
        contact_name: name,
        contact_email: email,
        contact_phone: phone,
        notes,
        source,
        stage: 'interested',
        is_lead: false,
        intel: {},
      });

      if (insertError) {
        console.error('[CRM] captureCrmContacts insert failed', insertError);
      }
    }

    console.log('[CRM] captureCrmContacts finished', { count: valid.length });
  } catch (err) {
    console.error('[CRM] captureCrmContacts failed', err);
  }
}

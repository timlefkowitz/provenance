/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { insertProvenanceEventForOperations } from '~/lib/operations/operations-provenance';
import { resolveCounterparty } from '~/lib/operations/resolve-counterparty';

const locType = z.enum(['storage', 'exhibition', 'loan', 'on_display', 'transport', 'studio']);
const locStatus = z.enum(['current', 'historical']);

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  location_type: locType.optional(),
  location_name: z.string().max(2000).optional().or(z.literal('')),
  room: z.string().max(500).optional().or(z.literal('')),
  shelf: z.string().max(500).optional().or(z.literal('')),
  crate_label: z.string().max(500).optional().or(z.literal('')),
  custodian_name: z.string().max(500).optional().or(z.literal('')),
  custodian_email: z.union([z.literal(''), z.string().email()]).optional(),
  moved_at: z.string().optional().or(z.literal('')),
  status: locStatus.optional(),
  notes: z.string().max(20000).optional().or(z.literal('')),
});

const updateSchema = createSchema
  .extend({ id: z.string().uuid() })
  .partial()
  .required({ id: true });

async function assertArtworkOwned(client: any, userId: string, artworkId: string) {
  const { data, error } = await client
    .from('artworks')
    .select('id')
    .eq('id', artworkId)
    .eq('account_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Operations/artwork-locations] assertArtworkOwned', error);
  }
  return Boolean(data);
}

type PriorC = { custodian_email: string | null; custodian_user_id: string | null };

async function applyCustodian(
  client: any,
  ownerId: string,
  locId: string,
  artworkId: string,
  email: string | null,
  prior: PriorC | null,
) {
  const p = prior ?? { custodian_email: null, custodian_user_id: null };
  const { data: art } = await client.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  const title = (art as { title?: string } | null)?.title?.trim() || 'Artwork';
  const r = await resolveCounterparty({
    email,
    role: 'custodian',
    recordKind: 'inventory_location',
    recordId: locId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.custodian_email,
    priorLinkedUserId: p.custodian_user_id,
  });
  const { error } = await client
    .from('artwork_locations')
    .update({ custodian_user_id: r.userId })
    .eq('id', locId)
    .eq('account_id', ownerId);
  if (error) {
    console.error('[Operations/artwork-locations] update custodian_user_id', error);
  }
  return { ...r, artworkTitle: title };
}

async function insertLocationProvenance(
  userId: string,
  artworkId: string,
  locId: string,
  locType: string,
  locName: string | null,
) {
  await insertProvenanceEventForOperations({
    artworkId,
    eventType: 'artwork_location_updated',
    actorAccountId: userId,
    metadata: {
      artwork_location_id: locId,
      location_type: locType,
      location_name: locName,
    },
  });
  console.log('[Operations/artwork-locations] provenance artwork_location_updated', locId);
}

export async function createArtworkLocation(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/artwork-locations] create');
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid data.' };
  }
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  if (!(await assertArtworkOwned(client, user.id, parsed.data.artwork_id))) {
    return { success: false as const, error: 'Artwork not in your collection.' };
  }
  const d = parsed.data;
  const row: Record<string, unknown> = {
    account_id: user.id,
    artwork_id: d.artwork_id,
    location_type: d.location_type ?? 'storage',
    location_name: d.location_name || null,
    room: d.room || null,
    shelf: d.shelf || null,
    crate_label: d.crate_label || null,
    custodian_name: d.custodian_name || null,
    custodian_email: d.custodian_email || null,
    moved_at: d.moved_at || null,
    status: (d.status ?? 'current') as 'current' | 'historical',
    notes: d.notes || null,
  };
  const { data, error } = await client.from('artwork_locations').insert(row).select('id').single();
  if (error) {
    console.error('[Operations/artwork-locations] insert', error);
    return { success: false as const, error: 'Could not create.' };
  }
  await applyCustodian(
    client,
    user.id,
    data.id as string,
    d.artwork_id,
    row.custodian_email as string | null,
    null,
  );
  await insertLocationProvenance(
    user.id,
    d.artwork_id,
    data.id as string,
    row.location_type as string,
    (row.location_name as string) ?? null,
  );
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateArtworkLocation(raw: z.infer<typeof updateSchema>) {
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false as const, error: 'Invalid update.' };
  }
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { id, ...rest } = parsed.data;
  if (rest.artwork_id) {
    if (!(await assertArtworkOwned(client, user.id, rest.artwork_id))) {
      return { success: false as const, error: 'Artwork not in your collection.' };
    }
  }
  const { data: prior, error: pErr } = await client
    .from('artwork_locations')
    .select('id, artwork_id, location_type, location_name, custodian_email, custodian_user_id')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (pErr) {
    console.error('[Operations/artwork-locations] load prior', pErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Not found.' };
  }
  const p0 = prior as Record<string, string | null | undefined>;
  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.location_type !== undefined) patch.location_type = rest.location_type;
  if (rest.location_name !== undefined) patch.location_name = rest.location_name || null;
  if (rest.room !== undefined) patch.room = rest.room || null;
  if (rest.shelf !== undefined) patch.shelf = rest.shelf || null;
  if (rest.crate_label !== undefined) patch.crate_label = rest.crate_label || null;
  if (rest.custodian_name !== undefined) patch.custodian_name = rest.custodian_name || null;
  if (rest.custodian_email !== undefined) patch.custodian_email = rest.custodian_email || null;
  if (rest.moved_at !== undefined) patch.moved_at = rest.moved_at || null;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.notes !== undefined) patch.notes = rest.notes || null;

  const { error: uErr } = await client
    .from('artwork_locations')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/artwork-locations] update', uErr);
    return { success: false as const, error: 'Could not update.' };
  }

  const newEmail =
    rest.custodian_email !== undefined ? (rest.custodian_email || null) : (p0.custodian_email ?? null);
  const artId = (rest.artwork_id as string) ?? (p0.artwork_id as string);
  if (artId) {
    await applyCustodian(client, user.id, id, artId, newEmail, {
      custodian_email: p0.custodian_email ?? null,
      custodian_user_id: p0.custodian_user_id ?? null,
    });
  }
  const finalType = (rest.location_type as string) ?? (p0.location_type as string);
  const finalName = rest.location_name !== undefined ? rest.location_name || null : (p0.location_name ?? null);
  if (artId) {
    await insertLocationProvenance(user.id, artId, id, finalType, finalName);
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteArtworkLocation(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await client
    .from('artwork_locations')
    .delete()
    .eq('id', id)
    .eq('account_id', user.id);
  if (error) {
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

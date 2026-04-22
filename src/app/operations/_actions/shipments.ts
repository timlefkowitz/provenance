/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { insertProvenanceEventForOperations } from '~/lib/operations/operations-provenance';
import {
  notifyCounterpartyStatusActive,
  resolveCounterparty,
} from '~/lib/operations/resolve-counterparty';

const shipmentStatus = z.enum(['draft', 'booked', 'in_transit', 'delivered', 'cancelled']);

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  courier_name: z.string().min(1).max(500),
  courier_contact_email: z.union([z.literal(''), z.string().email()]).optional(),
  origin_location: z.string().max(2000).optional().or(z.literal('')),
  destination_location: z.string().max(2000).optional().or(z.literal('')),
  ship_date: z.string().optional().or(z.literal('')),
  estimated_arrival: z.string().optional().or(z.literal('')),
  actual_arrival: z.string().optional().or(z.literal('')),
  tracking_number: z.string().max(500).optional().or(z.literal('')),
  transit_insurance_policy: z.string().max(2000).optional().or(z.literal('')),
  transit_insurance_value_cents: z.coerce.number().int().min(0).optional().nullable(),
  crating_notes: z.string().max(20000).optional().or(z.literal('')),
  document_storage_path: z.string().max(2000).optional().nullable(),
  status: shipmentStatus.optional(),
});

const updateSchema = createSchema
  .extend({
    id: z.string().uuid(),
    status: shipmentStatus.optional(),
  })
  .partial()
  .required({ id: true });

async function assertArtworkOwned(
  client: unknown,
  userId: string,
  artworkId: string,
): Promise<boolean> {
  const { data, error } = await (client as any)
    .from('artworks')
    .select('id')
    .eq('id', artworkId)
    .eq('account_id', userId)
    .maybeSingle();
  if (error) {
    console.error('[Operations/shipments] assertArtworkOwned', error);
  }
  return Boolean(data);
}

type PriorCourier = {
  courier_contact_email: string | null;
  courier_user_id: string | null;
};

async function applyShipmentCounterparty(
  client: any,
  ownerId: string,
  shipmentId: string,
  artworkId: string,
  email: string | null,
  prior: PriorCourier | null,
) {
  const p = prior ?? { courier_contact_email: null, courier_user_id: null };
  const { data: art } = await client.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  const title = (art as { title?: string } | null)?.title?.trim() || 'Artwork';
  const r = await resolveCounterparty({
    email,
    role: 'courier',
    recordKind: 'shipment',
    recordId: shipmentId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.courier_contact_email,
    priorLinkedUserId: p.courier_user_id,
  });
  const { error } = await client
    .from('artwork_shipments')
    .update({ courier_user_id: r.userId })
    .eq('id', shipmentId)
    .eq('account_id', ownerId);
  if (error) {
    console.error('[Operations/shipments] update courier_user_id', error);
  }
  return { ...r, artworkTitle: title };
}

export async function createShipment(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/shipments] createShipment started');
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/shipments] validation', parsed.error.flatten());
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
  const row: Record<string, unknown> = {
    account_id: user.id,
    artwork_id: parsed.data.artwork_id,
    courier_name: parsed.data.courier_name,
    courier_contact_email: parsed.data.courier_contact_email || null,
    origin_location: parsed.data.origin_location || null,
    destination_location: parsed.data.destination_location || null,
    ship_date: parsed.data.ship_date || null,
    estimated_arrival: parsed.data.estimated_arrival || null,
    actual_arrival: parsed.data.actual_arrival || null,
    tracking_number: parsed.data.tracking_number || null,
    transit_insurance_policy: parsed.data.transit_insurance_policy || null,
    transit_insurance_value_cents: parsed.data.transit_insurance_value_cents ?? null,
    crating_notes: parsed.data.crating_notes || null,
    document_storage_path: parsed.data.document_storage_path ?? null,
    status: (parsed.data.status ?? 'draft') as 'draft' | 'booked' | 'in_transit' | 'delivered' | 'cancelled',
  };
  const { data, error } = await client
    .from('artwork_shipments')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    console.error('[Operations/shipments] insert', error);
    return { success: false as const, error: 'Could not create shipment.' };
  }
  const ap = await applyShipmentCounterparty(
    client,
    user.id,
    data.id as string,
    parsed.data.artwork_id,
    row.courier_contact_email as string | null,
    null,
  );
  if (row.status === 'in_transit') {
    const { data: cRow } = await client
      .from('artwork_shipments')
      .select('courier_user_id')
      .eq('id', data.id)
      .eq('account_id', user.id)
      .maybeSingle();
    const cid = (cRow as { courier_user_id?: string } | null)?.courier_user_id ?? ap.userId;
    await notifyCounterpartyStatusActive({
      kind: 'shipment',
      counterpartyUserId: cid ?? null,
      ownerAccountId: user.id,
      recordId: data.id as string,
      artworkId: parsed.data.artwork_id,
      artworkTitle: ap.artworkTitle,
      milestone: 'in_transit',
    });
    await insertProvenanceEventForOperations({
      artworkId: parsed.data.artwork_id,
      eventType: 'artwork_shipped',
      actorAccountId: user.id,
      metadata: { shipment_id: data.id, tracking_number: row.tracking_number },
    });
  }
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateShipment(raw: z.infer<typeof updateSchema>) {
  console.log('[Operations/shipments] update', raw.id);
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
    .from('artwork_shipments')
    .select(
      'id, status, artwork_id, courier_name, courier_contact_email, courier_user_id',
    )
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (pErr) {
    console.error('[Operations/shipments] load prior', pErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Shipment not found.' };
  }
  const p0 = prior as {
    status?: string;
    artwork_id?: string;
    courier_contact_email?: string | null;
    courier_user_id?: string | null;
  };
  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.courier_name !== undefined) patch.courier_name = rest.courier_name;
  if (rest.courier_contact_email !== undefined) {
    patch.courier_contact_email = rest.courier_contact_email || null;
  }
  if (rest.origin_location !== undefined) patch.origin_location = rest.origin_location || null;
  if (rest.destination_location !== undefined) {
    patch.destination_location = rest.destination_location || null;
  }
  if (rest.ship_date !== undefined) patch.ship_date = rest.ship_date || null;
  if (rest.estimated_arrival !== undefined) {
    patch.estimated_arrival = rest.estimated_arrival || null;
  }
  if (rest.actual_arrival !== undefined) patch.actual_arrival = rest.actual_arrival || null;
  if (rest.tracking_number !== undefined) patch.tracking_number = rest.tracking_number || null;
  if (rest.transit_insurance_policy !== undefined) {
    patch.transit_insurance_policy = rest.transit_insurance_policy || null;
  }
  if (rest.transit_insurance_value_cents !== undefined) {
    patch.transit_insurance_value_cents = rest.transit_insurance_value_cents;
  }
  if (rest.crating_notes !== undefined) patch.crating_notes = rest.crating_notes || null;
  if (rest.document_storage_path !== undefined) {
    patch.document_storage_path = rest.document_storage_path ?? null;
  }
  if (rest.status !== undefined) patch.status = rest.status;

  const { error: uErr } = await client
    .from('artwork_shipments')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/shipments] update', uErr);
    return { success: false as const, error: 'Could not update shipment.' };
  }

  const newEmail =
    rest.courier_contact_email !== undefined
      ? (rest.courier_contact_email || null)
      : (p0.courier_contact_email ?? null);
  const artId = (rest.artwork_id as string | undefined) ?? p0.artwork_id;
  const newStatus = rest.status !== undefined ? rest.status : p0.status;
  const oldStatus = p0.status;
  if (artId) {
    const info = await applyShipmentCounterparty(client, user.id, id, artId, newEmail, {
      courier_contact_email: p0.courier_contact_email ?? null,
      courier_user_id: p0.courier_user_id ?? null,
    });
    if (newStatus === 'in_transit' && oldStatus && oldStatus !== 'in_transit') {
      const { data: cRow } = await client
        .from('artwork_shipments')
        .select('courier_user_id')
        .eq('id', id)
        .eq('account_id', user.id)
        .maybeSingle();
      const cid = (cRow as { courier_user_id?: string } | null)?.courier_user_id ?? info.userId;
      await notifyCounterpartyStatusActive({
        kind: 'shipment',
        counterpartyUserId: cid ?? null,
        ownerAccountId: user.id,
        recordId: id,
        artworkId: artId,
        artworkTitle: info.artworkTitle,
        milestone: 'in_transit',
      });
      await insertProvenanceEventForOperations({
        artworkId: artId,
        eventType: 'artwork_shipped',
        actorAccountId: user.id,
        metadata: { shipment_id: id, tracking_number: rest.tracking_number ?? null },
      });
    }
  }
  if (artId && newStatus === 'delivered' && oldStatus && oldStatus !== 'delivered') {
    await insertProvenanceEventForOperations({
      artworkId: artId,
      eventType: 'artwork_received',
      actorAccountId: user.id,
      metadata: { shipment_id: id, prior_status: oldStatus },
    });
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteShipment(sid: string) {
  console.log('[Operations/shipments] delete', sid);
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await client
    .from('artwork_shipments')
    .delete()
    .eq('id', sid)
    .eq('account_id', user.id);
  if (error) {
    console.error('[Operations/shipments] delete', error);
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateShipment(sid: string) {
  console.log('[Operations/shipments] duplicate', sid);
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { data: row, error } = await client
    .from('artwork_shipments')
    .select('*')
    .eq('id', sid)
    .eq('account_id', user.id)
    .maybeSingle();
  if (error || !row) {
    return { success: false as const, error: 'Not found.' };
  }
  const { data: created, error: ins } = await client
    .from('artwork_shipments')
    .insert({
      account_id: user.id,
      artwork_id: row.artwork_id,
      courier_name: row.courier_name,
      courier_contact_email: row.courier_contact_email,
      origin_location: row.origin_location,
      destination_location: row.destination_location,
      ship_date: null,
      estimated_arrival: null,
      actual_arrival: null,
      tracking_number: null,
      transit_insurance_policy: row.transit_insurance_policy,
      transit_insurance_value_cents: row.transit_insurance_value_cents,
      crating_notes: row.crating_notes,
      status: 'draft',
      document_storage_path: null,
      alert_sent_at: null,
    })
    .select('id')
    .single();
  if (ins) {
    console.error('[Operations/shipments] duplicate insert', ins);
    return { success: false as const, error: 'Could not duplicate.' };
  }
  await applyShipmentCounterparty(
    client,
    user.id,
    created.id as string,
    row.artwork_id as string,
    row.courier_contact_email as string | null,
    null,
  );
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}

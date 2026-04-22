/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { insertProvenanceEventForOperations } from '~/lib/operations/operations-provenance';

const consignmentStatus = z.enum(['draft', 'active', 'expired', 'returned', 'sold']);

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  consignee_name: z.string().min(1).max(500),
  consignee_email: z.union([z.literal(''), z.string().email()]).optional(),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  commission_rate_bps: z.number().int().min(0).max(100_000).optional().nullable(),
  reserve_price_cents: z.coerce.number().int().min(0).optional().nullable(),
  terms_text: z.string().max(20000).optional(),
  notes: z.string().max(20000).optional(),
});

const updateSchema = createSchema
  .extend({
    id: z.string().uuid(),
    status: consignmentStatus.optional(),
    sale_price_cents: z.coerce.number().int().min(0).optional().nullable(),
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
    console.error('[Operations/consignments] assertArtworkOwned failed', error);
    return false;
  }
  return Boolean(data);
}

export async function createConsignment(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/consignments] createConsignment started');
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/consignments] validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid consignment data.' };
  }
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const ok = await assertArtworkOwned(client, user.id, parsed.data.artwork_id);
  if (!ok) {
    return { success: false as const, error: 'Artwork not found or not in your collection.' };
  }
  const row = {
    account_id: user.id,
    artwork_id: parsed.data.artwork_id,
    consignee_name: parsed.data.consignee_name,
    consignee_email: parsed.data.consignee_email || null,
    start_date: parsed.data.start_date || null,
    end_date: parsed.data.end_date || null,
    commission_rate_bps: parsed.data.commission_rate_bps ?? null,
    reserve_price_cents: parsed.data.reserve_price_cents ?? null,
    terms_text: parsed.data.terms_text ?? null,
    notes: parsed.data.notes ?? null,
    status: 'draft' as const,
  };
  const { data, error } = await (client as any)
    .from('consignments')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    console.error('[Operations/consignments] insert failed', error);
    return { success: false as const, error: 'Could not save consignment.' };
  }
  console.log('[Operations/consignments] create success', data?.id);
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateConsignment(raw: z.infer<typeof updateSchema>) {
  console.log('[Operations/consignments] updateConsignment started', raw.id);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/consignments] update validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid update.' };
  }
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { id, ...rest } = parsed.data;
  if (rest.artwork_id) {
    const aok = await assertArtworkOwned(client, user.id, rest.artwork_id);
    if (!aok) {
      return { success: false as const, error: 'Artwork not found or not in your collection.' };
    }
  }

  const { data: prior, error: priorErr } = await (client as any)
    .from('consignments')
    .select('id, status, artwork_id, consignee_name, end_date')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (priorErr) {
    console.error('[Operations/consignments] load prior failed', priorErr);
  }

  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.consignee_name !== undefined) patch.consignee_name = rest.consignee_name;
  if (rest.consignee_email !== undefined) patch.consignee_email = rest.consignee_email || null;
  if (rest.start_date !== undefined) patch.start_date = rest.start_date || null;
  if (rest.end_date !== undefined) patch.end_date = rest.end_date || null;
  if (rest.commission_rate_bps !== undefined) patch.commission_rate_bps = rest.commission_rate_bps;
  if (rest.reserve_price_cents !== undefined) patch.reserve_price_cents = rest.reserve_price_cents;
  if (rest.terms_text !== undefined) patch.terms_text = rest.terms_text ?? null;
  if (rest.notes !== undefined) patch.notes = rest.notes ?? null;
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.status === 'sold') {
    if (rest.sale_price_cents == null) {
      return { success: false as const, error: 'Sale price is required to mark as sold.' };
    }
    patch.sale_price_cents = rest.sale_price_cents;
    patch.sold_at = new Date().toISOString();
  }

  const { error } = await (client as any)
    .from('consignments')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);

  if (error) {
    console.error('[Operations/consignments] update failed', error);
    return { success: false as const, error: 'Could not update consignment.' };
  }

  const newStatus = rest.status !== undefined ? rest.status : (prior?.status as string);
  const oldStatus = prior?.status as string | undefined;
  const artId = (rest.artwork_id as string | undefined) ?? (prior?.artwork_id as string);
  if (artId && newStatus === 'active' && oldStatus && oldStatus !== 'active') {
    await insertProvenanceEventForOperations({
      artworkId: artId,
      eventType: 'consignment_active',
      actorAccountId: user.id,
      metadata: {
        consignment_id: id,
        consignee_name: rest.consignee_name ?? prior?.consignee_name,
        end_date: (rest as { end_date?: string | null }).end_date ?? prior?.end_date,
      },
    });
  }
  if (artId && newStatus === 'returned' && oldStatus && oldStatus !== 'returned') {
    await insertProvenanceEventForOperations({
      artworkId: artId,
      eventType: 'consignment_returned',
      actorAccountId: user.id,
      metadata: { consignment_id: id },
    });
  }
  if (artId && newStatus === 'sold' && oldStatus && oldStatus !== 'sold') {
    const saleCents = rest.sale_price_cents ?? 0;
    await insertProvenanceEventForOperations({
      artworkId: artId,
      eventType: 'ownership_transfer',
      actorAccountId: user.id,
      metadata: {
        consignment_id: id,
        sale_price_cents: saleCents,
        kind: 'consignment_sale',
        consignee_name: rest.consignee_name ?? prior?.consignee_name,
      },
    });
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateConsignment(consignmentId: string) {
  console.log('[Operations/consignments] duplicate', consignmentId);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { data: row, error } = await (client as any)
    .from('consignments')
    .select('*')
    .eq('id', consignmentId)
    .eq('account_id', user.id)
    .maybeSingle();
  if (error || !row) {
    return { success: false as const, error: 'Consignment not found.' };
  }
  const insert = {
    account_id: user.id,
    artwork_id: row.artwork_id,
    consignee_name: row.consignee_name,
    consignee_email: row.consignee_email,
    start_date: row.start_date,
    end_date: row.end_date,
    commission_rate_bps: row.commission_rate_bps,
    reserve_price_cents: row.reserve_price_cents,
    terms_text: row.terms_text,
    notes: row.notes,
    status: 'draft',
    document_storage_path: null,
    sold_at: null,
    sale_price_cents: null,
    alert_sent_at: null,
  };
  const { data: created, error: ins } = await (client as any)
    .from('consignments')
    .insert(insert)
    .select('id')
    .single();
  if (ins) {
    console.error('[Operations/consignments] duplicate insert', ins);
    return { success: false as const, error: 'Could not duplicate.' };
  }
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}

export async function deleteConsignment(consignmentId: string) {
  console.log('[Operations/consignments] delete', consignmentId);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await (client as any)
    .from('consignments')
    .delete()
    .eq('id', consignmentId)
    .eq('account_id', user.id);
  if (error) {
    console.error('[Operations/consignments] delete', error);
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

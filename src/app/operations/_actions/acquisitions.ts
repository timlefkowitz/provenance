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

const acqType = z.enum(['purchase', 'gift', 'bequest', 'exchange', 'transfer']);
const legal = z.enum(['clear', 'under_review', 'encumbered']);
const acqStatus = z.enum(['under_review', 'approved', 'accessioned', 'deaccessioned']);

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  acquisition_type: acqType,
  seller_name: z.string().min(1).max(500),
  seller_email: z.union([z.literal(''), z.string().email()]).optional(),
  acquisition_price_cents: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().min(1).max(3).optional(),
  acquisition_date: z.string().optional().or(z.literal('')),
  provenance_notes: z.string().max(20000).optional().or(z.literal('')),
  accession_number: z.string().max(200).optional().or(z.literal('')),
  legal_status: legal,
  fund_source: z.string().max(2000).optional().or(z.literal('')),
  document_storage_path: z.string().max(2000).optional().nullable(),
  status: acqStatus.optional(),
});

const updateSchema = createSchema
  .extend({ id: z.string().uuid(), status: acqStatus.optional() })
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
    console.error('[Operations/acquisitions] assertArtworkOwned', error);
  }
  return Boolean(data);
}

type PriorS = { seller_email: string | null; seller_user_id: string | null };

async function applySeller(
  client: any,
  ownerId: string,
  acqId: string,
  artworkId: string,
  email: string | null,
  prior: PriorS | null,
) {
  const p = prior ?? { seller_email: null, seller_user_id: null };
  const { data: art } = await client.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  const title = (art as { title?: string } | null)?.title?.trim() || 'Artwork';
  const r = await resolveCounterparty({
    email,
    role: 'seller',
    recordKind: 'acquisition',
    recordId: acqId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.seller_email,
    priorLinkedUserId: p.seller_user_id,
  });
  const { error } = await client
    .from('acquisitions')
    .update({ seller_user_id: r.userId })
    .eq('id', acqId)
    .eq('account_id', ownerId);
  if (error) {
    console.error('[Operations/acquisitions] update seller_user_id', error);
  }
  return { ...r, artworkTitle: title };
}

export async function createAcquisition(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/acquisitions] create');
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
    acquisition_type: d.acquisition_type,
    seller_name: d.seller_name,
    seller_email: d.seller_email || null,
    acquisition_price_cents: d.acquisition_price_cents ?? null,
    currency: d.currency || 'USD',
    acquisition_date: d.acquisition_date || null,
    provenance_notes: d.provenance_notes || null,
    accession_number: d.accession_number || null,
    legal_status: d.legal_status,
    fund_source: d.fund_source || null,
    document_storage_path: d.document_storage_path ?? null,
    status: (d.status ?? 'under_review') as
      | 'under_review'
      | 'approved'
      | 'accessioned'
      | 'deaccessioned',
  };
  const { data, error } = await client.from('acquisitions').insert(row).select('id').single();
  if (error) {
    console.error('[Operations/acquisitions] insert', error);
    return { success: false as const, error: 'Could not create.' };
  }
  const ap = await applySeller(
    client,
    user.id,
    data.id as string,
    d.artwork_id,
    row.seller_email as string | null,
    null,
  );
  if (row.status === 'accessioned') {
    const { data: cRow } = await client
      .from('acquisitions')
      .select('seller_user_id')
      .eq('id', data.id)
      .eq('account_id', user.id)
      .maybeSingle();
    const sid = (cRow as { seller_user_id?: string } | null)?.seller_user_id ?? ap.userId;
    await notifyCounterpartyStatusActive({
      kind: 'acquisition',
      counterpartyUserId: sid ?? null,
      ownerAccountId: user.id,
      recordId: data.id as string,
      artworkId: d.artwork_id,
      artworkTitle: ap.artworkTitle,
      milestone: 'accessioned',
    });
    await insertProvenanceEventForOperations({
      artworkId: d.artwork_id,
      eventType: 'artwork_accessioned',
      actorAccountId: user.id,
      metadata: { acquisition_id: data.id, accession_number: d.accession_number },
    });
  }
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateAcquisition(raw: z.infer<typeof updateSchema>) {
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
    .from('acquisitions')
    .select('id, status, artwork_id, seller_name, seller_email, seller_user_id')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (pErr) {
    console.error('[Operations/acquisitions] load prior', pErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Not found.' };
  }
  const p0 = prior as Record<string, string | null | undefined>;
  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.acquisition_type !== undefined) patch.acquisition_type = rest.acquisition_type;
  if (rest.seller_name !== undefined) patch.seller_name = rest.seller_name;
  if (rest.seller_email !== undefined) patch.seller_email = rest.seller_email || null;
  if (rest.acquisition_price_cents !== undefined) {
    patch.acquisition_price_cents = rest.acquisition_price_cents;
  }
  if (rest.currency !== undefined) patch.currency = rest.currency;
  if (rest.acquisition_date !== undefined) patch.acquisition_date = rest.acquisition_date || null;
  if (rest.provenance_notes !== undefined) patch.provenance_notes = rest.provenance_notes || null;
  if (rest.accession_number !== undefined) patch.accession_number = rest.accession_number || null;
  if (rest.legal_status !== undefined) patch.legal_status = rest.legal_status;
  if (rest.fund_source !== undefined) patch.fund_source = rest.fund_source || null;
  if (rest.document_storage_path !== undefined) {
    patch.document_storage_path = rest.document_storage_path ?? null;
  }
  if (rest.status !== undefined) patch.status = rest.status;

  const { error: uErr } = await client
    .from('acquisitions')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/acquisitions] update', uErr);
    return { success: false as const, error: 'Could not update.' };
  }

  const newEmail = rest.seller_email !== undefined ? (rest.seller_email || null) : (p0.seller_email ?? null);
  const artId = (rest.artwork_id as string) ?? (p0.artwork_id as string);
  const newStatus = rest.status !== undefined ? rest.status : p0.status;
  const oldStatus = p0.status;
  if (artId) {
    const info = await applySeller(client, user.id, id, artId, newEmail, {
      seller_email: p0.seller_email ?? null,
      seller_user_id: p0.seller_user_id ?? null,
    });
    if (newStatus === 'accessioned' && oldStatus && oldStatus !== 'accessioned') {
      const { data: cRow } = await client
        .from('acquisitions')
        .select('seller_user_id')
        .eq('id', id)
        .maybeSingle();
      const sid = (cRow as { seller_user_id?: string } | null)?.seller_user_id ?? info.userId;
      await notifyCounterpartyStatusActive({
        kind: 'acquisition',
        counterpartyUserId: sid ?? null,
        ownerAccountId: user.id,
        recordId: id,
        artworkId: artId,
        artworkTitle: info.artworkTitle,
        milestone: 'accessioned',
      });
      await insertProvenanceEventForOperations({
        artworkId: artId,
        eventType: 'artwork_accessioned',
        actorAccountId: user.id,
        metadata: {
          acquisition_id: id,
          accession_number: rest.accession_number ?? p0.accession_number,
        },
      });
    }
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteAcquisition(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await client
    .from('acquisitions')
    .delete()
    .eq('id', id)
    .eq('account_id', user.id);
  if (error) {
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateAcquisition(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { data: row, error } = await client
    .from('acquisitions')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (error || !row) {
    return { success: false as const, error: 'Not found.' };
  }
  const { data: created, error: ins } = await client
    .from('acquisitions')
    .insert({
      account_id: user.id,
      artwork_id: row.artwork_id,
      acquisition_type: row.acquisition_type,
      seller_name: row.seller_name,
      seller_email: row.seller_email,
      acquisition_price_cents: row.acquisition_price_cents,
      currency: row.currency,
      acquisition_date: null,
      provenance_notes: row.provenance_notes,
      accession_number: null,
      legal_status: 'under_review' as const,
      fund_source: row.fund_source,
      status: 'under_review' as const,
      document_storage_path: null,
    })
    .select('id')
    .single();
  if (ins) {
    return { success: false as const, error: 'Could not duplicate.' };
  }
  await applySeller(
    client,
    user.id,
    created.id as string,
    row.artwork_id as string,
    row.seller_email as string | null,
    null,
  );
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}

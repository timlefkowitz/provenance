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

const insStatus = z.enum(['active', 'expired', 'pending', 'cancelled']);

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  policy_number: z.string().max(200).optional().or(z.literal('')),
  insurer_name: z.string().min(1).max(500),
  insurer_contact_email: z.union([z.literal(''), z.string().email()]).optional(),
  coverage_amount_cents: z.coerce.number().int().min(0).optional().nullable(),
  currency: z.string().min(1).max(3).optional(),
  appraiser_name: z.string().max(500).optional().or(z.literal('')),
  appraiser_email: z.union([z.literal(''), z.string().email()]).optional(),
  appraisal_date: z.string().optional().or(z.literal('')),
  policy_start_date: z.string().optional().or(z.literal('')),
  policy_end_date: z.string().optional().or(z.literal('')),
  valuation_notes: z.string().max(20000).optional().or(z.literal('')),
  document_storage_path: z.string().max(2000).optional().nullable(),
  status: insStatus.optional(),
});

const updateSchema = createSchema
  .extend({ id: z.string().uuid(), status: insStatus.optional() })
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
    console.error('[Operations/insurance] assertArtworkOwned', error);
  }
  return Boolean(data);
}

type PriorI = {
  insurer_contact_email: string | null;
  insurer_user_id: string | null;
  appraiser_email: string | null;
  appraiser_user_id: string | null;
};

async function applyInsuranceCounterparties(
  client: any,
  ownerId: string,
  rowId: string,
  artworkId: string,
  insEmail: string | null,
  apEmail: string | null,
  prior: PriorI | null,
) {
  const p: PriorI =
    prior ?? {
      insurer_contact_email: null,
      insurer_user_id: null,
      appraiser_email: null,
      appraiser_user_id: null,
    };
  const { data: art } = await client.from('artworks').select('title').eq('id', artworkId).maybeSingle();
  const title = (art as { title?: string } | null)?.title?.trim() || 'Artwork';

  const a = await resolveCounterparty({
    email: insEmail,
    role: 'insurer',
    recordKind: 'insurance',
    recordId: rowId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.insurer_contact_email,
    priorLinkedUserId: p.insurer_user_id,
  });
  const b = await resolveCounterparty({
    email: apEmail,
    role: 'appraiser',
    recordKind: 'insurance',
    recordId: rowId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.appraiser_email,
    priorLinkedUserId: p.appraiser_user_id,
  });
  const { error } = await client
    .from('insurance_valuations')
    .update({ insurer_user_id: a.userId, appraiser_user_id: b.userId })
    .eq('id', rowId)
    .eq('account_id', ownerId);
  if (error) {
    console.error('[Operations/insurance] update user ids', error);
  }
  return { artworkTitle: title, insurerUserId: a.userId, appraiserUserId: b.userId };
}

export async function createInsuranceValuation(raw: z.infer<typeof createSchema>) {
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
    policy_number: d.policy_number || null,
    insurer_name: d.insurer_name,
    insurer_contact_email: d.insurer_contact_email || null,
    coverage_amount_cents: d.coverage_amount_cents ?? null,
    currency: d.currency || 'USD',
    appraiser_name: d.appraiser_name || null,
    appraiser_email: d.appraiser_email || null,
    appraisal_date: d.appraisal_date || null,
    policy_start_date: d.policy_start_date || null,
    policy_end_date: d.policy_end_date || null,
    valuation_notes: d.valuation_notes || null,
    document_storage_path: d.document_storage_path ?? null,
    status: (d.status ?? 'pending') as 'active' | 'expired' | 'pending' | 'cancelled',
  };
  const { data, error } = await client
    .from('insurance_valuations')
    .insert(row)
    .select('id')
    .single();
  if (error) {
    console.error('[Operations/insurance] insert', error);
    return { success: false as const, error: 'Could not create record.' };
  }
  const ap = await applyInsuranceCounterparties(
    client,
    user.id,
    data.id as string,
    d.artwork_id,
    row.insurer_contact_email as string | null,
    row.appraiser_email as string | null,
    null,
  );
  if (row.status === 'active') {
    const { data: cRow } = await client
      .from('insurance_valuations')
      .select('insurer_user_id')
      .eq('id', data.id)
      .eq('account_id', user.id)
      .maybeSingle();
    const iid = (cRow as { insurer_user_id?: string } | null)?.insurer_user_id ?? ap.insurerUserId;
    await notifyCounterpartyStatusActive({
      kind: 'insurance',
      counterpartyUserId: iid ?? null,
      ownerAccountId: user.id,
      recordId: data.id as string,
      artworkId: d.artwork_id,
      artworkTitle: ap.artworkTitle,
      milestone: 'active',
    });
    await insertProvenanceEventForOperations({
      artworkId: d.artwork_id,
      eventType: 'insurance_active',
      actorAccountId: user.id,
      metadata: { insurance_valuation_id: data.id, policy_number: d.policy_number },
    });
  }
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateInsuranceValuation(raw: z.infer<typeof updateSchema>) {
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
    .from('insurance_valuations')
    .select(
      'id, status, artwork_id, insurer_name, insurer_contact_email, insurer_user_id, appraiser_name, appraiser_email, appraiser_user_id',
    )
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (pErr) {
    console.error('[Operations/insurance] load prior', pErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Not found.' };
  }
  const p0 = prior as Record<string, string | null | undefined>;
  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.policy_number !== undefined) patch.policy_number = rest.policy_number || null;
  if (rest.insurer_name !== undefined) patch.insurer_name = rest.insurer_name;
  if (rest.insurer_contact_email !== undefined) {
    patch.insurer_contact_email = rest.insurer_contact_email || null;
  }
  if (rest.coverage_amount_cents !== undefined) patch.coverage_amount_cents = rest.coverage_amount_cents;
  if (rest.currency !== undefined) patch.currency = rest.currency;
  if (rest.appraiser_name !== undefined) patch.appraiser_name = rest.appraiser_name || null;
  if (rest.appraiser_email !== undefined) patch.appraiser_email = rest.appraiser_email || null;
  if (rest.appraisal_date !== undefined) patch.appraisal_date = rest.appraisal_date || null;
  if (rest.policy_start_date !== undefined) patch.policy_start_date = rest.policy_start_date || null;
  if (rest.policy_end_date !== undefined) patch.policy_end_date = rest.policy_end_date || null;
  if (rest.valuation_notes !== undefined) patch.valuation_notes = rest.valuation_notes || null;
  if (rest.document_storage_path !== undefined) {
    patch.document_storage_path = rest.document_storage_path ?? null;
  }
  if (rest.status !== undefined) patch.status = rest.status;

  const { error: uErr } = await client
    .from('insurance_valuations')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (uErr) {
    console.error('[Operations/insurance] update', uErr);
    return { success: false as const, error: 'Could not update.' };
  }

  const newIns =
    rest.insurer_contact_email !== undefined
      ? (rest.insurer_contact_email || null)
      : (p0.insurer_contact_email ?? null);
  const newAp =
    rest.appraiser_email !== undefined
      ? (rest.appraiser_email || null)
      : (p0.appraiser_email ?? null);
  const artId = (rest.artwork_id as string) ?? (p0.artwork_id as string);
  const newStatus = rest.status !== undefined ? rest.status : p0.status;
  const oldStatus = p0.status;

  if (artId) {
    const info = await applyInsuranceCounterparties(
      client,
      user.id,
      id,
      artId,
      newIns,
      newAp,
      {
        insurer_contact_email: p0.insurer_contact_email ?? null,
        insurer_user_id: p0.insurer_user_id ?? null,
        appraiser_email: p0.appraiser_email ?? null,
        appraiser_user_id: p0.appraiser_user_id ?? null,
      },
    );
    if (newStatus === 'active' && oldStatus && oldStatus !== 'active') {
      const { data: cRow } = await client
        .from('insurance_valuations')
        .select('insurer_user_id')
        .eq('id', id)
        .maybeSingle();
      const iid = (cRow as { insurer_user_id?: string } | null)?.insurer_user_id ?? info.insurerUserId;
      await notifyCounterpartyStatusActive({
        kind: 'insurance',
        counterpartyUserId: iid ?? null,
        ownerAccountId: user.id,
        recordId: id,
        artworkId: artId,
        artworkTitle: info.artworkTitle,
        milestone: 'active',
      });
      await insertProvenanceEventForOperations({
        artworkId: artId,
        eventType: 'insurance_active',
        actorAccountId: user.id,
        metadata: { insurance_valuation_id: id, policy_number: rest.policy_number ?? p0.policy_number },
      });
    }
  }

  if (artId && newStatus === 'expired' && oldStatus && oldStatus !== 'expired') {
    await insertProvenanceEventForOperations({
      artworkId: artId,
      eventType: 'insurance_expired',
      actorAccountId: user.id,
      metadata: { insurance_valuation_id: id, prior_status: oldStatus },
    });
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteInsuranceValuation(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await client
    .from('insurance_valuations')
    .delete()
    .eq('id', id)
    .eq('account_id', user.id);
  if (error) {
    return { success: false as const, error: 'Could not delete.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateInsuranceValuation(id: string) {
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { data: row, error } = await client
    .from('insurance_valuations')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (error || !row) {
    return { success: false as const, error: 'Not found.' };
  }
  const { data: created, error: ins } = await client
    .from('insurance_valuations')
    .insert({
      account_id: user.id,
      artwork_id: row.artwork_id,
      policy_number: row.policy_number,
      insurer_name: row.insurer_name,
      insurer_contact_email: row.insurer_contact_email,
      coverage_amount_cents: row.coverage_amount_cents,
      currency: row.currency,
      appraiser_name: row.appraiser_name,
      appraiser_email: row.appraiser_email,
      appraisal_date: null,
      policy_start_date: null,
      policy_end_date: null,
      valuation_notes: row.valuation_notes,
      status: 'pending' as const,
      document_storage_path: null,
      alert_sent_at: null,
    })
    .select('id')
    .single();
  if (ins) {
    return { success: false as const, error: 'Could not duplicate.' };
  }
  await applyInsuranceCounterparties(
    client,
    user.id,
    created.id as string,
    row.artwork_id as string,
    row.insurer_contact_email as string | null,
    row.appraiser_email as string | null,
    null,
  );
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}

/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const loanStatus = z.enum(['draft', 'sent', 'signed', 'active', 'closed']);

const createLoanSchema = z.object({
  artwork_id: z.string().uuid(),
  borrower_name: z.string().min(1).max(500),
  borrower_email: z.union([z.literal(''), z.string().email()]).optional(),
  lender_name: z.string().max(500).optional().or(z.literal('')),
  lender_email: z.union([z.literal(''), z.string().email()]).optional(),
  start_date: z.string().optional().or(z.literal('')),
  end_date: z.string().optional().or(z.literal('')),
  terms_text: z.string().max(20000).optional(),
  conditions_text: z.string().max(20000).optional(),
  insurance_requirements_text: z.string().max(20000).optional(),
});

const updateLoanSchema = createLoanSchema
  .extend({
    id: z.string().uuid(),
    status: loanStatus.optional(),
    signature_notes: z.string().max(5000).optional(),
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
    console.error('[Operations/loans] assertArtworkOwned query failed', error);
    return false;
  }
  return Boolean(data);
}

export async function createLoanAgreement(raw: z.infer<typeof createLoanSchema>) {
  console.log('[Operations/loans] createLoanAgreement started');
  const parsed = createLoanSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/loans] createLoanAgreement validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid loan agreement data.' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    console.error('[Operations/loans] createLoanAgreement: no user');
    return { success: false as const, error: 'You must be logged in.' };
  }

  const ok = await assertArtworkOwned(client, user.id, parsed.data.artwork_id);
  if (!ok) {
    console.error('[Operations/loans] createLoanAgreement: artwork not owned', parsed.data.artwork_id);
    return { success: false as const, error: 'Artwork not found or not in your collection.' };
  }

  const row = {
    account_id: user.id,
    artwork_id: parsed.data.artwork_id,
    borrower_name: parsed.data.borrower_name,
    borrower_email: parsed.data.borrower_email || null,
    lender_name: parsed.data.lender_name || null,
    lender_email: parsed.data.lender_email || null,
    start_date: parsed.data.start_date || null,
    end_date: parsed.data.end_date || null,
    terms_text: parsed.data.terms_text ?? null,
    conditions_text: parsed.data.conditions_text ?? null,
    insurance_requirements_text: parsed.data.insurance_requirements_text ?? null,
    status: 'draft' as const,
  };

  const { data, error } = await (client as any)
    .from('artwork_loan_agreements')
    .insert(row)
    .select('id')
    .single();

  if (error) {
    console.error('[Operations/loans] createLoanAgreement insert failed', error);
    return { success: false as const, error: 'Could not save loan agreement.' };
  }

  console.log('[Operations/loans] createLoanAgreement success', data?.id);
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateLoanAgreement(raw: z.infer<typeof updateLoanSchema>) {
  console.log('[Operations/loans] updateLoanAgreement started', raw.id);
  const parsed = updateLoanSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/loans] updateLoanAgreement validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid update.' };
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    console.error('[Operations/loans] updateLoanAgreement: no user');
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { id, ...rest } = parsed.data;
  if (rest.artwork_id) {
    const ok = await assertArtworkOwned(client, user.id, rest.artwork_id);
    if (!ok) {
      return { success: false as const, error: 'Artwork not found or not in your collection.' };
    }
  }

  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.borrower_name !== undefined) patch.borrower_name = rest.borrower_name;
  if (rest.borrower_email !== undefined) patch.borrower_email = rest.borrower_email || null;
  if (rest.lender_name !== undefined) patch.lender_name = rest.lender_name || null;
  if (rest.lender_email !== undefined) patch.lender_email = rest.lender_email || null;
  if (rest.start_date !== undefined) patch.start_date = rest.start_date || null;
  if (rest.end_date !== undefined) patch.end_date = rest.end_date || null;
  if (rest.terms_text !== undefined) patch.terms_text = rest.terms_text ?? null;
  if (rest.conditions_text !== undefined) patch.conditions_text = rest.conditions_text ?? null;
  if (rest.insurance_requirements_text !== undefined) {
    patch.insurance_requirements_text = rest.insurance_requirements_text ?? null;
  }
  if (rest.status !== undefined) patch.status = rest.status;
  if (rest.signature_notes !== undefined) patch.signature_notes = rest.signature_notes ?? null;

  const { error } = await (client as any)
    .from('artwork_loan_agreements')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);

  if (error) {
    console.error('[Operations/loans] updateLoanAgreement failed', error);
    return { success: false as const, error: 'Could not update loan agreement.' };
  }

  console.log('[Operations/loans] updateLoanAgreement success', id);
  revalidatePath('/operations');
  return { success: true as const };
}

export async function duplicateLoanAgreement(id: string) {
  console.log('[Operations/loans] duplicateLoanAgreement started', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { data: row, error } = await (client as any)
    .from('artwork_loan_agreements')
    .select('*')
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();

  if (error || !row) {
    console.error('[Operations/loans] duplicateLoanAgreement load failed', error);
    return { success: false as const, error: 'Agreement not found.' };
  }

  const insert = {
    account_id: user.id,
    artwork_id: row.artwork_id,
    borrower_name: row.borrower_name,
    borrower_email: row.borrower_email,
    lender_name: row.lender_name,
    lender_email: row.lender_email,
    start_date: row.start_date,
    end_date: row.end_date,
    terms_text: row.terms_text,
    conditions_text: row.conditions_text,
    insurance_requirements_text: row.insurance_requirements_text,
    status: 'draft',
    signature_completed_at: null,
    signature_notes: null,
    document_storage_path: null,
  };

  const { data: created, error: insErr } = await (client as any)
    .from('artwork_loan_agreements')
    .insert(insert)
    .select('id')
    .single();

  if (insErr) {
    console.error('[Operations/loans] duplicateLoanAgreement insert failed', insErr);
    return { success: false as const, error: 'Could not duplicate agreement.' };
  }

  console.log('[Operations/loans] duplicateLoanAgreement success', created.id);
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}

export async function markLoanAgreementSent(id: string) {
  console.log('[Operations/loans] markLoanAgreementSent', id);
  return updateLoanAgreement({ id, status: 'sent' });
}

export async function markLoanAgreementSigned(id: string, signatureNotes?: string) {
  console.log('[Operations/loans] markLoanAgreementSigned', id);
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }

  const { error } = await (client as any)
    .from('artwork_loan_agreements')
    .update({
      status: 'signed',
      signature_completed_at: new Date().toISOString(),
      signature_notes: signatureNotes ?? null,
    })
    .eq('id', id)
    .eq('account_id', user.id);

  if (error) {
    console.error('[Operations/loans] markLoanAgreementSigned failed', error);
    return { success: false as const, error: 'Could not update status.' };
  }

  revalidatePath('/operations');
  return { success: true as const };
}

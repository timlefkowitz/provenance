/* eslint-disable @typescript-eslint/no-explicit-any -- Operations tables not in generated DB types */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { insertProvenanceEventForOperations } from '~/lib/operations/operations-provenance';
import {
  notifyCounterpartyStatusActive,
  resolveCounterparty,
} from '~/lib/operations/resolve-counterparty';

const loanStatus = z.enum(['draft', 'sent', 'signed', 'active', 'closed', 'expired']);

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

type CounterpartyPriorLoan = {
  borrower_email: string | null;
  lender_email: string | null;
  borrower_user_id: string | null;
  lender_user_id: string | null;
};

/**
 * Resolves counterparty Provenance users by email, links IDs, in-app notification or invite email.
 */
async function applyLoanCounterpartyLinks(
  client: any,
  ownerId: string,
  loanId: string,
  artworkId: string,
  currentBorrowerEmail: string | null,
  currentLenderEmail: string | null,
  prior: CounterpartyPriorLoan | null,
) {
  console.log('[Operations/loans] applyLoanCounterpartyLinks', loanId);
  const p: CounterpartyPriorLoan =
    prior ?? {
      borrower_email: null,
      lender_email: null,
      borrower_user_id: null,
      lender_user_id: null,
    };
  const { data: art, error: artErr } = await client
    .from('artworks')
    .select('title')
    .eq('id', artworkId)
    .maybeSingle();
  if (artErr) {
    console.error('[Operations/loans] load artwork for counterparty', artErr);
  }
  const title = (art as { title?: string } | null)?.title?.trim() || 'Artwork';

  const b = await resolveCounterparty({
    email: currentBorrowerEmail,
    role: 'borrower',
    recordKind: 'loan',
    recordId: loanId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.borrower_email,
    priorLinkedUserId: p.borrower_user_id,
  });
  const l = await resolveCounterparty({
    email: currentLenderEmail,
    role: 'lender',
    recordKind: 'loan',
    recordId: loanId,
    ownerAccountId: ownerId,
    artworkId,
    artworkTitle: title,
    priorEmail: p.lender_email,
    priorLinkedUserId: p.lender_user_id,
  });
  const { error: uErr } = await client
    .from('artwork_loan_agreements')
    .update({
      borrower_user_id: b.userId,
      lender_user_id: l.userId,
    })
    .eq('id', loanId)
    .eq('account_id', ownerId);
  if (uErr) {
    console.error('[Operations/loans] update counterparty user ids', uErr);
  }
  return { borrowerUserId: b.userId, lenderUserId: l.userId, artworkTitle: title, artworkId };
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

  await applyLoanCounterpartyLinks(
    client,
    user.id,
    data.id as string,
    parsed.data.artwork_id,
    row.borrower_email,
    row.lender_email,
    null,
  );
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

  const { data: prior, error: priorErr } = await (client as any)
    .from('artwork_loan_agreements')
    .select(
      'id, status, artwork_id, borrower_name, end_date, borrower_email, lender_email, borrower_user_id, lender_user_id',
    )
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (priorErr) {
    console.error('[Operations/loans] updateLoanAgreement load prior failed', priorErr);
  }
  if (!prior) {
    return { success: false as const, error: 'Loan agreement not found.' };
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

  const pRow = prior as {
    status?: string;
    artwork_id?: string;
    borrower_name?: string;
    end_date?: string | null;
    borrower_email?: string | null;
    lender_email?: string | null;
    borrower_user_id?: string | null;
    lender_user_id?: string | null;
  };
  const newBorrowerEmail =
    rest.borrower_email !== undefined ? (rest.borrower_email || null) : (pRow.borrower_email ?? null);
  const newLenderEmail =
    rest.lender_email !== undefined ? (rest.lender_email || null) : (pRow.lender_email ?? null);
  const artId = (rest.artwork_id as string | undefined) ?? pRow.artwork_id;
  const newStatus = rest.status !== undefined ? rest.status : (pRow.status as string | undefined);
  const oldStatus = pRow.status as string | undefined;

  if (artId) {
    const counterInfo = await applyLoanCounterpartyLinks(
      client,
      user.id,
      id,
      artId,
      newBorrowerEmail,
      newLenderEmail,
      {
        borrower_email: pRow.borrower_email ?? null,
        lender_email: pRow.lender_email ?? null,
        borrower_user_id: pRow.borrower_user_id ?? null,
        lender_user_id: pRow.lender_user_id ?? null,
      },
    );
    if (newStatus === 'active' && oldStatus && oldStatus !== 'active') {
      await notifyCounterpartyStatusActive({
        kind: 'loan',
        counterpartyUserId: counterInfo.borrowerUserId,
        ownerAccountId: user.id,
        recordId: id,
        artworkId: artId,
        artworkTitle: counterInfo.artworkTitle,
      });
      await insertProvenanceEventForOperations({
        artworkId: artId,
        eventType: 'loan_out',
        actorAccountId: user.id,
        metadata: {
          loan_agreement_id: id,
          borrower_name: rest.borrower_name ?? pRow?.borrower_name,
          end_date: (rest.end_date as string | null | undefined) ?? pRow?.end_date,
        },
      });
    }
  }
  if (
    artId &&
    (newStatus === 'closed' || newStatus === 'expired') &&
    oldStatus &&
    oldStatus !== 'closed' &&
    oldStatus !== 'expired'
  ) {
    await insertProvenanceEventForOperations({
      artworkId: artId,
      eventType: 'loan_return',
      actorAccountId: user.id,
      metadata: {
        loan_agreement_id: id,
        prior_status: oldStatus,
        resolved_as: newStatus,
      },
    });
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
    original_loan_id: null,
    renewal_count: 0,
    alert_sent_at: null,
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

  await applyLoanCounterpartyLinks(
    client,
    user.id,
    created.id as string,
    row.artwork_id as string,
    row.borrower_email as string | null,
    row.lender_email as string | null,
    null,
  );
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

  const { data: row2, error: load2 } = await (client as any)
    .from('artwork_loan_agreements')
    .select(
      'artwork_id, borrower_email, lender_email, borrower_user_id, lender_user_id',
    )
    .eq('id', id)
    .eq('account_id', user.id)
    .maybeSingle();
  if (load2) {
    console.error('[Operations/loans] markLoanAgreementSigned reload for counterparty', load2);
  } else if (row2?.artwork_id) {
    await applyLoanCounterpartyLinks(
      client,
      user.id,
      id,
      row2.artwork_id,
      row2.borrower_email ?? null,
      row2.lender_email ?? null,
      {
        borrower_email: row2.borrower_email ?? null,
        lender_email: row2.lender_email ?? null,
        borrower_user_id: row2.borrower_user_id ?? null,
        lender_user_id: row2.lender_user_id ?? null,
      },
    );
  }

  revalidatePath('/operations');
  return { success: true as const };
}

export async function renewLoanAgreement(id: string) {
  console.log('[Operations/loans] renewLoanAgreement started', id);
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
    console.error('[Operations/loans] renewLoanAgreement load failed', error);
    return { success: false as const, error: 'Agreement not found.' };
  }

  const parentRenewal = (row.renewal_count as number) ?? 0;
  const insert = {
    account_id: user.id,
    artwork_id: row.artwork_id,
    borrower_name: row.borrower_name,
    borrower_email: row.borrower_email,
    lender_name: row.lender_name,
    lender_email: row.lender_email,
    start_date: null,
    end_date: null,
    terms_text: row.terms_text,
    conditions_text: row.conditions_text,
    insurance_requirements_text: row.insurance_requirements_text,
    status: 'draft' as const,
    signature_completed_at: null,
    signature_notes: null,
    document_storage_path: null,
    original_loan_id: (row.original_loan_id as string | null) ?? id,
    renewal_count: parentRenewal + 1,
    alert_sent_at: null,
  };

  const { data: created, error: insErr } = await (client as any)
    .from('artwork_loan_agreements')
    .insert(insert)
    .select('id')
    .single();

  if (insErr) {
    console.error('[Operations/loans] renewLoanAgreement insert failed', insErr);
    return { success: false as const, error: 'Could not create renewal.' };
  }

  await applyLoanCounterpartyLinks(
    client,
    user.id,
    created.id as string,
    row.artwork_id as string,
    row.borrower_email as string | null,
    row.lender_email as string | null,
    null,
  );
  console.log('[Operations/loans] renewLoanAgreement success', created.id);
  revalidatePath('/operations');
  return { success: true as const, id: created.id as string };
}

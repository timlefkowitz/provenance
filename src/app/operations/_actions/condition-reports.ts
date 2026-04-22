/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

const createSchema = z.object({
  artwork_id: z.string().uuid(),
  loan_agreement_id: z.string().uuid().optional().nullable(),
  consignment_id: z.string().uuid().optional().nullable(),
  report_type: z.enum(['initial', 'return', 'periodic']),
  condition_grade: z.enum(['excellent', 'good', 'fair', 'poor']).optional().nullable(),
  description: z.string().max(20000).optional().nullable(),
  inspector_name: z.string().max(500).optional().nullable(),
  inspection_date: z.string().optional().or(z.literal('')).nullable(),
  attachments_storage_paths: z.array(z.string().max(2000)).optional(),
});

const updateSchema = createSchema
  .extend({ id: z.string().uuid() })
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
    console.error('[Operations/condition-reports] assertArtworkOwned', error);
    return false;
  }
  return Boolean(data);
}

async function assertOptionalLoan(
  client: any,
  userId: string,
  loanId: string | null | undefined,
) {
  if (!loanId) return true;
  const { data } = await client
    .from('artwork_loan_agreements')
    .select('id')
    .eq('id', loanId)
    .eq('account_id', userId)
    .maybeSingle();
  return Boolean(data);
}

async function assertOptionalConsignment(
  client: any,
  userId: string,
  conId: string | null | undefined,
) {
  if (!conId) return true;
  const { data } = await client
    .from('consignments')
    .select('id')
    .eq('id', conId)
    .eq('account_id', userId)
    .maybeSingle();
  return Boolean(data);
}

export async function createConditionReport(raw: z.infer<typeof createSchema>) {
  console.log('[Operations/condition-reports] create started');
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('[Operations/condition-reports] validation', parsed.error.flatten());
    return { success: false as const, error: 'Invalid data.' };
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
    return { success: false as const, error: 'Artwork not in your collection.' };
  }
  const loanOk = await assertOptionalLoan(client, user.id, parsed.data.loan_agreement_id);
  const conOk = await assertOptionalConsignment(client, user.id, parsed.data.consignment_id);
  if (!loanOk || !conOk) {
    return { success: false as const, error: 'Invalid loan or consignment link.' };
  }
  const paths = parsed.data.attachments_storage_paths ?? [];
  const { data, error } = await (client as any)
    .from('condition_reports')
    .insert({
      account_id: user.id,
      artwork_id: parsed.data.artwork_id,
      loan_agreement_id: parsed.data.loan_agreement_id || null,
      consignment_id: parsed.data.consignment_id || null,
      report_type: parsed.data.report_type,
      condition_grade: parsed.data.condition_grade ?? null,
      description: parsed.data.description ?? null,
      inspector_name: parsed.data.inspector_name ?? null,
      inspection_date: parsed.data.inspection_date || null,
      attachments_storage_paths: paths,
    })
    .select('id')
    .single();
  if (error) {
    console.error('[Operations/condition-reports] insert', error);
    return { success: false as const, error: 'Could not save report.' };
  }
  revalidatePath('/operations');
  return { success: true as const, id: data.id as string };
}

export async function updateConditionReport(raw: z.infer<typeof updateSchema>) {
  console.log('[Operations/condition-reports] update', raw.id);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
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
      return { success: false as const, error: 'Artwork not in your collection.' };
    }
  }
  if (rest.loan_agreement_id) {
    const l = await assertOptionalLoan(client, user.id, rest.loan_agreement_id);
    if (!l) {
      return { success: false as const, error: 'Invalid loan link.' };
    }
  }
  if (rest.consignment_id) {
    const c = await assertOptionalConsignment(client, user.id, rest.consignment_id);
    if (!c) {
      return { success: false as const, error: 'Invalid consignment link.' };
    }
  }
  const patch: Record<string, unknown> = {};
  if (rest.artwork_id !== undefined) patch.artwork_id = rest.artwork_id;
  if (rest.loan_agreement_id !== undefined) patch.loan_agreement_id = rest.loan_agreement_id;
  if (rest.consignment_id !== undefined) patch.consignment_id = rest.consignment_id;
  if (rest.report_type !== undefined) patch.report_type = rest.report_type;
  if (rest.condition_grade !== undefined) patch.condition_grade = rest.condition_grade;
  if (rest.description !== undefined) patch.description = rest.description;
  if (rest.inspector_name !== undefined) patch.inspector_name = rest.inspector_name;
  if (rest.inspection_date !== undefined) patch.inspection_date = rest.inspection_date || null;
  if (rest.attachments_storage_paths !== undefined) {
    patch.attachments_storage_paths = rest.attachments_storage_paths ?? [];
  }

  const { error } = await (client as any)
    .from('condition_reports')
    .update(patch)
    .eq('id', id)
    .eq('account_id', user.id);
  if (error) {
    console.error('[Operations/condition-reports] update', error);
    return { success: false as const, error: 'Could not update report.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

export async function deleteConditionReport(id: string) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false as const, error: 'You must be logged in.' };
  }
  const { error } = await (client as any)
    .from('condition_reports')
    .delete()
    .eq('id', id)
    .eq('account_id', user.id);
  if (error) {
    console.error('[Operations/condition-reports] delete', error);
    return { success: false as const, error: 'Could not delete report.' };
  }
  revalidatePath('/operations');
  return { success: true as const };
}

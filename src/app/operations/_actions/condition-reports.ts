/* eslint-disable @typescript-eslint/no-explicit-any */
'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const CONDITION_REPORTS_BUCKET = 'condition-reports';
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB
const MAX_FILES_PER_UPLOAD = 12;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);

const ALLOWED_EXT = new Set([
  'pdf',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
  'csv',
  'png',
  'jpg',
  'jpeg',
  'webp',
  'gif',
  'heic',
]);

function safeObjectFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, '_');
  return cleaned.length ? cleaned.slice(0, 120) : 'file';
}

function isFileAllowed(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_ATTACHMENT_BYTES) {
    return false;
  }
  if (file.type && (ALLOWED_MIME.has(file.type) || file.type.startsWith('image/'))) {
    return true;
  }
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ext != null && ALLOWED_EXT.has(ext);
}

/**
 * Upload PDFs, images, Office docs, and text files; returns storage object paths for `attachments_storage_paths`.
 */
export async function uploadConditionReportFiles(
  formData: FormData,
): Promise<{ success: true; paths: string[] } | { success: false; error: string }> {
  console.log('[Operations/condition-reports] uploadConditionReportFiles started');
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    console.error('[Operations/condition-reports] upload: not authenticated');
    return { success: false, error: 'You must be logged in.' };
  }

  const files = formData.getAll('files') as File[];
  if (files.length === 0) {
    return { success: false, error: 'No files were selected.' };
  }
  if (files.length > MAX_FILES_PER_UPLOAD) {
    return { success: false, error: `At most ${MAX_FILES_PER_UPLOAD} files per save.` };
  }
  for (const f of files) {
    if (!isFileAllowed(f)) {
      return {
        success: false,
        error: `This file is not allowed or is too large (max 25MB): ${f.name}`,
      };
    }
  }

  try {
    const admin = getSupabaseServerAdminClient() as any;
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b: { id: string }) => b.id === CONDITION_REPORTS_BUCKET)) {
      const { error: cErr } = await admin.storage.createBucket(CONDITION_REPORTS_BUCKET, {
        public: false,
      });
      if (cErr) {
        console.log('[Operations/condition-reports] createBucket note', cErr);
      }
    }
  } catch (e) {
    console.error('[Operations/condition-reports] bucket ensure failed', e);
  }

  const bucket = client.storage.from(CONDITION_REPORTS_BUCKET);
  const paths: string[] = [];
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const safe = safeObjectFileName(file.name);
    const objectPath = `${user.id}/condition-reports/${Date.now()}-${Math.random().toString(36).slice(2, 10)}-${safe}`;
    const { error: upErr } = await bucket.upload(objectPath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });
    if (upErr) {
      console.error('[Operations/condition-reports] storage upload', upErr);
      return { success: false, error: upErr.message || 'Upload failed' };
    }
    paths.push(objectPath);
  }

  console.log('[Operations/condition-reports] uploadConditionReportFiles done', paths.length);
  return { success: true, paths };
}

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

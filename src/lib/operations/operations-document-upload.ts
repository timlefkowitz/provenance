/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Single-file upload for Operations tabs (reuses `condition-reports` storage bucket; path is user-scoped).
 */
'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const OPS_BUCKET = 'condition-reports';
const MAX_BYTES = 25 * 1024 * 1024;

const ALLOWED = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
]);
const EXTS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'csv', 'png', 'jpg', 'jpeg', 'webp', 'gif']);

function safeName(n: string) {
  const b = n.split(/[/\\]/).pop() || 'file';
  return b.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

function ok(f: File) {
  if (f.size <= 0 || f.size > MAX_BYTES) {
    return false;
  }
  if (f.type && (ALLOWED.has(f.type) || f.type.startsWith('image/'))) {
    return true;
  }
  const e = f.name.split('.').pop()?.toLowerCase();
  return e != null && EXTS.has(e);
}

export type OperationsDocFolder = 'shipments' | 'insurance' | 'acquisitions';

/**
 * One document for `document_storage_path` on shipment/insurance/acquisition rows.
 */
export async function uploadOperationsDocument(
  formData: FormData,
  folder: OperationsDocFolder,
): Promise<{ success: true; path: string } | { success: false; error: string }> {
  console.log('[Operations/doc-upload] started', folder);
  const client = getSupabaseServerClient() as any;
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) {
    return { success: false, error: 'You must be logged in.' };
  }
  const file = formData.get('file') as File | null;
  if (!file) {
    return { success: false, error: 'No file was selected.' };
  }
  if (!ok(file)) {
    return { success: false, error: 'File not allowed or too large (max 25MB).' };
  }
  try {
    const admin = getSupabaseServerAdminClient() as any;
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b: { id: string }) => b.id === OPS_BUCKET)) {
      await admin.storage.createBucket(OPS_BUCKET, { public: false });
    }
  } catch (e) {
    console.error('[Operations/doc-upload] bucket ensure', e);
  }
  const bytes = await file.arrayBuffer();
  const objectPath = `${user.id}/operations/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 9)}-${safeName(file.name)}`;
  const { error } = await client.storage.from(OPS_BUCKET).upload(objectPath, bytes, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  });
  if (error) {
    console.error('[Operations/doc-upload] failed', error);
    return { success: false, error: error.message || 'Upload failed' };
  }
  console.log('[Operations/doc-upload] done', objectPath);
  return { success: true, path: objectPath };
}

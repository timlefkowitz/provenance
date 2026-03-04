'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getUserProfileByRole } from '~/app/profiles/_actions/get-user-profiles';
import { USER_ROLES } from '~/lib/user-roles';
import { extractTextFromCvBuffer } from './extract-text-from-cv';
import { extractCvToJson } from './extract-cv-to-json';

const ARTIST_CVS_BUCKET = 'artist-cvs';
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
];

export type UploadArtistCvResult = { success: true; error?: never } | { success: false; error: string };

/**
 * Upload artist CV (PDF, DOCX, or TXT), extract text, run OpenAI extraction, and save to profile.
 */
export async function uploadArtistCv(formData: FormData): Promise<UploadArtistCvResult> {
  console.log('[Grants] uploadArtistCv started');
  const client = getSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();

  if (authError || !user) {
    console.error('[Grants] uploadArtistCv auth failed', authError);
    return { success: false, error: 'You must be signed in to upload a CV' };
  }

  const file = formData.get('file') as File | null;
  if (!file || !(file instanceof File)) {
    return { success: false, error: 'No file provided' };
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return { success: false, error: 'File must be PDF, Word (DOCX), or plain text' };
  }

  if (file.size > MAX_FILE_BYTES) {
    return { success: false, error: 'File size must be less than 10MB' };
  }

  const artistProfile = await getUserProfileByRole(user.id, USER_ROLES.ARTIST);
  if (!artistProfile) {
    console.error('[Grants] uploadArtistCv no artist profile', user.id);
    return { success: false, error: 'Create an artist profile first from your profiles or settings' };
  }

  const bytes = await file.arrayBuffer();
  console.log('[Grants] extractTextFromCvBuffer', file.type);
  const { text, error: extractErr } = await extractTextFromCvBuffer(bytes, file.type);
  if (extractErr || !text) {
    console.error('[Grants] extractTextFromCvBuffer failed', extractErr);
    return { success: false, error: extractErr || 'Could not extract text from file' };
  }

  console.log('[Grants] extractCvToJson calling OpenAI');
  const { data: cvJson, error: jsonErr } = await extractCvToJson(text);
  if (jsonErr) {
    return { success: false, error: jsonErr };
  }
  if (!cvJson) {
    return { success: false, error: 'Could not parse CV content' };
  }

  const ext = file.name.split('.').pop() || 'pdf';
  const safeExt = ['pdf', 'docx', 'doc', 'txt', 'csv'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'bin';
  const fileName = `${user.id}/${artistProfile.id}/${Date.now()}.${safeExt}`;

  let bucket = client.storage.from(ARTIST_CVS_BUCKET);
  try {
    const admin = getSupabaseServerAdminClient();
    const { data: buckets } = await admin.storage.listBuckets();
    if (!buckets?.some((b) => b.id === ARTIST_CVS_BUCKET)) {
      await admin.storage.createBucket(ARTIST_CVS_BUCKET, {
        public: false,
        fileSizeLimit: MAX_FILE_BYTES,
        allowedMimeTypes: ALLOWED_TYPES,
      });
    }
    bucket = admin.storage.from(ARTIST_CVS_BUCKET);
  } catch (e) {
    console.error('[Grants] uploadArtistCv bucket check/create', e);
  }

  const { data: uploadData, error: uploadError } = await bucket.upload(fileName, bytes, {
    contentType: file.type,
    upsert: false,
  });

  if (uploadError) {
    console.error('[Grants] uploadArtistCv upload failed', uploadError);
    return { success: false, error: uploadError.message || 'Upload failed' };
  }

  const { data: urlData } = bucket.getPublicUrl(fileName);
  const fileUrl = urlData?.publicUrl ?? null;

  const { error: updateError } = await (client as any)
    .from('user_profiles')
    .update({
      artist_cv_json: cvJson,
      artist_cv_file_url: fileUrl,
      artist_cv_uploaded_at: new Date().toISOString(),
    })
    .eq('id', artistProfile.id)
    .eq('user_id', user.id);

  if (updateError) {
    console.error('[Grants] uploadArtistCv update profile failed', updateError);
    return { success: false, error: updateError.message || 'Failed to save CV to profile' };
  }

  console.log('[Grants] uploadArtistCv completed successfully');
  return { success: true };
}

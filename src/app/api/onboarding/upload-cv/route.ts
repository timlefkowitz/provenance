import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { extractTextFromCvBuffer } from '~/app/grants/_actions/extract-text-from-cv';
import { extractCvToJson } from '~/app/grants/_actions/extract-cv-to-json';

const ARTIST_CVS_BUCKET = 'artist-cvs';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
];

/**
 * Onboarding CV upload route.
 * Creates an artist profile row if one doesn't exist yet,
 * then processes and saves the CV exactly like the grants upload action.
 */
export async function POST(request: NextRequest) {
  console.log('[Onboarding] POST /api/onboarding/upload-cv');

  try {
    const client = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();

    if (authError || !user) {
      console.error('[Onboarding] upload-cv auth failed', authError);
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'File must be PDF, Word (DOCX), or plain text' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { success: false, error: 'File must be under 10 MB' },
        { status: 400 },
      );
    }

    const admin = getSupabaseServerAdminClient();

    // Ensure artist profile exists — create a minimal one if not
    let profileId: string;
    const { data: existing } = await (admin as any)
      .from('user_profiles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'artist')
      .eq('is_active', true)
      .maybeSingle();

    if (existing?.id) {
      profileId = existing.id as string;
      console.log('[Onboarding] upload-cv using existing profile', profileId);
    } else {
      const { data: account } = await (admin as any)
        .from('accounts')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();
      const displayName = (account?.name as string | null) ?? user.email?.split('@')[0] ?? 'Artist';

      console.log('[Onboarding] upload-cv creating artist profile for', user.id);
      const { data: inserted, error: insertErr } = await (admin as any)
        .from('user_profiles')
        .insert({ user_id: user.id, role: 'artist', name: displayName, is_active: true })
        .select('id')
        .single();

      if (insertErr) {
        console.error('[Onboarding] upload-cv profile create failed', insertErr);
        return NextResponse.json({ success: false, error: insertErr.message }, { status: 500 });
      }

      profileId = inserted.id as string;
      console.log('[Onboarding] upload-cv created profile', profileId);
    }

    // Extract and parse CV text
    const bytes = await file.arrayBuffer();
    console.log('[Onboarding] upload-cv extracting text', file.type);
    const { text, error: extractErr } = await extractTextFromCvBuffer(bytes, file.type);

    if (extractErr || !text) {
      console.error('[Onboarding] upload-cv text extraction failed', extractErr);
      return NextResponse.json(
        { success: false, error: extractErr ?? 'Could not extract text from file' },
        { status: 422 },
      );
    }

    console.log('[Onboarding] upload-cv running OpenAI extraction');
    const { data: cvJson, error: jsonErr } = await extractCvToJson(text);

    if (jsonErr || !cvJson) {
      console.error('[Onboarding] upload-cv OpenAI extraction failed', jsonErr);
      return NextResponse.json(
        { success: false, error: jsonErr ?? 'Could not parse CV content' },
        { status: 422 },
      );
    }

    // Upload file to storage
    const ext = file.name.split('.').pop() ?? 'pdf';
    const safeExt = ['pdf', 'docx', 'doc', 'txt', 'csv'].includes(ext.toLowerCase())
      ? ext.toLowerCase()
      : 'bin';
    const fileName = `${user.id}/${profileId}/${Date.now()}.${safeExt}`;

    // Ensure bucket exists
    try {
      const { data: buckets } = await admin.storage.listBuckets();
      if (!buckets?.some((b) => b.id === ARTIST_CVS_BUCKET)) {
        await admin.storage.createBucket(ARTIST_CVS_BUCKET, {
          public: false,
          fileSizeLimit: MAX_FILE_BYTES,
          allowedMimeTypes: ALLOWED_TYPES,
        });
      }
    } catch (e) {
      console.error('[Onboarding] upload-cv bucket check failed', e);
    }

    const { error: uploadError } = await admin.storage
      .from(ARTIST_CVS_BUCKET)
      .upload(fileName, bytes, { contentType: file.type, upsert: false });

    if (uploadError) {
      console.error('[Onboarding] upload-cv storage upload failed', uploadError);
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 });
    }

    const { data: urlData } = admin.storage.from(ARTIST_CVS_BUCKET).getPublicUrl(fileName);
    const fileUrl = urlData?.publicUrl ?? null;

    // Save to profile
    const { error: updateErr } = await (admin as any)
      .from('user_profiles')
      .update({
        artist_cv_json: cvJson,
        artist_cv_file_url: fileUrl,
        artist_cv_file_path: fileName,
        artist_cv_uploaded_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    if (updateErr) {
      console.error('[Onboarding] upload-cv profile update failed', updateErr);
      return NextResponse.json({ success: false, error: updateErr.message }, { status: 500 });
    }

    console.log('[Onboarding] upload-cv completed successfully', profileId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[Onboarding] upload-cv threw', err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    );
  }
}

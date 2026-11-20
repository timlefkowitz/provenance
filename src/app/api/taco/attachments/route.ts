import { randomUUID } from 'node:crypto';

import { NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { extractTextFromCvBuffer } from '~/app/grants/_actions/extract-text-from-cv';
import { AI_CONSENT_REQUIRED, AI_CONSENT_REQUIRED_MESSAGE, hasAiConsent } from '~/lib/ai-consent';
import { ARTWORKS_BUCKET, artworkImageUploader, getArtworkImagePublicUrl } from '~/lib/artwork-storage';
import { assertAllowedFileWithAv } from '~/lib/file-signature';
import { checkRateLimit } from '~/lib/rate-limit';
import { getActiveSubscription } from '~/lib/subscription';
import { asUntyped } from '~/lib/supabase-untyped';
import type { TacoAttachmentRef } from '~/lib/taco/attachments';

export const maxDuration = 60;

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 60_000;

const DOC_MIMES: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword': 'doc',
  'text/plain': 'txt',
  'text/csv': 'csv',
};

function docMime(file: File): string | null {
  const type = (file.type || '').toLowerCase();
  if (DOC_MIMES[type]) return type;
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';
  return null;
}

function isImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  // iPhone HEIC picks can arrive with an empty type.
  return !file.type && /\.(heic|heif|jpe?g|png|webp|gif)$/i.test(file.name);
}

function safeName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

/**
 * Stores one file dropped into Taco and returns a reference the chat sends
 * back by id. Images are normalized to JPEG at a normal artwork image path,
 * so applying "add this photo" can reuse the URL as-is.
 */
export async function POST(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await hasAiConsent(user.id))) {
    return NextResponse.json({ error: AI_CONSENT_REQUIRED_MESSAGE, code: AI_CONSENT_REQUIRED }, { status: 403 });
  }
  if (!(await getActiveSubscription(user.id))) {
    return NextResponse.json({ error: 'Taco is a paid feature.' }, { status: 403 });
  }
  if (
    !(await checkRateLimit(
      { ip: null, headers: request.headers },
      { keyPrefix: `taco-upload:${user.id}`, windowMs: 60_000, maxPerWindow: 60 },
    ))
  ) {
    return NextResponse.json({ error: 'Too many uploads. Wait a minute and try again.' }, { status: 429 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file received.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: `${file.name} is over 15 MB.` }, { status: 400 });
  }

  const admin = getSupabaseServerAdminClient();
  const name = safeName(file.name);

  try {
    let kind: 'image' | 'document';
    let mime: string;
    let storagePath: string;
    let publicUrl: string;
    let extractedText: string | null = null;

    if (isImage(file)) {
      kind = 'image';
      mime = 'image/jpeg';
      // Signature + AV check, JPEG normalization, upload to {userId}/{ts}-x.jpeg.
      publicUrl = await artworkImageUploader.upload(client, admin, file, user.id);
      const marker = `/object/public/${ARTWORKS_BUCKET}/`;
      storagePath = decodeURIComponent(publicUrl.slice(publicUrl.indexOf(marker) + marker.length));
    } else {
      const dm = docMime(file);
      if (!dm) {
        return NextResponse.json(
          { error: 'Taco can read photos, PDF, Word, TXT and CSV files.' },
          { status: 400 },
        );
      }
      kind = 'document';
      mime = dm;
      if (!dm.startsWith('text/')) {
        const check = await assertAllowedFileWithAv(file, 'document');
        if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
      }
      const bytes = await file.arrayBuffer();
      storagePath = `${user.id}/taco-staging/${randomUUID()}-${name.replace(/\.[^.]+$/, '')}.${DOC_MIMES[dm]}`;
      const { error: upErr } = await admin.storage
        .from(ARTWORKS_BUCKET)
        .upload(storagePath, bytes, { contentType: dm, upsert: false });
      if (upErr) throw upErr;
      publicUrl = getArtworkImagePublicUrl(storagePath);
      const { text } = await extractTextFromCvBuffer(bytes, dm);
      extractedText = text ? text.slice(0, MAX_EXTRACTED_CHARS) : null;
    }

    const { data: row, error } = await asUntyped(admin)
      .from('taco_attachments')
      .insert({
        user_id: user.id,
        storage_path: storagePath,
        public_url: publicUrl,
        kind,
        mime,
        name,
        size_bytes: file.size,
        extracted_text: extractedText,
      })
      .select('id')
      .single();
    if (error || !row) throw error ?? new Error('insert failed');

    console.log('[Taco] attachment stored', { userId: user.id, id: row.id, kind, hasText: !!extractedText });
    const ref: TacoAttachmentRef = { id: row.id as string, kind, name, url: publicUrl };
    return NextResponse.json(ref);
  } catch (err) {
    console.error('[Taco] attachment upload failed', { userId: user.id, name, err });
    const message = err instanceof Error ? err.message : 'Upload failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

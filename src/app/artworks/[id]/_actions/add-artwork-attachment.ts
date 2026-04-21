'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { ARTWORKS_BUCKET, getArtworkImagePublicUrl } from '~/lib/artwork-storage';

const MAX_BYTES = 15 * 1024 * 1024;

const ALLOWED: Record<string, 'image' | 'document'> = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
  'application/pdf': 'document',
};

function sanitizeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() || 'file';
  return base.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'file';
}

export type AddArtworkAttachmentResult =
  | { success: true; id: string; file_url: string; file_name: string; file_type: 'image' | 'document'; label: string | null; is_public: boolean }
  | { success: false; error: string };

/**
 * Owner or gallery team: upload an extra image or PDF attached to the certificate.
 * formData fields:
 *   file      — required File
 *   label     — optional display name (string)
 *   is_public — "true" | "false" (defaults true)
 */
export async function addArtworkAttachment(
  artworkId: string,
  formData: FormData,
): Promise<AddArtworkAttachmentResult> {
  console.log('[ArtworkAttachments] addArtworkAttachment started', { artworkId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size <= 0) {
    return { success: false, error: 'Please choose a file' };
  }

  const rawLabel = formData.get('label')?.toString().trim() ?? '';
  const label = rawLabel.length > 0 ? rawLabel.slice(0, 200) : null;
  const isPublic = formData.get('is_public')?.toString() !== 'false';

  if (file.size > MAX_BYTES) {
    return { success: false, error: 'File is too large (max 15 MB)' };
  }

  const mime = (file.type || 'application/octet-stream').toLowerCase();
  const fileType = ALLOWED[mime];
  if (!fileType) {
    return { success: false, error: 'Only images (JPEG, PNG, WebP, GIF) or PDF are allowed' };
  }

  const { data: artwork, error: artErr } = await (client as any)
    .from('artworks')
    .select('id, account_id, gallery_profile_id')
    .eq('id', artworkId)
    .single();

  if (artErr || !artwork) {
    console.error('[ArtworkAttachments] artwork not found', artErr);
    return { success: false, error: 'Artwork not found' };
  }

  const canEdit = await canEditGalleryArtworks(user.id, {
    account_id: artwork.account_id,
    gallery_profile_id: artwork.gallery_profile_id ?? undefined,
  });

  if (!canEdit) {
    return { success: false, error: 'You do not have permission to add attachments' };
  }

  const safeName = sanitizeFileName(file.name);
  const extFromMime =
    mime === 'application/pdf'
      ? 'pdf'
      : mime.includes('png')
        ? 'png'
        : mime.includes('webp')
          ? 'webp'
          : mime.includes('gif')
            ? 'gif'
            : 'jpg';
  const storagePath = `${user.id}/attachments/${artworkId}/${Date.now()}-${safeName.replace(/\.[^.]+$/, '') || 'file'}.${extFromMime}`;

  const bytes = await file.arrayBuffer();
  const adminClient = getSupabaseServerAdminClient();
  const bucket = adminClient.storage.from(ARTWORKS_BUCKET);

  const { error: uploadError } = await bucket.upload(storagePath, bytes, {
    contentType: mime,
    upsert: false,
  });

  if (uploadError) {
    console.error('[ArtworkAttachments] storage upload failed', uploadError);
    return { success: false, error: uploadError.message || 'Upload failed' };
  }

  const fileUrl = getArtworkImagePublicUrl(storagePath);

  const { data: row, error: insertError } = await (client as any)
    .from('artwork_attachments')
    .insert({
      artwork_id: artworkId,
      account_id: user.id,
      file_url: fileUrl,
      file_name: safeName,
      file_type: fileType,
      label,
      is_public: isPublic,
    })
    .select('id, file_url, file_name, file_type, label, is_public')
    .single();

  if (insertError || !row) {
    console.error('[ArtworkAttachments] insert failed', insertError);
    await bucket.remove([storagePath]).catch((e) =>
      console.error('[ArtworkAttachments] rollback remove failed', e),
    );
    return { success: false, error: insertError?.message || 'Could not save attachment' };
  }

  console.log('[ArtworkAttachments] attachment saved', { id: row.id, artworkId });
  revalidatePath(`/artworks/${artworkId}/certificate`);

  return {
    success: true,
    id: row.id,
    file_url: row.file_url,
    file_name: row.file_name,
    file_type: row.file_type,
    label: row.label ?? null,
    is_public: row.is_public ?? true,
  };
}

'use server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { revalidatePath } from 'next/cache';
import { canEditGalleryArtworks } from '~/app/profiles/_actions/gallery-members';
import { ARTWORKS_BUCKET } from '~/lib/artwork-storage';

function storagePathFromPublicUrl(fileUrl: string): string | null {
  const marker = '/storage/v1/object/public/' + ARTWORKS_BUCKET + '/';
  const idx = fileUrl.indexOf(marker);
  if (idx === -1) return null;
  return decodeURIComponent(fileUrl.slice(idx + marker.length));
}

export type DeleteArtworkAttachmentResult = { success: true } | { success: false; error: string };

/**
 * Owner, uploader, or gallery team: remove an attachment and its storage object.
 */
export async function deleteArtworkAttachment(attachmentId: string): Promise<DeleteArtworkAttachmentResult> {
  console.log('[ArtworkAttachments] deleteArtworkAttachment started', { attachmentId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return { success: false, error: 'You must be signed in' };
  }

  const { data: row, error: fetchErr } = await (client as any)
    .from('artwork_attachments')
    .select('id, artwork_id, file_url, account_id')
    .eq('id', attachmentId)
    .single();

  if (fetchErr || !row) {
    console.error('[ArtworkAttachments] attachment not found', fetchErr);
    return { success: false, error: 'Attachment not found' };
  }

  const { data: artwork, error: artErr } = await (client as any)
    .from('artworks')
    .select('account_id, gallery_profile_id')
    .eq('id', row.artwork_id)
    .single();

  if (artErr || !artwork) {
    return { success: false, error: 'Artwork not found' };
  }

  const canEdit = await canEditGalleryArtworks(user.id, {
    account_id: artwork.account_id,
    gallery_profile_id: artwork.gallery_profile_id ?? undefined,
  });
  const isUploader = row.account_id === user.id;

  if (!canEdit && !isUploader) {
    return { success: false, error: 'You do not have permission to delete this attachment' };
  }

  // If uploader is not the artwork owner, storage path may be under uploader's prefix — use admin for storage
  const storagePath = storagePathFromPublicUrl(row.file_url);
  if (storagePath) {
    const admin = getSupabaseServerAdminClient();
    const { error: rmErr } = await admin.storage.from(ARTWORKS_BUCKET).remove([storagePath]);
    if (rmErr) {
      console.error('[ArtworkAttachments] storage remove failed', rmErr);
      // Continue to DB delete so we don't orphan metadata on missing file
    }
  } else {
    console.warn('[ArtworkAttachments] could not parse storage path from url', { fileUrl: row.file_url });
  }

  const { error: delErr } = await (client as any).from('artwork_attachments').delete().eq('id', attachmentId);

  if (delErr) {
    console.error('[ArtworkAttachments] db delete failed', delErr);
    return { success: false, error: delErr.message || 'Delete failed' };
  }

  console.log('[ArtworkAttachments] attachment deleted', { attachmentId, artworkId: row.artwork_id });
  revalidatePath(`/artworks/${row.artwork_id}/certificate`);

  return { success: true };
}

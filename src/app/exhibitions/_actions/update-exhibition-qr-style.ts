'use server';

import { revalidatePath } from 'next/cache';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { asUntyped } from '~/lib/supabase-untyped';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';
import { isArtGrid } from '../_helpers/qr-halftone';
import {
  cleanQrWords,
  isQrColour,
  isQrImageDataUri,
  isQrStyleId,
  type QrStyleSettings,
} from '../_helpers/qr-style';

/**
 * Saves an exhibition's QR code style to `exhibitions.metadata.qr`, so the
 * poster, downloads, artwork QR sheet and checklist all use it, for everyone
 * who manages the show. An uploaded image is kept with the style (a small data
 * URI the dialog has already shrunk) so a later switch back to "Your image"
 * doesn't need a re-upload.
 */
export async function updateExhibitionQrStyle(
  exhibitionId: string,
  settings: QrStyleSettings,
): Promise<{ success: true } | { success: false; error: string }> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return { success: false, error: 'Sign in to change the QR code.' };

  if (!isQrStyleId(settings?.style)) return { success: false, error: 'Unknown QR style.' };
  const customImage = settings.customImage ?? null;
  if (customImage !== null && !isQrImageDataUri(customImage)) {
    return { success: false, error: 'That image could not be used. Try a smaller PNG or JPEG.' };
  }
  if (settings.style === 'custom' && !customImage) {
    return { success: false, error: 'Upload an image first.' };
  }
  const pictureArt = isArtGrid(settings.pictureArt) ? settings.pictureArt : null;
  const wordsArt = isArtGrid(settings.wordsArt) ? settings.wordsArt : null;
  const words = cleanQrWords(settings.words);
  const wordsColour = isQrColour(settings.wordsColour) ? settings.wordsColour : null;
  if (settings.style === 'picture' && !pictureArt) {
    return { success: false, error: 'That picture could not be used. Try another image.' };
  }
  if (settings.style === 'words' && (!wordsArt || !words)) {
    return { success: false, error: 'Type some words first.' };
  }

  const admin = asUntyped(getSupabaseServerAdminClient());
  const { data: exhibition, error: readError } = await admin
    .from('exhibitions')
    .select('gallery_id, metadata')
    .eq('id', exhibitionId)
    .maybeSingle();
  if (readError || !exhibition) return { success: false, error: 'Exhibition not found.' };
  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    return { success: false, error: 'You can only change exhibitions you manage.' };
  }

  const metadata = {
    ...((exhibition.metadata as Record<string, unknown> | null) ?? {}),
    qr: { style: settings.style, customImage, pictureArt, words, wordsColour, wordsArt },
  };
  const { error: writeError } = await admin
    .from('exhibitions')
    .update({ metadata })
    .eq('id', exhibitionId);
  if (writeError) {
    console.error('[Exhibitions] updateExhibitionQrStyle failed', writeError);
    return { success: false, error: 'Could not save the QR style.' };
  }

  console.log('[Exhibitions] updateExhibitionQrStyle', {
    exhibitionId,
    style: settings.style,
    hasCustomImage: Boolean(customImage),
  });
  revalidatePath(`/exhibitions/${exhibitionId}`);
  return { success: true };
}

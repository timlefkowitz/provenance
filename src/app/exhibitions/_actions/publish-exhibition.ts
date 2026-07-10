'use server';

/* eslint-disable @typescript-eslint/no-explicit-any -- exhibitions RLS queries use loosely typed Supabase rows */

import { asUntyped } from '~/lib/supabase-untyped';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { revalidatePath } from 'next/cache';
import { canManageExhibition } from '~/app/profiles/_actions/gallery-members';

export type PublishExhibitionResult =
  | { success: true; publishedAt: string }
  | { success: false; error: string };

export type UnpublishExhibitionResult =
  | { success: true }
  | { success: false; error: string };

export async function publishExhibition(
  exhibitionId: string,
): Promise<PublishExhibitionResult> {
  console.log('[Exhibitions] publishExhibition started', { exhibitionId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] publishExhibition: not authenticated');
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: exhibition, error: fetchErr } = await asUntyped(client)
    .from('exhibitions')
    .select('id, gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (fetchErr || !exhibition) {
    console.error('[Exhibitions] publishExhibition: exhibition not found', fetchErr);
    return { success: false, error: 'Exhibition not found.' };
  }

  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    console.error('[Exhibitions] publishExhibition: access denied', { exhibitionId });
    return { success: false, error: 'You do not have permission to publish this exhibition.' };
  }

  if (exhibition.published_at) {
    return { success: true, publishedAt: exhibition.published_at as string };
  }

  const publishedAt = new Date().toISOString();

  const { error: updateErr } = await asUntyped(client)
    .from('exhibitions')
    .update({
      published_at: publishedAt,
      updated_by: user.id,
      updated_at: publishedAt,
    })
    .eq('id', exhibitionId);

  if (updateErr) {
    console.error('[Exhibitions] publishExhibition failed', updateErr);
    return { success: false, error: updateErr.message || 'Failed to publish exhibition.' };
  }

  console.log('[Exhibitions] publishExhibition success', { exhibitionId, publishedAt });

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);

  return { success: true, publishedAt };
}

export async function unpublishExhibition(
  exhibitionId: string,
): Promise<UnpublishExhibitionResult> {
  console.log('[Exhibitions] unpublishExhibition started', { exhibitionId });

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    console.error('[Exhibitions] unpublishExhibition: not authenticated');
    return { success: false, error: 'You must be signed in.' };
  }

  const { data: exhibition, error: fetchErr } = await asUntyped(client)
    .from('exhibitions')
    .select('id, gallery_id, published_at')
    .eq('id', exhibitionId)
    .maybeSingle();

  if (fetchErr || !exhibition) {
    console.error('[Exhibitions] unpublishExhibition: exhibition not found', fetchErr);
    return { success: false, error: 'Exhibition not found.' };
  }

  if (!(await canManageExhibition(user.id, exhibition.gallery_id))) {
    console.error('[Exhibitions] unpublishExhibition: access denied', { exhibitionId });
    return { success: false, error: 'You do not have permission to unpublish this exhibition.' };
  }

  if (!exhibition.published_at) {
    return { success: true };
  }

  const { error: updateErr } = await asUntyped(client)
    .from('exhibitions')
    .update({
      published_at: null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', exhibitionId);

  if (updateErr) {
    console.error('[Exhibitions] unpublishExhibition failed', updateErr);
    return { success: false, error: updateErr.message || 'Failed to unpublish exhibition.' };
  }

  console.log('[Exhibitions] unpublishExhibition success', { exhibitionId });

  revalidatePath('/exhibitions');
  revalidatePath(`/exhibitions/${exhibitionId}`);
  revalidatePath(`/exhibitions/${exhibitionId}/edit`);

  return { success: true };
}
